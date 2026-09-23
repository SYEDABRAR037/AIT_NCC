import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
import { notifyInquiryReply } from '../services/notification.service';

// Generate unique Request Number: REQ-2026-XXXX
const generateRequestNumber = async (): Promise<string> => {
  const count = await prisma.request.count();
  const year = new Date().getFullYear();
  const padded = String(count + 1).padStart(4, '0');
  return `REQ-${year}-${padded}`;
};

// 1. Cadet submits a request
export const submitRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { requestType, title, description, priority, supportingDocUrl, metadata } = req.body;

    if (!requestType || !title || !description) {
      res.status(400).json({ success: false, message: 'requestType, title, and description are required' });
      return;
    }

    const validTypes = [
      'LEAVE',
      'PROFILE_CORRECTION',
      'CERTIFICATE_VERIFICATION',
      'CAMP_PARTICIPATION',
      'DUTY_RELATED',
      'DOCUMENT_REQUEST',
      'OTHER',
    ];

    if (!validTypes.includes(requestType)) {
      res.status(400).json({ success: false, message: 'Invalid requestType specified' });
      return;
    }

    const requestNumber = await generateRequestNumber();

    // Determine initial reviewer role
    let initialReviewerRole: Role = Role.SENIOR;
    if (requestType === 'PROFILE_CORRECTION' || requestType === 'DOCUMENT_REQUEST') {
      initialReviewerRole = Role.PLATOON_SENIOR;
    } else if (requestType === 'CERTIFICATE_VERIFICATION') {
      initialReviewerRole = Role.ADMIN_ANO;
    }

    const newRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          requestNumber,
          requestType,
          cadetId: req.user!.id,
          title: String(title).trim(),
          description: String(description).trim(),
          priority: priority || 'NORMAL',
          status: 'SUBMITTED',
          currentReviewerRole: initialReviewerRole,
          supportingDocUrl: supportingDocUrl ? String(supportingDocUrl).trim() : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      // Log initial submission in history
      await tx.requestHistoryRecord.create({
        data: {
          requestId: created.id,
          officerId: req.user!.id,
          officerRole: req.user!.role,
          action: 'SUBMIT',
          remarks: 'Request submitted into Command Center queue',
          previousStatus: 'NEW',
          newStatus: 'SUBMITTED',
        },
      });

      // Cross-module: Activity Timeline
      await tx.timelineEvent.create({
        data: {
          cadetId: req.user!.id,
          category: 'REQUEST',
          title: `Request Filed (${requestType.replace('_', ' ')})`,
          description: `Filed ${requestNumber}: ${title}. Priority: ${priority || 'NORMAL'}`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });

      return created;
    });

    res.status(201).json({
      success: true,
      message: `Request ${requestNumber} submitted successfully. Assigned to ${initialReviewerRole}.`,
      request: newRequest,
    });
  } catch (error) {
    console.error('submitRequest error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit request' });
  }
};

// 2. Cadet views their own requests
export const getMyRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const requests = await prisma.request.findMany({
      where: { cadetId: req.user.id },
      include: {
        history: {
          include: {
            officer: {
              select: {
                id: true,
                fullName: true,
                role: true,
                regimentalNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error('getMyRequests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch personal requests' });
  }
};

// 3. Cadet cancels a pending request
export const cancelRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const request = await prisma.request.findUnique({ where: { id: String(id) } });

    if (!request) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    if (request.cadetId !== req.user.id && req.user.role !== 'ADMIN_ANO') {
      res.status(403).json({ success: false, message: 'Unauthorized to cancel this request' });
      return;
    }

    if (request.status === 'APPROVED' || request.status === 'REJECTED' || request.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        message: `Cannot cancel request in ${request.status} state.`,
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.request.update({
        where: { id: request.id },
        data: { status: 'CANCELLED' },
      });

      await tx.requestHistoryRecord.create({
        data: {
          requestId: request.id,
          officerId: req.user!.id,
          officerRole: req.user!.role,
          action: 'CANCEL',
          remarks: 'Withdrawn by applicant',
          previousStatus: request.status,
          newStatus: 'CANCELLED',
        },
      });

      await tx.timelineEvent.create({
        data: {
          cadetId: request.cadetId,
          category: 'REQUEST',
          title: `Request Withdrawn (${request.requestNumber})`,
          description: `Withdrew request: ${request.title}`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });

      return u;
    });

    res.json({
      success: true,
      message: `Request ${request.requestNumber} cancelled successfully.`,
      request: updated,
    });
  } catch (error) {
    console.error('cancelRequest error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel request' });
  }
};

// 4. Officers view requests in Central Approval Center
export const getOfficerRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const whereClause: any = {};

    if (req.user.role === 'SENIOR') {
      // Senior sees assigned cadets' requests that are pending at SENIOR level
      const assignments = await prisma.seniorAssignment.findMany({
        where: { seniorId: req.user.id },
        select: { cadetId: true },
      });
      const cadetIds = assignments.map((a) => a.cadetId);
      whereClause.cadetId = { in: cadetIds };
      whereClause.currentReviewerRole = Role.SENIOR;
    } else if (req.user.role === 'PLATOON_SENIOR') {
      // Platoon Senior sees platoon cadets' requests pending at PLATOON_SENIOR level
      const platoonCadets = await prisma.user.findMany({
        where: { platoonName: req.user.platoonName, role: 'CADET' },
        select: { id: true },
      });
      const cadetIds = platoonCadets.map((c) => c.id);
      whereClause.cadetId = { in: cadetIds };
      whereClause.currentReviewerRole = Role.PLATOON_SENIOR;
    }
    // Admin sees all requests

    const requests = await prisma.request.findMany({
      where: whereClause,
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            platoonName: true,
            year: true,
            branch: true,
          },
        },
        history: {
          include: {
            officer: {
              select: {
                id: true,
                fullName: true,
                role: true,
                regimentalNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error('getOfficerRequests error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve officer requests' });
  }
};

// 5. Officer acts on a request (FORWARD, APPROVE, REJECT, RETURN)
export const processRequestAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { action, remarks } = req.body;

    const validActions = ['FORWARD', 'APPROVE', 'REJECT', 'RETURN'];
    if (!validActions.includes(action)) {
      res.status(400).json({ success: false, message: 'Invalid action. Must be FORWARD, APPROVE, REJECT, or RETURN.' });
      return;
    }

    const request = await prisma.request.findUnique({
      where: { id: String(id) },
      include: { cadet: true },
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    let nextStatus = request.status;
    let nextReviewerRole: Role | null = request.currentReviewerRole;

    if (action === 'REJECT') {
      nextStatus = 'REJECTED';
      nextReviewerRole = null;
    } else if (action === 'RETURN') {
      nextStatus = 'RETURNED';
      nextReviewerRole = null;
    } else if (action === 'APPROVE') {
      if (req.user.role === 'ADMIN_ANO' || (req.user.role === 'PLATOON_SENIOR' && request.requestType === 'DUTY_RELATED')) {
        nextStatus = 'APPROVED';
        nextReviewerRole = null;
      } else {
        // Otherwise forward to next tier
        nextStatus = 'FORWARDED';
        nextReviewerRole = req.user.role === 'SENIOR' ? Role.PLATOON_SENIOR : Role.ADMIN_ANO;
      }
    } else if (action === 'FORWARD') {
      nextStatus = 'FORWARDED';
      nextReviewerRole = req.user.role === 'SENIOR' ? Role.PLATOON_SENIOR : Role.ADMIN_ANO;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.request.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          currentReviewerRole: nextReviewerRole,
          currentReviewerId: req.user!.id,
        },
        include: {
          cadet: {
            select: {
              id: true,
              fullName: true,
              regimentalNumber: true,
            },
          },
          history: {
            include: {
              officer: { select: { fullName: true, role: true } },
            },
          },
        },
      });

      await tx.requestHistoryRecord.create({
        data: {
          requestId: request.id,
          officerId: req.user!.id,
          officerRole: req.user!.role,
          action,
          remarks: remarks ? String(remarks).trim() : null,
          previousStatus: request.status,
          newStatus: nextStatus,
        },
      });

      // Cross-Module: Timeline
      await tx.timelineEvent.create({
        data: {
          cadetId: request.cadetId,
          category: 'REQUEST',
          title: `Request ${action === 'FORWARD' ? 'Forwarded' : action === 'APPROVE' ? 'Approved' : action === 'RETURN' ? 'Returned' : 'Rejected'} (${request.requestNumber})`,
          description: `${req.user!.role} (${req.user!.fullName}) marked as ${action}. Remarks: ${remarks || 'None'}`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });

      // Cross-Module: Notification to cadet
      await tx.notification.create({
        data: {
          userId: request.cadetId,
          title: `Request Update: ${request.requestNumber}`,
          message: `Your ${request.requestType.replace('_', ' ')} request was marked as ${action} by ${req.user!.role}. Remarks: ${remarks || 'None'}`,
        },
      });

      return u;
    });

    res.json({
      success: true,
      message: `Request ${request.requestNumber} successfully updated to ${nextStatus}.`,
      request: updated,
    });
  } catch (error) {
    console.error('processRequestAction error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request action' });
  }
};

// ============================================================
// OFFICIAL INQUIRIES & REPLIES SYSTEM (CADET <-> OFFICERS)
// ============================================================

const generateInquiryNumber = async (): Promise<string> => {
  const count = await prisma.request.count({
    where: { requestType: 'OFFICIAL_INQUIRY' },
  });
  const year = new Date().getFullYear();
  const padded = String(count + 1).padStart(6, '0');
  return `INQ-${year}-${padded}`;
};

const sanitizeText = (input: string): string => {
  if (!input) return '';
  return String(input)
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, (tag) => ({ '<': '&lt;', '>': '&gt;' }[tag] || tag));
};

// 6. Cadet submits official inquiry from Command Desk
export const submitOfficialInquiry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required to submit official inquiry.' });
      return;
    }

    const { subject, message, title, description, priority } = req.body;
    const finalSubject = sanitizeText(subject || title);
    const finalMessage = sanitizeText(message || description);

    if (!finalSubject || finalSubject.length < 3) {
      res.status(400).json({ success: false, message: 'Please provide a valid inquiry subject (minimum 3 characters).' });
      return;
    }

    if (finalSubject.length > 200) {
      res.status(400).json({ success: false, message: 'Inquiry subject exceeds maximum length of 200 characters.' });
      return;
    }

    if (!finalMessage || finalMessage.length < 5) {
      res.status(400).json({ success: false, message: 'Message content cannot be empty (minimum 5 characters).' });
      return;
    }

    if (finalMessage.length > 5000) {
      res.status(400).json({ success: false, message: 'Message content exceeds maximum length of 5000 characters.' });
      return;
    }

    const inquiryNumber = await generateInquiryNumber();

    let initialReviewerRole: Role = Role.SENIOR;
    const seniorAssignment = await prisma.seniorAssignment.findUnique({
      where: { cadetId: req.user.id },
      include: { senior: true },
    });

    let reviewerId: string | null = null;
    if (seniorAssignment) {
      reviewerId = seniorAssignment.seniorId;
      initialReviewerRole = Role.SENIOR;
    } else {
      initialReviewerRole = Role.PLATOON_SENIOR;
    }

    const metadata = JSON.stringify({
      cadetName: req.user.fullName,
      cadetRank: req.user.role === 'CADET' ? 'Cadet (CDT)' : req.user.role,
      regimentalNumber: req.user.regimentalNumber,
      institutionalEmail: req.user.email,
      platoonName: req.user.platoonName,
      submittedAt: new Date().toISOString(),
    });

    const newInquiry = await prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          requestNumber: inquiryNumber,
          requestType: 'OFFICIAL_INQUIRY',
          cadetId: req.user!.id,
          title: finalSubject,
          description: finalMessage,
          priority: priority || 'NORMAL',
          status: 'SUBMITTED',
          currentReviewerRole: initialReviewerRole,
          currentReviewerId: reviewerId,
          metadata,
        },
      });

      await tx.requestHistoryRecord.create({
        data: {
          requestId: created.id,
          officerId: req.user!.id,
          officerRole: req.user!.role,
          action: 'SUBMIT',
          remarks: 'Official Inquiry submitted to Command Desk ledger',
          previousStatus: 'NEW',
          newStatus: 'SUBMITTED',
        },
      });

      await tx.timelineEvent.create({
        data: {
          cadetId: req.user!.id,
          category: 'REQUEST',
          title: `Official Inquiry Filed (${inquiryNumber})`,
          description: `Subject: ${finalSubject}`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          action: 'INQUIRY_SUBMITTED',
          targetType: 'Request',
          targetId: created.id,
          details: `Filed inquiry ${inquiryNumber}: "${finalSubject}" by Cadet ${req.user!.fullName} (${req.user!.regimentalNumber})`,
        },
      });

      if (seniorAssignment) {
        await tx.notification.create({
          data: {
            userId: seniorAssignment.seniorId,
            title: `NEW OFFICIAL INQUIRY: ${inquiryNumber}`,
            message: `Cadet ${req.user!.fullName} (${req.user!.regimentalNumber}) submitted: "${finalSubject}"`,
            isUrgent: priority === 'HIGH' || priority === 'URGENT',
          },
        });
      }

      await tx.notification.create({
        data: {
          targetRole: Role.PLATOON_SENIOR,
          title: `NEW OFFICIAL INQUIRY: ${inquiryNumber}`,
          message: `Cadet ${req.user!.fullName} (${req.user!.regimentalNumber}, Platoon ${req.user!.platoonName}) submitted: "${finalSubject}"`,
          isUrgent: priority === 'HIGH' || priority === 'URGENT',
        },
      });

      await tx.notification.create({
        data: {
          targetRole: Role.ADMIN_ANO,
          title: `OFFICIAL INQUIRY LOGGED: ${inquiryNumber}`,
          message: `Cadet ${req.user!.fullName} submitted: "${finalSubject}"`,
          isUrgent: priority === 'HIGH' || priority === 'URGENT',
        },
      });

      return created;
    });

    res.status(201).json({
      success: true,
      inquiryId: inquiryNumber,
      message: 'Official inquiry submitted successfully.',
      inquiry: newInquiry,
    });
  } catch (error) {
    console.error('submitOfficialInquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit official inquiry' });
  }
};

// 7. Get Inquiry List with Server-Side RBAC Scoping, Search & Status Filters
export const getInquiryList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { search, status } = req.query;
    const whereClause: any = {
      requestType: 'OFFICIAL_INQUIRY',
    };

    // Role-based scoping
    if (req.user.role === 'CADET') {
      whereClause.cadetId = req.user.id;
    } else if (req.user.role === 'SENIOR') {
      const assignments = await prisma.seniorAssignment.findMany({
        where: { seniorId: req.user.id },
        select: { cadetId: true },
      });
      const cadetIds = assignments.map((a) => a.cadetId);
      whereClause.OR = [
        { cadetId: { in: cadetIds } },
        { currentReviewerId: req.user.id },
        { cadetId: req.user.id },
      ];
    } else if (req.user.role === 'PLATOON_SENIOR') {
      const platoonCadets = await prisma.user.findMany({
        where: { platoonName: req.user.platoonName },
        select: { id: true },
      });
      const cadetIds = platoonCadets.map((c) => c.id);
      whereClause.OR = [
        { cadetId: { in: cadetIds } },
        { cadetId: req.user.id },
      ];
    }
    // ADMIN_ANO sees all inquiries

    // Status filter
    if (status && status !== 'ALL') {
      whereClause.status = String(status);
    }

    // Search filter
    if (search && String(search).trim()) {
      const query = String(search).trim();
      const searchCondition = {
        OR: [
          { requestNumber: { contains: query, mode: 'insensitive' as const } },
          { title: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
          { cadet: { fullName: { contains: query, mode: 'insensitive' as const } } },
          { cadet: { regimentalNumber: { contains: query, mode: 'insensitive' as const } } },
        ],
      };

      if (whereClause.OR) {
        whereClause.AND = [searchCondition];
      } else {
        whereClause.OR = searchCondition.OR;
      }
    }

    const inquiries = await prisma.request.findMany({
      where: whereClause,
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            email: true,
            phone: true,
            platoonName: true,
            role: true,
          },
        },
        replies: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      count: inquiries.length,
      inquiries,
    });
  } catch (error) {
    console.error('getInquiryList error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve inquiries' });
  }
};

// 8. Get complete conversation thread for an inquiry
export const getInquiryThread = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const inquiry = await prisma.request.findFirst({
      where: {
        OR: [{ id: String(id) }, { requestNumber: String(id) }],
        requestType: 'OFFICIAL_INQUIRY',
      },
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            email: true,
            phone: true,
            platoonName: true,
            role: true,
          },
        },
        replies: {
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                role: true,
                regimentalNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          include: {
            officer: {
              select: {
                id: true,
                fullName: true,
                role: true,
                regimentalNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!inquiry) {
      res.status(404).json({ success: false, message: 'Official inquiry not found' });
      return;
    }

    // Server-side RBAC validation
    if (req.user.role === 'CADET' && inquiry.cadetId !== req.user.id) {
      res.status(403).json({ success: false, message: 'Unauthorized access to this inquiry thread' });
      return;
    }

    if (req.user.role === 'SENIOR') {
      const isAssigned = await prisma.seniorAssignment.findFirst({
        where: { seniorId: req.user.id, cadetId: inquiry.cadetId },
      });
      if (!isAssigned && inquiry.cadetId !== req.user.id && inquiry.currentReviewerId !== req.user.id) {
        res.status(403).json({ success: false, message: 'Inquiry outside your assigned squad mentorship scope' });
        return;
      }
    }

    if (req.user.role === 'PLATOON_SENIOR') {
      const cadetUser = await prisma.user.findUnique({ where: { id: inquiry.cadetId } });
      if (cadetUser && cadetUser.platoonName !== req.user.platoonName && inquiry.cadetId !== req.user.id) {
        res.status(403).json({ success: false, message: 'Inquiry outside your authorized platoon command scope' });
        return;
      }
    }

    res.json({
      success: true,
      inquiry,
    });
  } catch (error) {
    console.error('getInquiryThread error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve inquiry thread' });
  }
};

// 9. Reply to Inquiry (Cadet Follow-up or Officer Reply)
export const replyToInquiry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { message } = req.body;
    const sanitizedMsg = sanitizeText(message);

    if (!sanitizedMsg || sanitizedMsg.length < 2) {
      res.status(400).json({ success: false, message: 'Reply message cannot be empty.' });
      return;
    }

    if (sanitizedMsg.length > 5000) {
      res.status(400).json({ success: false, message: 'Reply exceeds maximum length of 5000 characters.' });
      return;
    }

    const inquiry = await prisma.request.findFirst({
      where: {
        OR: [{ id: String(id) }, { requestNumber: String(id) }],
        requestType: 'OFFICIAL_INQUIRY',
      },
      include: { cadet: true },
    });

    if (!inquiry) {
      res.status(404).json({ success: false, message: 'Inquiry not found' });
      return;
    }

    if (inquiry.status === 'CLOSED') {
      res.status(400).json({ success: false, message: 'This inquiry thread has been CLOSED. Further replies are disabled.' });
      return;
    }

    // RBAC validation
    if (req.user.role === 'CADET' && inquiry.cadetId !== req.user.id) {
      res.status(403).json({ success: false, message: 'Unauthorized to reply to this inquiry' });
      return;
    }

    if (req.user.role === 'SENIOR') {
      const isAssigned = await prisma.seniorAssignment.findFirst({
        where: { seniorId: req.user.id, cadetId: inquiry.cadetId },
      });
      if (!isAssigned && inquiry.cadetId !== req.user.id && inquiry.currentReviewerId !== req.user.id) {
        res.status(403).json({ success: false, message: 'Unauthorized to reply outside your assigned squad scope' });
        return;
      }
    }

    if (req.user.role === 'PLATOON_SENIOR') {
      if (inquiry.cadet.platoonName !== req.user.platoonName && inquiry.cadetId !== req.user.id) {
        res.status(403).json({ success: false, message: 'Unauthorized to reply outside your assigned platoon scope' });
        return;
      }
    }

    const isCadet = req.user.role === 'CADET';
    const nextStatus = isCadet ? 'UNDER_REVIEW' : 'REPLIED';

    const result = await prisma.$transaction(async (tx) => {
      const reply = await tx.inquiryReply.create({
        data: {
          requestId: inquiry.id,
          senderId: req.user!.id,
          senderName: req.user!.fullName,
          senderRole: req.user!.role,
          message: sanitizedMsg,
        },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              role: true,
              regimentalNumber: true,
            },
          },
        },
      });

      await tx.request.update({
        where: { id: inquiry.id },
        data: {
          status: nextStatus,
          currentReviewerId: isCadet ? inquiry.currentReviewerId : req.user!.id,
          updatedAt: new Date(),
        },
      });

      await tx.requestHistoryRecord.create({
        data: {
          requestId: inquiry.id,
          officerId: req.user!.id,
          officerRole: req.user!.role,
          action: isCadet ? 'CADET_FOLLOWUP' : 'OFFICER_REPLY',
          remarks: sanitizedMsg.slice(0, 150),
          previousStatus: inquiry.status,
          newStatus: nextStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          action: isCadet ? 'INQUIRY_FOLLOWUP_SENT' : 'INQUIRY_REPLY_SENT',
          targetType: 'Request',
          targetId: inquiry.id,
          details: `${req.user!.role} (${req.user!.fullName}) replied on ${inquiry.requestNumber}`,
        },
      });

      await tx.timelineEvent.create({
        data: {
          cadetId: inquiry.cadetId,
          category: 'REQUEST',
          title: `Inquiry Thread Update (${inquiry.requestNumber})`,
          description: `Message from ${req.user!.role} (${req.user!.fullName})`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });

      // Notification
      if (!isCadet) {
        // Officer replied -> Notify cadet
        await tx.notification.create({
          data: {
            userId: inquiry.cadetId,
            title: `OFFICIAL INQUIRY REPLY: ${inquiry.requestNumber}`,
            message: `Your inquiry "${inquiry.title}" has received a reply from ${req.user!.role} (${req.user!.fullName}).`,
          },
        });
      } else {
        // Cadet replied -> Notify senior / reviewer
        if (inquiry.currentReviewerId) {
          await tx.notification.create({
            data: {
              userId: inquiry.currentReviewerId,
              title: `INQUIRY FOLLOW-UP: ${inquiry.requestNumber}`,
              message: `Cadet ${req.user!.fullName} posted a follow-up on "${inquiry.title}".`,
            },
          });
        }
      }

      return reply;
    });

    // Officer replied -> Dispatch institutional email to cadet's registered institutional address (Phase 5C, 5D, 5E)
    if (!isCadet && inquiry.cadet?.email) {
      notifyInquiryReply(
        {
          fullName: inquiry.cadet.fullName,
          email: inquiry.cadet.email,
          regimentalNumber: inquiry.cadet.regimentalNumber,
        },
        {
          requestNumber: inquiry.requestNumber,
          title: inquiry.title,
        },
        sanitizedMsg,
        req.user.role,
        req.user.fullName
      ).catch((err) => {
        console.error('[INQUIRY EMAIL FAILURE - SAFE CATCH]:', err);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Reply recorded successfully.',
      reply: result,
      newStatus: nextStatus,
    });

  } catch (error) {
    console.error('replyToInquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to record reply' });
  }
};

// 10. Update Inquiry Status (Resolve, Close, Forward, Review)
export const updateInquiryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (req.user.role === 'CADET') {
      res.status(403).json({ success: false, message: 'Cadets are not authorized to alter official inquiry statuses.' });
      return;
    }

    const { id } = req.params;
    const { status, remarks, forwardToRole } = req.body;

    const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'REPLIED', 'FORWARDED', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid inquiry status specified' });
      return;
    }

    const inquiry = await prisma.request.findFirst({
      where: {
        OR: [{ id: String(id) }, { requestNumber: String(id) }],
        requestType: 'OFFICIAL_INQUIRY',
      },
      include: { cadet: true },
    });

    if (!inquiry) {
      res.status(404).json({ success: false, message: 'Inquiry not found' });
      return;
    }

    let nextReviewerRole: Role | null = inquiry.currentReviewerRole;
    if (status === 'FORWARDED') {
      if (req.user.role === 'SENIOR') {
        nextReviewerRole = Role.PLATOON_SENIOR;
      } else if (req.user.role === 'PLATOON_SENIOR') {
        nextReviewerRole = Role.ADMIN_ANO;
      } else if (forwardToRole) {
        nextReviewerRole = forwardToRole;
      }
    } else if (status === 'RESOLVED' || status === 'CLOSED') {
      nextReviewerRole = null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.request.update({
        where: { id: inquiry.id },
        data: {
          status,
          currentReviewerRole: nextReviewerRole,
          currentReviewerId: req.user!.id,
          updatedAt: new Date(),
        },
      });

      await tx.requestHistoryRecord.create({
        data: {
          requestId: inquiry.id,
          officerId: req.user!.id,
          officerRole: req.user!.role,
          action: status === 'RESOLVED' ? 'RESOLVE' : status === 'CLOSED' ? 'CLOSE' : status === 'FORWARDED' ? 'FORWARD' : 'STATUS_UPDATE',
          remarks: remarks ? String(remarks).trim() : `Status marked as ${status}`,
          previousStatus: inquiry.status,
          newStatus: status,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          action: 'INQUIRY_STATUS_CHANGED',
          targetType: 'Request',
          targetId: inquiry.id,
          details: `Inquiry ${inquiry.requestNumber} status changed from ${inquiry.status} to ${status} by ${req.user!.role} (${req.user!.fullName})`,
        },
      });

      await tx.notification.create({
        data: {
          userId: inquiry.cadetId,
          title: `INQUIRY STATUS UPDATE: ${inquiry.requestNumber}`,
          message: `Your inquiry "${inquiry.title}" is now marked as ${status.replace('_', ' ')}.`,
        },
      });

      return u;
    });

    res.json({
      success: true,
      message: `Inquiry ${inquiry.requestNumber} status updated to ${status}.`,
      inquiry: updated,
    });
  } catch (error) {
    console.error('updateInquiryStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update inquiry status' });
  }
};
