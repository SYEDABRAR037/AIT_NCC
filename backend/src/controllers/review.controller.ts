import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { Role, AccountStatus } from '@prisma/client';

// 1. Get Pending Cadet Registrations (Phase 2 & Phase 3)
// Visible to SENIOR, PLATOON_SENIOR, and ADMIN_ANO
export const getPendingApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Pending applications are those under review or returned/on hold
    const whereClause: any = {
      role: 'CADET',
      status: { in: ['UNDER_REVIEW', 'HOLD', 'RETURNED'] },
    };

    const pending = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        email: true,
        phone: true,
        year: true,
        branch: true,
        platoonName: true,
        battalion: true,
        company: true,
        group: true,
        team: true,
        profilePhotoUrl: true,
        enrollmentDetails: true,
        dateOfJoining: true,
        status: true,
        createdAt: true,
        biometricTemplate: {
          select: {
            id: true,
            qualityScore: true,
            registeredAt: true,
            registeredBy: true,
          },
        },
        applicationReviews: {
          include: {
            reviewer: { select: { id: true, fullName: true, role: true, regimentalNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: pending.length,
      reviewerRole: req.user.role,
      applications: pending,
    });
  } catch (error) {
    console.error('getPendingApplications error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pending applications' });
  }
};

// 2. Get Application History & Full Profile (Phase 2 Full Profile Visibility)
export const getApplicationDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cadetId } = req.params;

    const cadet = await prisma.user.findUnique({
      where: { id: String(cadetId) },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        email: true,
        phone: true,
        year: true,
        branch: true,
        platoonName: true,
        battalion: true,
        company: true,
        group: true,
        team: true,
        profilePhotoUrl: true,
        enrollmentDetails: true,
        dateOfJoining: true,
        status: true,
        createdAt: true,
        biometricTemplate: {
          select: {
            id: true,
            qualityScore: true,
            registeredAt: true,
            registeredBy: true,
          },
        },
        applicationReviews: {
          include: {
            reviewer: { select: { id: true, fullName: true, role: true, regimentalNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cadet) {
      res.status(404).json({ success: false, message: 'Cadet application record not found' });
      return;
    }

    res.json({ success: true, cadet });
  } catch (error) {
    console.error('getApplicationDetails error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve application details' });
  }
};

// 3. Process Review Action (Phases 3, 4, 5 — Atomic Concurrency Protection + Audit Trail)
export const processReviewAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cadetId } = req.params;
    const { action, remarks } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const reviewerRole = req.user.role;
    if (!['ADMIN_ANO', 'PLATOON_SENIOR', 'SENIOR'].includes(reviewerRole)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have authority to review cadet applications.',
      });
      return;
    }

    const normalizedAction = String(action || '').toUpperCase().trim();
    const validActions = ['FORWARD', 'APPROVE', 'REJECT', 'HOLD', 'RETURN', 'CORRECTION_REQUESTED'];
    if (!validActions.includes(normalizedAction)) {
      res.status(400).json({ success: false, message: 'Invalid review action specified' });
      return;
    }

    // Execute atomic transaction with concurrency check (Phase 3 & 4)
    const result = await prisma.$transaction(async (tx) => {
      // Fetch fresh cadet record inside transaction
      const cadet = await tx.user.findUnique({
        where: { id: String(cadetId) },
        include: {
          applicationReviews: {
            include: {
              reviewer: { select: { id: true, fullName: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!cadet) {
        throw { statusCode: 404, message: 'Cadet application not found' };
      }

      // Check if registration was already finalized
      if (cadet.status === 'ACTIVE' || cadet.status === 'APPROVED') {
        throw {
          statusCode: 400,
          message: 'This cadet application has already received final approval and is active.',
        };
      }

      // STAGE-SPECIFIC CONCURRENCY PROTECTION:
      // Prevent duplicate reviews at the same officer tier
      if (reviewerRole === 'SENIOR') {
        const priorSeniorReview = cadet.applicationReviews.find((r) =>
          (r.stage === 'SENIOR_REVIEW' || r.stage === 'SENIOR_FORWARDED') &&
          ['FORWARD', 'APPROVE'].includes(r.action)
        );
        if (priorSeniorReview) {
          const priorOfficerName = priorSeniorReview.reviewer?.fullName || 'a Senior Cadet';
          throw {
            statusCode: 409,
            message: `Senior Review already completed by ${priorOfficerName}. Application is currently in the Platoon Senior / ANO queue.`,
          };
        }
      }

      if (reviewerRole === 'PLATOON_SENIOR') {
        const priorPlatoonReview = cadet.applicationReviews.find((r) =>
          (r.stage === 'PLATOON_SENIOR_REVIEW' || r.stage === 'PLATOON_SENIOR_FORWARDED') &&
          ['FORWARD', 'APPROVE'].includes(r.action)
        );
        if (priorPlatoonReview) {
          const priorOfficerName = priorPlatoonReview.reviewer?.fullName || 'a Platoon Senior';
          throw {
            statusCode: 409,
            message: `Platoon Senior Review already completed by ${priorOfficerName}. Application is currently awaiting ANO Final Approval.`,
          };
        }
      }

      // Determine stage and target status
      let stage = 'SENIOR_REVIEW';
      if (reviewerRole === 'PLATOON_SENIOR') {
        stage = 'PLATOON_SENIOR_REVIEW';
      } else if (reviewerRole === 'ADMIN_ANO') {
        stage = 'ANO_FINAL_APPROVAL';
      }

      let newStatus: AccountStatus = cadet.status;

      if (normalizedAction === 'REJECT') {
        newStatus = 'REJECTED';
      } else if (normalizedAction === 'HOLD' || normalizedAction === 'RETURN' || normalizedAction === 'CORRECTION_REQUESTED') {
        newStatus = 'RETURNED';
      } else if (normalizedAction === 'APPROVE') {
        if (reviewerRole === 'ADMIN_ANO') {
          // ANO Final Approval: transitions to ACTIVE
          newStatus = 'ACTIVE';
        } else {
          // Senior / Platoon Senior first approval forwards to next review stage
          newStatus = 'UNDER_REVIEW';
        }
      } else if (normalizedAction === 'FORWARD') {
        newStatus = 'UNDER_REVIEW';
      }

      // 1. Create Review Record
      const reviewRecord = await tx.reviewRecord.create({
        data: {
          cadetId: cadet.id,
          reviewerId: req.user!.id,
          stage,
          action: normalizedAction === 'APPROVE' && reviewerRole !== 'ADMIN_ANO' ? 'FORWARD' : normalizedAction,
          remarks: remarks ? String(remarks).trim() : null,
        },
        include: {
          reviewer: { select: { fullName: true, role: true } },
        },
      });

      // 2. Assignment resolution on ANO Final Approval (Phase 13 & 14)
      if (reviewerRole === 'ADMIN_ANO' && newStatus === 'ACTIVE') {
        let designatedSeniorId = req.body.seniorId ? String(req.body.seniorId).trim() : null;

        // If not explicitly provided in request body, automatically link to the Senior Cadet
        // who reviewed and endorsed this application during the review pipeline
        if (!designatedSeniorId) {
          const endorsingSeniorReview = cadet.applicationReviews.find(
            (r) => (r.stage === 'SENIOR_REVIEW' || r.stage === 'SENIOR_FORWARDED') && r.reviewer?.role === 'SENIOR'
          );
          if (endorsingSeniorReview) {
            designatedSeniorId = endorsingSeniorReview.reviewerId;
          }
        }

        if (designatedSeniorId) {
          await tx.seniorAssignment.upsert({
            where: { cadetId: cadet.id },
            update: { seniorId: designatedSeniorId },
            create: { cadetId: cadet.id, seniorId: designatedSeniorId },
          });
        }
      }

      // 3. Update Cadet User Record
      const cadetUpdateData: any = { status: newStatus };
      if (req.body.platoonName) {
        cadetUpdateData.platoonName = String(req.body.platoonName).trim();
      }
      if (req.body.team) {
        cadetUpdateData.team = String(req.body.team).trim();
      }

      const updatedCadet = await tx.user.update({
        where: { id: cadet.id },
        data: cadetUpdateData,
        select: {
          id: true,
          fullName: true,
          regimentalNumber: true,
          collegeRollNumber: true,
          email: true,
          phone: true,
          year: true,
          branch: true,
          platoonName: true,
          team: true,
          status: true,
        },
      });

      // 3. Persist in AuditLog (Phase 5)
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          actorName: req.user!.fullName || req.user!.email,
          action: `CADET_REGISTRATION_${normalizedAction}`,
          targetType: 'CADET_ENROLLMENT',
          targetId: cadet.id,
          details: JSON.stringify({
            cadetName: cadet.fullName,
            regimentalNumber: cadet.regimentalNumber,
            reviewerRole,
            previousStatus: cadet.status,
            newStatus,
            stage,
            remarks: remarks ? String(remarks).trim() : null,
          }),
        },
      });

      // 4. Record Activity Timeline Event (Phase 5)
      const timelineTitle =
        reviewerRole === 'ADMIN_ANO'
          ? normalizedAction === 'APPROVE'
            ? 'Enrollment Commissioned — Cadet Active'
            : normalizedAction === 'REJECT'
            ? 'Registration Rejected by ANO'
            : 'Registration Dossier Returned for Corrections'
          : `Registration Dossier Forwarded by ${reviewerRole === 'SENIOR' ? 'Senior Cadet' : 'Platoon Senior'}`;

      const timelineDesc = remarks
        ? String(remarks).trim()
        : `Reviewed and processed by ${req.user!.fullName} (${reviewerRole}). Status: ${newStatus}.`;

      await tx.timelineEvent.create({
        data: {
          cadetId: cadet.id,
          category: 'REGISTRATION',
          title: timelineTitle,
          description: timelineDesc,
          actorId: req.user!.id,
          actorRole: req.user!.role as Role,
          metadata: JSON.stringify({
            stage,
            action: normalizedAction,
            previousStatus: cadet.status,
            newStatus,
          }),
        },
      });

      return { reviewRecord, updatedCadet, newStatus };
    });

    res.json({
      success: true,
      message: `Cadet application for ${result.updatedCadet.fullName} processed successfully as ${normalizedAction} (${result.newStatus}).`,
      reviewRecord: result.reviewRecord,
      cadet: result.updatedCadet,
    });
  } catch (error: any) {
    console.error('processReviewAction error:', error);
    const statusCode = error?.statusCode || 500;
    const message = error?.message || 'Failed to process application review';
    res.status(statusCode).json({ success: false, message });
  }
};
