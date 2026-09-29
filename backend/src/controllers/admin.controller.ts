import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { Role, AccountStatus } from '@prisma/client';

// 1. List Users with Search, Role, Status, and Platoon Filters
export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, role, status, platoon, year, rank, team, faceEnrolled, page, pageSize } = req.query;

    const whereClause: any = {};

    if (role) {
      whereClause.role = role as Role;
    } else {
      // Cadet Directory defaults to listing enrolled CADETs
      whereClause.role = Role.CADET;
    }

    if (status) {
      const allowedStatuses = Object.values(AccountStatus) as string[];
      if (!allowedStatuses.includes(String(status))) {
        res.status(400).json({ success: false, message: 'Invalid cadet status filter' });
        return;
      }
      whereClause.status = status as AccountStatus;
    }

    if (platoon) {
      whereClause.platoonName = platoon as string;
    }

    if (year) whereClause.year = { contains: String(year), mode: 'insensitive' };
    if (rank) whereClause.rank = String(rank);
    if (team) whereClause.team = String(team);
    if (faceEnrolled === 'true') whereClause.biometricTemplate = { isNot: null };
    if (faceEnrolled === 'false') whereClause.biometricTemplate = { is: null };

    if (search) {
      const q = String(search).trim();
      whereClause.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { regimentalNumber: { contains: q, mode: 'insensitive' } },
        { collegeRollNumber: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { year: { contains: q, mode: 'insensitive' } },
        { branch: { contains: q, mode: 'insensitive' } },
        { platoonName: { contains: q, mode: 'insensitive' } },
        { team: { contains: q, mode: 'insensitive' } },
        { rank: { contains: q, mode: 'insensitive' } },
      ];
    }

    const pageNumber = Math.max(1, Number.parseInt(String(page || '1'), 10) || 1);
    const take = String(req.query.export || '') === 'csv' ? 20000 : Math.min(100, Math.max(1, Number.parseInt(String(pageSize || '50'), 10) || 50));
    const [users, total, totalActiveCadets] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip: (pageNumber - 1) * take,
        take,
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
          role: true,
          status: true,
          rank: true,
          dateOfJoining: true,
          createdAt: true,
          mentorAssignment: {
            include: {
              senior: {
                select: { id: true, fullName: true, regimentalNumber: true, role: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: whereClause }),
      prisma.user.count({
        where: { role: Role.CADET, status: AccountStatus.ACTIVE },
      }),
    ]);

    res.json({ success: true, count: users.length, total, page: pageNumber, pageSize: take, totalPages: Math.ceil(total / take), totalActiveCadets, users });
  } catch (error) {
    console.error('listUsers error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve unit personnel' });
  }
};

// 2. Change Role (Admin/ANO only, users cannot change their own role)
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    // Critical rule: Users cannot modify their own roles
    if (req.user.id === id) {
      res.status(403).json({
        success: false,
        message: 'Security Violation: Commanders cannot modify their own administrative role.',
      });
      return;
    }

    if (!role || !Object.values(Role).includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role specified' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: { role },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        role: true,
        status: true,
      },
    });

    res.json({
      success: true,
      message: `Role for ${updated.fullName} updated to ${updated.role}.`,
      user: updated,
    });
  } catch (error) {
    console.error('updateUserRole error:', error);
    res.status(500).json({ success: false, message: 'Failed to update cadet role' });
  }
};

// 3. Change Account Status (Deactivate, Hold, Mark Passed Out, Activate)
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(AccountStatus).includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status specified' });
      return;
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: String(id) },
      select: { role: true, status: true },
    });
    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const lifecycleStatuses = ['INACTIVE', 'PASSED_OUT'];
    if (currentUser.role === 'CADET'
      && currentUser.status !== status
      && (lifecycleStatuses.includes(currentUser.status) || lifecycleStatuses.includes(status))) {
      res.status(409).json({
        success: false,
        message: 'Use the audited cadet lifecycle action to deactivate, pass out, or reactivate a cadet.',
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: { status },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        role: true,
        status: true,
      },
    });

    res.json({
      success: true,
      message: `Status for ${updated.fullName} updated to ${updated.status}.`,
      user: updated,
    });
  } catch (error) {
    console.error('updateUserStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update account status' });
  }
};

// 4. Transfer Cadet to Platoon
export const transferCadetPlatoon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { platoonName } = req.body;

    if (!platoonName) {
      res.status(400).json({ success: false, message: 'Platoon name is required' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: { platoonName },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        platoonName: true,
      },
    });

    res.json({
      success: true,
      message: `Cadet ${updated.fullName} transferred to ${updated.platoonName}.`,
      user: updated,
    });
  } catch (error) {
    console.error('transferCadetPlatoon error:', error);
    res.status(500).json({ success: false, message: 'Failed to transfer cadet platoon' });
  }
};

// 5. Senior Assignment (Assign Cadet to a Senior Mentor)
export const assignCadetToSenior = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cadetId, seniorId } = req.body;

    if (!cadetId) {
      res.status(400).json({ success: false, message: 'cadetId is required' });
      return;
    }

    if (seniorId === 'UNASSIGN' || !seniorId) {
      await prisma.seniorAssignment.deleteMany({
        where: { cadetId },
      });
      res.json({
        success: true,
        message: 'Cadet mentor assignment cleared successfully.',
      });
      return;
    }

    // Verify senior has SENIOR or PLATOON_SENIOR role
    const senior = await prisma.user.findUnique({
      where: { id: seniorId },
    });

    if (!senior || (senior.role !== 'SENIOR' && senior.role !== 'PLATOON_SENIOR')) {
      res.status(400).json({
        success: false,
        message: 'Designated mentor must hold SENIOR or PLATOON_SENIOR rank.',
      });
      return;
    }

    const assignment = await prisma.seniorAssignment.upsert({
      where: { cadetId },
      update: { seniorId },
      create: { cadetId, seniorId },
      include: {
        cadet: { select: { fullName: true, regimentalNumber: true } },
        senior: { select: { fullName: true, regimentalNumber: true } },
      },
    });

    res.json({
      success: true,
      message: `Cadet ${assignment.cadet.fullName} successfully assigned under Senior ${assignment.senior.fullName}.`,
      assignment,
    });
  } catch (error) {
    console.error('assignCadetToSenior error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign cadet mentor' });
  }
};

// 6. Platoon Senior Assignment (Assign Platoon Senior to Command a Platoon)
export const assignPlatoonSenior = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { platoonSeniorId, platoonId } = req.body;

    if (!platoonSeniorId || !platoonId) {
      res.status(400).json({ success: false, message: 'platoonSeniorId and platoonId are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: platoonSeniorId },
    });

    if (!user || user.role !== 'PLATOON_SENIOR') {
      res.status(400).json({
        success: false,
        message: 'Assigned commander must have PLATOON_SENIOR role.',
      });
      return;
    }

    const assignment = await prisma.platoonSeniorAssignment.upsert({
      where: {
        platoonSeniorId_platoonId: { platoonSeniorId, platoonId },
      },
      update: {},
      create: { platoonSeniorId, platoonId },
      include: {
        platoon: true,
        platoonSenior: { select: { fullName: true, regimentalNumber: true } },
      },
    });

    res.json({
      success: true,
      message: `${assignment.platoonSenior.fullName} designated as Platoon Senior for ${assignment.platoon.name}.`,
      assignment,
    });
  } catch (error) {
    console.error('assignPlatoonSenior error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign platoon senior' });
  }
};

// 7. ANO / Admin Command Center Dashboard Summary (Zero Analytics / Zero Reports)
export const getAdminDashboardSummary = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalStrength,
      activeCadets,
      totalCadets,
      seniors,
      platoonSeniors,
      pendingRegistrations,
      pendingLeaves,
      upcomingCamps,
      upcomingEvents,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { status: { in: ['APPROVED', 'ACTIVE'] } } }),
      prisma.user.count({ where: { role: 'CADET', status: { in: ['APPROVED', 'ACTIVE'] } } }),
      prisma.user.count({ where: { role: 'CADET' } }),
      prisma.user.count({ where: { role: 'SENIOR', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'PLATOON_SENIOR', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'CADET', status: { in: ['UNDER_REVIEW', 'HOLD'] } } }),
      prisma.leave.count({ where: { status: 'PENDING' } }),
      prisma.camp.count({ where: { startDate: { gte: new Date() } } }),
      prisma.event.count({ where: { eventDate: { gte: new Date() }, status: 'PUBLISHED' } }),
      prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
      success: true,
      summary: {
        totalStrength,
        activeCadets,
        totalCadets,
        approvedCadets: activeCadets,
        seniors,
        platoonSeniors,
        drillInstructors: 0,
        pendingRegistrations,
        pendingLeaves,
        upcomingCamps,
        upcomingEvents,
        recentAuditLogs,
      },
    });
  } catch (error) {
    console.error('getAdminDashboardSummary error:', error);
    res.status(500).json({ success: false, message: 'Failed to load command summary' });
  }
};

// 8. Leave Management: List and Decide
export const getAdminLeaves = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leaves = await prisma.leave.findMany({
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            platoonName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, count: leaves.length, leaves });
  } catch (error) {
    console.error('getAdminLeaves error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaves' });
  }
};

export const decideCadetLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!['APPROVED', 'REJECTED', 'HOLD'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid leave decision' });
      return;
    }

    const leave = await prisma.leave.update({
      where: { id: String(id) },
      data: {
        status,
        remarks,
        finalDecisionBy: req.user?.fullName || 'ANO Command',
      },
      include: { cadet: { select: { fullName: true } } },
    });

    // Record audit log
    if (req.user) {
      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorName: req.user.fullName,
          action: `LEAVE_${status}`,
          targetType: 'LEAVE',
          targetId: leave.id,
          details: `Leave for ${leave.cadet.fullName} marked as ${status}.`,
        },
      });
    }

    res.json({
      success: true,
      message: `Leave for ${leave.cadet.fullName} updated to ${status}.`,
      leave,
    });
  } catch (error) {
    console.error('decideCadetLeave error:', error);
    res.status(500).json({ success: false, message: 'Failed to record leave decision' });
  }
};

// 9. Camps Management: Create & Manage
export const getAdminCamps = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    let visibleCadetIds: string[] | undefined;
    if (role === 'CADET') visibleCadetIds = [req.user!.id];
    else if (role === 'SENIOR') {
      const assignments = await prisma.seniorAssignment.findMany({ where: { seniorId: req.user!.id }, select: { cadetId: true } });
      visibleCadetIds = assignments.map((a) => a.cadetId);
    } else if (role === 'PLATOON_SENIOR') {
      const assignments = await prisma.platoonSeniorAssignment.findMany({ where: { platoonSeniorId: req.user!.id }, include: { platoon: { select: { name: true } } } });
      const names = assignments.map((a) => a.platoon.name);
      const cadets = names.length ? await prisma.user.findMany({ where: { role: Role.CADET, platoonName: { in: names } }, select: { id: true } }) : [];
      visibleCadetIds = cadets.map((c) => c.id);
    }
    const camps = await prisma.camp.findMany({
      include: {
        participants: {
          ...(visibleCadetIds ? { where: { cadetId: { in: visibleCadetIds } } } : {}),
          include: {
            cadet: {
              select: { id: true, fullName: true, regimentalNumber: true, platoonName: true },
            },
          },
        },
        documents: true,
      },
      orderBy: { startDate: 'desc' },
    });
    res.json({ success: true, count: camps.length, camps });
  } catch (error) {
    console.error('getAdminCamps error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch camps' });
  }
};

export const createAdminCamp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, campType, location, startDate, endDate, description, capacity, reportingTime, eligibility, instructions, requiredDocuments, assignedOfficers, status, reportingVenue, eligibleYears, targetPlatoon, targetTeam } = req.body;

    if (!name || !campType || !location || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Missing mandatory camp fields' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const allowedCampStatuses = ['DRAFT', 'OPEN', 'SELECTION_IN_PROGRESS', 'SELECTED', 'ONGOING', 'COMPLETED', 'CANCELLED'];
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || (status && !allowedCampStatuses.includes(String(status)))) {
      res.status(400).json({ success: false, message: 'Invalid camp dates or status' });
      return;
    }

    const camp = await prisma.$transaction(async (tx) => {
      const c = await tx.camp.create({
        data: {
          name: name.trim(),
          campType: campType.trim(),
          location: location.trim(),
          startDate: start,
          endDate: end,
          description: description ? description.trim() : null,
          capacity: capacity ? Number(capacity) : 50,
          reportingTime: reportingTime ? String(reportingTime).trim() : '06:00 hrs',
          eligibility: eligibility ? String(eligibility).trim() : 'Open to all active cadets with >= 75% attendance',
          instructions: instructions ? String(instructions).trim() : null,
          requiredDocuments: requiredDocuments ? String(requiredDocuments).trim() : 'Medical Certificate, Indemnity Bond, College ID',
          assignedOfficers: assignedOfficers ? String(assignedOfficers).trim() : null,
          status: status || 'OPEN',
          reportingVenue: reportingVenue ? String(reportingVenue).trim() : null,
          eligibleYears: eligibleYears ? String(eligibleYears).trim() : null,
          targetPlatoon: targetPlatoon ? String(targetPlatoon).trim() : null,
          targetTeam: targetTeam ? String(targetTeam).trim() : null,
        },
      });

      // Cross-Module Integration: Auto-link to Central NCC Calendar
      await tx.event.create({
        data: {
          title: `⛺ ${c.name} (${c.campType})`,
          description: c.description || `Location: ${c.location}. Capacity: ${c.capacity} cadets. Eligibility: ${c.eligibility}`,
          eventType: 'CAMP',
          eventDate: start,
          startTime: c.reportingTime || '06:00 hrs',
          location: c.location,
          isPublic: (status || 'OPEN') !== 'DRAFT',
          status: 'PUBLISHED',
          referenceType: 'CAMP',
          referenceId: c.id,
          organizer: c.assignedOfficers || 'Unit Command / DGNCC',
        },
      });

      if (req.user) {
        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            actorName: req.user.fullName,
            action: 'CAMP_CREATED',
            targetType: 'CAMP',
            targetId: c.id,
            details: `Camp "${c.name}" scheduled at ${c.location}. Auto-linked to Central Calendar.`,
          },
        });
      }

      return c;
    });

    res.status(201).json({ success: true, message: `Camp ${camp.name} created and synced to Central Calendar.`, camp });
  } catch (error) {
    console.error('createAdminCamp error:', error);
    res.status(500).json({ success: false, message: 'Failed to create camp' });
  }
};

// Cadet applies for camp participation
export const applyForCamp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params; // campId
    const camp = await prisma.camp.findUnique({ where: { id: String(id) } });

    if (!camp) {
      res.status(404).json({ success: false, message: 'Camp record not found' });
      return;
    }

    if (camp.status !== 'OPEN') {
      res.status(409).json({ success: false, message: 'This camp is not open for applications' });
      return;
    }

    const cadet = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true, status: true, year: true, platoonName: true, team: true } });
    if (!cadet || cadet.role !== Role.CADET || !['ACTIVE', 'APPROVED'].includes(cadet.status)) {
      res.status(403).json({ success: false, message: 'Only active cadets can apply' });
      return;
    }
    const eligibleYears = camp.eligibleYears?.split(',').map((year) => year.trim().toUpperCase()).filter(Boolean) || [];
    if ((eligibleYears.length && !eligibleYears.some((year) => cadet.year.toUpperCase().includes(year))) || (camp.targetPlatoon && cadet.platoonName !== camp.targetPlatoon) || (camp.targetTeam && cadet.team !== camp.targetTeam)) {
      res.status(403).json({ success: false, message: 'Your year, platoon, or team is not eligible for this camp' });
      return;
    }

    // Check existing application
    const existing = await prisma.campParticipant.findUnique({
      where: { campId_cadetId: { campId: camp.id, cadetId: req.user.id } },
    });

    if (existing) {
      res.status(400).json({ success: false, message: `Application already filed. Current status: ${existing.status}` });
      return;
    }

    const currentSelections = await prisma.campParticipant.count({
      where: { campId: camp.id, status: { in: ['APPLIED', 'RECOMMENDED', 'SELECTED', 'CONFIRMED', 'PARTICIPATED', 'COMPLETED'] } },
    });
    const applicationStatus = currentSelections >= camp.capacity ? 'WAITLISTED' : 'APPLIED';

    const participant = await prisma.$transaction(async (tx) => {
      const p = await tx.campParticipant.create({
        data: {
          campId: camp.id,
          cadetId: req.user!.id,
          status: applicationStatus,
        },
      });

      await tx.timelineEvent.create({
        data: {
          cadetId: req.user!.id,
          category: 'CAMP',
          title: applicationStatus === 'WAITLISTED' ? 'Camp Waiting List' : 'Camp Participation Application Filed',
          description: `${applicationStatus === 'WAITLISTED' ? 'Placed on waiting list for' : 'Applied for'} ${camp.name} (${camp.campType}) at ${camp.location}.`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });

      return p;
    });

    res.status(201).json({
      success: true,
      message: applicationStatus === 'WAITLISTED' ? `Camp capacity has been reached. You are on the waiting list for ${camp.name}.` : `Successfully registered nomination for ${camp.name}. Current status: APPLIED (Awaiting Review).`,
      participant,
    });
  } catch (error) {
    console.error('applyForCamp error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply for camp' });
  }
};

// Officers update camp participant status (RECOMMENDED, SELECTED, CONFIRMED, PARTICIPATED, COMPLETED, REJECTED)
export const updateCampParticipantStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'CADET') {
      res.status(403).json({ success: false, message: 'Only authorized officers can update participant status' });
      return;
    }

    const { campId, cadetId } = req.params;
    const { status, remarks } = req.body;

    const validStatuses = ['APPLIED', 'RECOMMENDED', 'SELECTED', 'WAITLISTED', 'CONFIRMED', 'PARTICIPATED', 'COMPLETED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid camp participant status' });
      return;
    }

    const camp = await prisma.camp.findUnique({ where: { id: String(campId) } });
    if (!camp) {
      res.status(404).json({ success: false, message: 'Camp record not found' });
      return;
    }

    if (req.user.role === 'SENIOR') {
      const assignment = await prisma.seniorAssignment.findUnique({ where: { cadetId: String(cadetId) }, select: { seniorId: true } });
      if (assignment?.seniorId !== req.user.id) {
        res.status(403).json({ success: false, message: 'Cadet is outside your assigned scope' });
        return;
      }
    }
    if (req.user.role === 'PLATOON_SENIOR') {
      const [cadet, assignments] = await Promise.all([
        prisma.user.findUnique({ where: { id: String(cadetId) }, select: { platoonName: true } }),
        prisma.platoonSeniorAssignment.findMany({ where: { platoonSeniorId: req.user.id }, include: { platoon: { select: { name: true } } } }),
      ]);
      if (!cadet?.platoonName || !assignments.some((assignment) => assignment.platoon.name === cadet.platoonName)) {
        res.status(403).json({ success: false, message: 'Cadet is outside your assigned platoon scope' });
        return;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.campParticipant.update({
        where: { campId_cadetId: { campId: String(campId), cadetId: String(cadetId) } },
        data: { status, remarks: remarks ? String(remarks).trim() : null },
        include: { cadet: { select: { fullName: true, regimentalNumber: true } } },
      });

      // Cross-Module: Timeline
      await tx.timelineEvent.create({
        data: {
          cadetId: String(cadetId),
          category: 'CAMP',
          title: `Camp Status: ${status} (${camp.name})`,
          description: `${req.user!.role} (${req.user!.fullName}) updated status to ${status}. Remarks: ${remarks || 'None'}`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });
      await tx.auditLog.create({ data: { actorId: req.user!.id, actorName: req.user!.fullName, action: 'CAMP_PARTICIPANT_STATUS_UPDATED', targetType: 'CAMP_PARTICIPANT', targetId: p.id, details: `${camp.name}: ${p.cadet.fullName} -> ${status}` } });

      // Cross-Module: Notification to cadet
      await tx.notification.create({
        data: {
          userId: String(cadetId),
          title: `Camp Nomination Update: ${camp.name}`,
          message: `Your nomination status is now ${status}. Remarks: ${remarks || 'None'}`,
        },
      });

      return p;
    });

    res.json({
      success: true,
      message: `Participant status updated to ${status} successfully.`,
      participant: updated,
    });
  } catch (error) {
    console.error('updateCampParticipantStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update camp participant status' });
  }
};

export const updateCampStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const statuses = ['DRAFT', 'OPEN', 'SELECTION_IN_PROGRESS', 'SELECTED', 'ONGOING', 'COMPLETED', 'CANCELLED'];
  const { status } = req.body;
  if (!req.user || req.user.role !== 'ADMIN_ANO') { res.status(403).json({ success: false, message: 'Admin access required' }); return; }
  if (!statuses.includes(status)) { res.status(400).json({ success: false, message: 'Invalid camp status' }); return; }
  try {
    const camp = await prisma.$transaction(async (tx) => {
      const updated = await tx.camp.update({ where: { id: String(req.params.id) }, data: { status } });
      await tx.event.updateMany({ where: { referenceType: 'CAMP', referenceId: updated.id }, data: { isPublic: status !== 'DRAFT', status: status === 'CANCELLED' ? 'CANCELLED' : 'PUBLISHED' } });
      await tx.auditLog.create({ data: { actorId: req.user!.id, actorName: req.user!.fullName, action: 'CAMP_STATUS_UPDATED', targetType: 'CAMP', targetId: updated.id, details: `${updated.name} status set to ${status}` } });
      return updated;
    });
    res.json({ success: true, camp });
  } catch { res.status(404).json({ success: false, message: 'Camp not found' }); }
};

export const addCampDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'ADMIN_ANO') { res.status(403).json({ success: false, message: 'Admin access required' }); return; }
  const title = String(req.body.title || '').trim();
  let url: URL;
  try { url = new URL(String(req.body.url || '')); } catch { res.status(400).json({ success: false, message: 'A valid document URL is required' }); return; }
  if (!title || !['https:', 'http:'].includes(url.protocol)) { res.status(400).json({ success: false, message: 'A title and HTTP(S) URL are required' }); return; }
  try {
    const document = await prisma.campDocument.create({ data: { campId: String(req.params.id), title, url: url.toString() } });
    await prisma.auditLog.create({ data: { actorId: req.user.id, actorName: req.user.fullName, action: 'CAMP_DOCUMENT_ADDED', targetType: 'CAMP', targetId: document.campId, details: `Document added: ${title}` } });
    res.status(201).json({ success: true, document });
  } catch { res.status(404).json({ success: false, message: 'Camp not found' }); }
};

// 10. Events Management: Create & Publish
export const getAdminEvents = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { eventDate: 'desc' },
    });
    res.json({ success: true, count: events.length, events });
  } catch (error) {
    console.error('getAdminEvents error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

export const createAdminEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, eventDate, location, isPublic } = req.body;

    if (!title || !description || !eventDate || !location) {
      res.status(400).json({ success: false, message: 'Missing mandatory event parameters' });
      return;
    }

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        eventDate: new Date(eventDate),
        location: location.trim(),
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
      },
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorName: req.user.fullName,
          action: 'EVENT_CREATED',
          targetType: 'EVENT',
          targetId: event.id,
          details: `Event "${event.title}" published.`,
        },
      });
    }

    res.status(201).json({ success: true, message: `Event ${event.title} published.`, event });
  } catch (error) {
    console.error('createAdminEvent error:', error);
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
};

// 11. Notices Management: Create & Broadcast
export const createAdminNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, category, isPublic, isUrgent, targetRole, targetPlatoon } = req.body;

    if (!title || !content) {
      res.status(400).json({ success: false, message: 'Title and content are required' });
      return;
    }

    const notice = await prisma.notice.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        category: category || 'General',
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
        isUrgent: Boolean(isUrgent),
        targetRole: targetRole || null,
        targetPlatoon: targetPlatoon || null,
      },
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorName: req.user.fullName,
          action: 'NOTICE_PUBLISHED',
          targetType: 'NOTICE',
          targetId: notice.id,
          details: `Notice "${notice.title}" broadcasted.`,
        },
      });
    }

    res.status(201).json({ success: true, message: `Notice "${notice.title}" published.`, notice });
  } catch (error) {
    console.error('createAdminNotice error:', error);
    res.status(500).json({ success: false, message: 'Failed to create notice' });
  }
};

export const getAdminNotices = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notices = await prisma.notice.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, count: notices.length, notices });
  } catch (error) {
    console.error('getAdminNotices error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notices' });
  }
};

export const deleteAdminCamp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.camp.delete({ where: { id: String(id) } });
    res.json({ success: true, message: 'Camp deleted successfully' });
  } catch (error) {
    console.error('deleteAdminCamp error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete camp' });
  }
};

export const deleteAdminEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.event.delete({ where: { id: String(id) } });
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('deleteAdminEvent error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
};

export const deleteAdminNotice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.notice.delete({ where: { id: String(id) } });
    res.json({ success: true, message: 'Notice deleted successfully' });
  } catch (error) {
    console.error('deleteAdminNotice error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notice' });
  }
};


// 12. Audit Logs: List
export const getAdminAuditLogs = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    console.error('getAdminAuditLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};

// 13. Batch Import Cadet Roster from Google Sheets / CSV
export const bulkImportCadets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN_ANO') {
      res.status(403).json({ success: false, message: 'Admin / ANO authorization required' });
      return;
    }

    const { cadets } = req.body;
    if (!Array.isArray(cadets) || cadets.length === 0) {
      res.status(400).json({ success: false, message: 'Array of cadet records is required' });
      return;
    }

    const defaultPasswordHash = await bcrypt.hash('CadetPass@2026', 10);
    let importedCount = 0;
    const errors: string[] = [];

    for (const c of cadets) {
      const regNo = String(c.regimentalNumber || '').trim();
      const rollNo = String(c.collegeRollNumber || '').trim();
      const email = String(c.email || '').trim().toLowerCase();
      const fullName = String(c.fullName || '').trim();

      if (!regNo || !rollNo || !email || !fullName) {
        errors.push(`Row missing mandatory fields: ${fullName || 'Unknown'}`);
        continue;
      }

      // Check duplicate
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ regimentalNumber: regNo }, { collegeRollNumber: rollNo }, { email }],
        },
      });

      if (existing) {
        errors.push(`Cadet ${fullName} (${regNo} / ${rollNo}) already registered`);
        continue;
      }

      await prisma.user.create({
        data: {
          fullName,
          regimentalNumber: regNo,
          collegeRollNumber: rollNo,
          email,
          phone: c.phone ? String(c.phone).trim() : null,
          year: c.year || 'FE (1st Year)',
          branch: c.branch || 'Computer Engineering',
          platoonName: c.platoonName || 'Senior Division',
          passwordHash: defaultPasswordHash,
          role: 'CADET',
          status: 'ACTIVE',
        },
      });

      importedCount++;
    }

    // Log to Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorName: req.user.fullName,
        action: 'BATCH_IMPORT_CADETS',
        targetType: 'CADET_ROSTER',
        details: `Batch imported ${importedCount} cadets from external spreadsheet.`,
      },
    });

    res.json({
      success: true,
      message: `Batch imported ${importedCount} cadets into institutional roster.`,
      importedCount,
      errorsCount: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('bulkImportCadets error:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk import cadets' });
  }
};
