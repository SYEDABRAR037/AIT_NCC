import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../db';
import { calculatePerformance } from '../services/performance.service';

const assessorCategories: Record<string, string[]> = {
  ADMIN_ANO: ['DRILL', 'FITNESS', 'TRAINING', 'CAMP_EVENT', 'CERT_ACHIEVEMENT', 'DISCIPLINE_LEADERSHIP'],
  DRILL_INSTRUCTOR: ['DRILL', 'FITNESS', 'TRAINING'],
  PLATOON_SENIOR: ['DRILL', 'TRAINING', 'CAMP_EVENT'],
  SENIOR: ['DRILL', 'TRAINING'],
};

async function canView(req: Request, cadetId: string) {
  const actor = (req as any).user;
  if (!actor) return false;
  if (actor.role === 'ADMIN_ANO') return true;
  if (actor.role === 'CADET') return actor.id === cadetId;
  if (actor.role === 'SENIOR') return Boolean(await prisma.seniorAssignment.findFirst({ where: { seniorId: actor.id, cadetId } }));
  if (actor.role === 'PLATOON_SENIOR' || actor.role === 'DRILL_INSTRUCTOR') {
    const target = await prisma.user.findUnique({ where: { id: cadetId }, select: { platoonName: true } });
    if (!target) return false;
    const platoon = await prisma.platoon.findUnique({ where: { name: target.platoonName }, select: { id: true } });
    if (!platoon) return false;
    if (actor.role === 'PLATOON_SENIOR') return Boolean(await prisma.platoonSeniorAssignment.findFirst({ where: { platoonSeniorId: actor.id, platoonId: platoon.id } }));
    return Boolean(await prisma.drillInstructorAssignment.findFirst({ where: { drillInstructorId: actor.id, platoonId: platoon.id } }));
  }
  return false;
}

function range(period: string, dateInput?: string) {
  const date = dateInput && !Number.isNaN(Date.parse(dateInput)) ? new Date(dateInput) : new Date();
  if (period === 'MONTHLY') return { start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
  if (period === 'QUARTERLY') { const month = Math.floor(date.getMonth() / 3) * 3; return { start: new Date(date.getFullYear(), month, 1), end: new Date(date.getFullYear(), month + 3, 1) }; }
  if (period === 'ANNUAL') return { start: new Date(date.getFullYear(), 0, 1), end: new Date(date.getFullYear() + 1, 0, 1) };
  return { start: new Date(0), end: new Date(8640000000000000) };
}

export async function getPerformance(req: Request, res: Response) {
  const actor = (req as any).user;
  const cadetId = req.params.cadetId || actor?.id;
  if (!cadetId || !(await canView(req, cadetId))) return res.status(403).json({ success: false, message: 'You are not authorized to view this cadet performance record.' });
  const period = String(req.query.period || 'SERVICE').toUpperCase();
  if (!['MONTHLY', 'QUARTERLY', 'ANNUAL', 'SERVICE'].includes(period)) return res.status(400).json({ success: false, message: 'Invalid reporting period.' });
  const { start, end } = range(period, typeof req.query.date === 'string' ? req.query.date : undefined);
  const cadet = await prisma.user.findUnique({ where: { id: cadetId }, select: { id: true, fullName: true, regimentalNumber: true, rank: true, platoonName: true, year: true, company: true } });
  if (!cadet) return res.status(404).json({ success: false, message: 'Cadet not found.' });
  const [attendances, assessments, camps, certificates, snapshots] = await Promise.all([
    prisma.trainingAttendance.findMany({ where: { cadetId, verificationStatus: 'VERIFIED', session: { date: { gte: start, lt: end } }, status: { in: ['PRESENT', 'ABSENT', 'EXCUSED'] } }, select: { status: true, session: { select: { date: true } } }, orderBy: { session: { date: 'asc' } } }),
    prisma.performanceAssessment.findMany({ where: { cadetId, assessmentDate: { gte: start, lt: end } }, orderBy: { assessmentDate: 'asc' }, select: { id: true, category: true, score: true, title: true, feedback: true, assessmentDate: true, evaluator: { select: { fullName: true, role: true } } } }),
    prisma.campParticipant.findMany({ where: { cadetId }, select: { status: true, camp: { select: { name: true, campType: true, startDate: true } } } }),
    prisma.certificate.findMany({ where: { cadetId, status: 'VALID' }, select: { certificateType: true, title: true, grade: true, issueDate: true } }),
    prisma.performanceScoreSnapshot.findMany({ where: { cadetId, period }, orderBy: { calculatedAt: 'desc' }, take: 24 }),
  ]);
  const eligible = attendances.filter((item) => item.status !== 'EXCUSED');
  const categories: Record<string, number | null> = {
    ATTENDANCE: eligible.length ? (eligible.filter((item) => item.status === 'PRESENT').length / eligible.length) * 100 : null,
    DRILL: null, FITNESS: null, TRAINING: null, CAMP_EVENT: null, CERT_ACHIEVEMENT: null, DISCIPLINE_LEADERSHIP: null,
  };
  for (const category of ['DRILL', 'FITNESS', 'TRAINING', 'CAMP_EVENT', 'CERT_ACHIEVEMENT', 'DISCIPLINE_LEADERSHIP']) {
    const scores = assessments.filter((assessment) => assessment.category === category).map((assessment) => assessment.score);
    if (scores.length) categories[category] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
  const scorecard = calculatePerformance(categories);
  const digest = createHash('sha256').update(JSON.stringify({ period, start, end, scorecard, attendance: attendances, assessments: assessments.map(({ id, score }) => [id, score]) })).digest('hex');
  const snapshot = await prisma.performanceScoreSnapshot.upsert({
    where: { cadetId_period_periodStart_sourceDigest: { cadetId, period, periodStart: start, sourceDigest: digest } },
    create: { cadetId, period, periodStart: start, periodEnd: end, overallScore: scorecard.score, grade: scorecard.grade, completeness: scorecard.completeness, categories: scorecard.categories as any, sourceDigest: digest },
    update: {},
  });
  return res.json({ success: true, cadet, period: { type: period, start, end }, scorecard, attendance: { present: attendances.filter((item) => item.status === 'PRESENT').length, absent: attendances.filter((item) => item.status === 'ABSENT').length, excused: attendances.filter((item) => item.status === 'EXCUSED').length, trend: attendances.map((item) => ({ date: item.session.date, present: item.status === 'PRESENT' })) }, assessments, participation: { camps, certificates }, history: [snapshot, ...snapshots.filter((item) => item.id !== snapshot.id)] });
}

export async function createPerformanceAssessment(req: Request, res: Response) {
  const actor = (req as any).user;
  const { cadetId, category, score, title, feedback, assessmentDate } = req.body || {};
  if (!actor || !assessorCategories[actor.role]?.includes(category)) return res.status(403).json({ success: false, message: 'Your role cannot record this assessment category.' });
  if (typeof cadetId !== 'string' || cadetId.length < 1) return res.status(400).json({ success: false, message: 'A cadet id is required.' });
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100 || typeof title !== 'string' || title.trim().length < 2) return res.status(400).json({ success: false, message: 'Provide a title and a score from 0 to 100.' });
  if (!(await canView(req, cadetId))) return res.status(403).json({ success: false, message: 'You are not assigned to this cadet.' });
  const assessment = await prisma.performanceAssessment.create({ data: { cadetId, evaluatorId: actor.id, category, score, title: title.trim(), feedback: typeof feedback === 'string' ? feedback.trim().slice(0, 2000) : null, ...(assessmentDate && !Number.isNaN(Date.parse(assessmentDate)) ? { assessmentDate: new Date(assessmentDate) } : {}) } });
  return res.status(201).json({ success: true, assessment });
}
