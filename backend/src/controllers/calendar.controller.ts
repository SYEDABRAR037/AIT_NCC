import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

// Helper to seed baseline institutional NCC calendar events if empty
const ensureBaselineEvents = async () => {
  try {
    const eventCount = await prisma.event.count();
    const campCount = await prisma.camp.count();

    if (eventCount === 0 && campCount === 0) {
      // 1. Baseline Camp
      await prisma.camp.create({
        data: {
          name: 'Combined Annual Training Camp (CATC 2026)',
          campType: 'Combined Annual Training Camp',
          location: 'AIT Parade Grounds & Central Barracks, Pune',
          startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          description: '10-day rigorous battalion cadre covering firing, obstacle course, night navigation, and tent pitching.',
          capacity: 120,
          reportingTime: '0600 hrs sharp',
          instructions: 'Cadets must report in full OG uniform with bedding roll, mess tins, and college ID card.',
          assignedOfficers: 'Lt. Col. Sanjeev Sharma (ANO), Subedar Major R. K. Singh (DI)',
        },
      });

      // 2. Baseline Events
      await prisma.event.createMany({
        data: [
          {
            title: 'Independence Day Full Dress Parade Rehearsal',
            description: 'Battalion parade alignment, squad turn, synchronised march past and salute to the National Flag.',
            eventType: 'PARADE',
            eventDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            startTime: '0630 hrs',
            endTime: '0830 hrs',
            location: 'AIT Central Parade Grounds',
            organizer: 'Drill Instructor Wing',
            isPublic: true,
            status: 'PUBLISHED',
          },
          {
            title: 'Advanced Marksmanship & .22 Rifle Handling Cadre',
            description: 'Theoretical ballistic fundamentals, weapon stripping, cleaning, sight setting, and dry firing practice.',
            eventType: 'TRAINING',
            eventDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
            startTime: '1530 hrs',
            endTime: '1730 hrs',
            location: 'Station Short Range Arena',
            organizer: 'AIT NCC Unit Command',
            isPublic: true,
            status: 'PUBLISHED',
          },
          {
            title: 'National Cadet Corps Raising Day Celebration',
            description: 'Annual battalion address, ceremonial parade, flag hoisting, and distribution of merit honours.',
            eventType: 'ACTIVITY',
            eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            startTime: '0900 hrs',
            endTime: '1230 hrs',
            location: 'Manekshaw Auditorium',
            organizer: 'Lt. Col. Sanjeev Sharma (ANO)',
            isPublic: true,
            status: 'PUBLISHED',
          },
        ],
      });
    }
  } catch (err) {
    console.error('ensureBaselineEvents error:', err);
  }
};

// 1. Get Unified Central NCC Calendar Stream
// Aggregates Camps, Training Sessions, Duties, and Events
export const getCalendarStream = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    await ensureBaselineEvents();

    const { startDate, endDate, eventType } = req.query;

    const startFilter = startDate ? new Date(String(startDate)) : new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const endFilter = endDate ? new Date(String(endDate)) : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Fetch Events
    const events = await prisma.event.findMany({
      where: {
        eventDate: { gte: startFilter, lte: endFilter },
        status: 'PUBLISHED',
      },
      orderBy: { eventDate: 'asc' },
    });

    // Fetch Camps
    const camps = await prisma.camp.findMany({
      where: {
        startDate: { lte: endFilter },
        endDate: { gte: startFilter },
      },
      orderBy: { startDate: 'asc' },
    });

    // Fetch Training Sessions
    const sessions = await prisma.trainingSession.findMany({
      where: {
        date: { gte: startFilter, lte: endFilter },
      },
      orderBy: { date: 'asc' },
    });

    // Fetch Duties (Cadet sees their own, officers see unit duties)
    const dutyWhere: any = {
      dutyDate: { gte: startFilter, lte: endFilter },
    };
    if (req.user.role === 'CADET') {
      dutyWhere.assignedCadetId = req.user.id;
    } else if (req.user.role === 'PLATOON_SENIOR') {
      if (req.user.platoonName) {
        const cadets = await prisma.user.findMany({
          where: { platoonName: req.user.platoonName, role: 'CADET' },
          select: { id: true },
        });
        dutyWhere.assignedCadetId = { in: cadets.map((c) => c.id) };
      }
    } else if (req.user.role === 'SENIOR') {
      const assignments = await prisma.seniorAssignment.findMany({
        where: { seniorId: req.user.id },
        select: { cadetId: true },
      });
      const assignedIds = assignments.map((a) => a.cadetId);
      if (assignedIds.length > 0) {
        dutyWhere.assignedCadetId = { in: assignedIds };
      }
    }

    const duties = await prisma.duty.findMany({
      where: dutyWhere,
      include: {
        cadet: {
          select: { fullName: true, regimentalNumber: true, platoonName: true },
        },
      },
      orderBy: { dutyDate: 'asc' },
    });

    // Transform all sources into unified calendar entries
    const unifiedCalendar: any[] = [];

    // 1. Camps -> Calendar items
    camps.forEach((c) => {
      const campStart = new Date(c.startDate);
      const campEnd = new Date(c.endDate);
      const status = now < campStart ? 'UPCOMING' : now <= campEnd ? 'ONGOING' : 'COMPLETED';

      unifiedCalendar.push({
        id: `camp-${c.id}`,
        sourceType: 'CAMP',
        type: 'CAMP',
        eventType: 'CAMP',
        title: `⛺ ${c.name}`,
        description: c.description || `Location: ${c.location}. Capacity: ${c.capacity} cadets.`,
        date: c.startDate,
        startDate: c.startDate,
        endDate: c.endDate,
        startTime: c.reportingTime || '0600 hrs',
        location: c.location,
        instructions: c.instructions || 'Mandatory turnout: Clean uniforms, bedding roll, mess kit.',
        organizer: c.assignedOfficers || 'Unit Command / DGNCC',
        capacity: c.capacity,
        status,
        targetRole: 'ALL',
        referenceId: c.id,
      });
    });

    // 2. Training Sessions -> Calendar items
    sessions.forEach((s) => {
      const sessionDate = new Date(s.date);
      const isDrill = s.activity && (s.activity.toLowerCase().includes('drill') || s.activity.toLowerCase().includes('parade'));
      const evType = isDrill ? 'PARADE' : 'TRAINING';
      const status = now < sessionDate ? 'UPCOMING' : 'COMPLETED';

      unifiedCalendar.push({
        id: `training-${s.id}`,
        sourceType: 'TRAINING',
        type: evType,
        eventType: evType,
        title: `🎖️ ${s.title || s.activity}`,
        description: s.focus ? `Focus: ${s.focus}. Conducted by: ${s.conductedBy}` : s.activity,
        date: s.date,
        startDate: s.date,
        startTime: s.startTime || s.timing || '0600 hrs',
        location: s.location || 'AIT Central Parade Grounds',
        instructions: `Target Platoon: ${s.targetPlatoon || 'All Platoons'}`,
        organizer: s.conductedBy || 'DI Wing',
        status,
        targetRole: s.targetPlatoon || 'ALL',
        referenceId: s.id,
      });
    });

    // 3. Duties -> Calendar items
    duties.forEach((d) => {
      const dutyDate = new Date(d.dutyDate);
      const status = d.status || (now < dutyDate ? 'UPCOMING' : 'COMPLETED');

      unifiedCalendar.push({
        id: `duty-${d.id}`,
        sourceType: 'DUTY',
        type: 'DUTY',
        eventType: 'DUTY',
        title: `🛡️ ${d.title || d.dutyType}`,
        description: `Assigned Cadet: ${d.cadet?.fullName || 'Cadet'} (${d.cadet?.regimentalNumber || 'Unit'}). ${d.instructions ? `Instructions: ${d.instructions}` : ''}`,
        date: d.dutyDate,
        startDate: d.dutyDate,
        startTime: d.reportingTime || '0630 hrs',
        location: d.location,
        instructions: d.instructions,
        organizer: 'Unit Duty Officer',
        status,
        targetRole: 'ALL',
        referenceId: d.id,
      });
    });

    // 4. Events -> Calendar items
    events.forEach((e) => {
      const evDate = new Date(e.eventDate);
      const status = now < evDate ? 'UPCOMING' : 'COMPLETED';
      const evType = e.eventType || 'ACTIVITY';

      unifiedCalendar.push({
        id: `event-${e.id}`,
        sourceType: 'EVENT',
        type: evType,
        eventType: evType,
        title: `📅 ${e.title}`,
        description: e.description,
        date: e.eventDate,
        startDate: e.eventDate,
        endDate: e.endTime ? e.eventDate : undefined,
        startTime: e.startTime || '0800 hrs',
        endTime: e.endTime,
        location: e.location,
        organizer: e.organizer || 'AIT NCC Command',
        status,
        targetRole: 'ALL',
        referenceId: e.id,
      });
    });

    // Sort by date ascending
    unifiedCalendar.sort((a, b) => new Date(a.startDate || a.date).getTime() - new Date(b.startDate || b.date).getTime());

    // Optional filter by eventType or type
    const filtered = eventType && eventType !== 'ALL'
      ? unifiedCalendar.filter((item) => item.type === eventType || item.eventType === eventType)
      : unifiedCalendar;

    res.json({
      success: true,
      count: filtered.length,
      userRole: req.user.role,
      events: filtered,
    });
  } catch (error) {
    console.error('getCalendarStream error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve unified calendar' });
  }
};

// 2. Create an event in Central Calendar (Officers only)
export const createCalendarEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'CADET') {
      res.status(403).json({ success: false, message: 'Cadets have view-only calendar access.' });
      return;
    }

    const {
      title,
      description,
      eventType,
      type,
      eventDate,
      startDate,
      startTime,
      endTime,
      location,
      organizer,
    } = req.body;

    const targetDate = eventDate || startDate;
    const targetType = eventType || type || 'PARADE';

    if (!title || !description || !targetDate || !location) {
      res.status(400).json({ success: false, message: 'Title, description, date, and location are required.' });
      return;
    }

    const newEvent = await prisma.event.create({
      data: {
        title: String(title).trim(),
        description: String(description).trim(),
        eventType: targetType,
        eventDate: new Date(targetDate),
        startTime: startTime ? String(startTime).trim() : '0630 hrs',
        endTime: endTime ? String(endTime).trim() : null,
        location: String(location).trim(),
        organizer: organizer ? String(organizer).trim() : req.user.fullName,
        isPublic: true,
        status: 'PUBLISHED',
      },
    });

    res.status(201).json({
      success: true,
      message: `Event "${newEvent.title}" published to NCC Central Calendar.`,
      event: {
        ...newEvent,
        type: newEvent.eventType,
        startDate: newEvent.eventDate,
        date: newEvent.eventDate,
        status: 'UPCOMING',
      },
    });
  } catch (error) {
    console.error('createCalendarEvent error:', error);
    res.status(500).json({ success: false, message: 'Failed to create calendar event' });
  }
};
