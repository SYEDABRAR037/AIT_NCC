import './test-isolation-guard';
import assert from 'assert';
import { prisma } from '../db';
import { getCadetServiceRecord } from '../controllers/serviceRecord.controller';

async function run(): Promise<void> {
  const originalUserFindUnique = prisma.user.findUnique;
  const originalAssignmentsFindMany = prisma.drillInstructorAssignment.findMany;
  const originalDataReaders = {
    attendanceFindMany: prisma.trainingAttendance.findMany,
    attendanceGroupBy: prisma.trainingAttendance.groupBy,
    campParticipants: prisma.campParticipant.findMany,
    duties: prisma.duty.findMany,
    certificates: prisma.certificate.findMany,
    leaves: prisma.leave.findMany,
    reviews: prisma.reviewRecord.findMany,
    ranks: prisma.rankHistory.findMany,
    biometric: prisma.biometricTemplate.findUnique,
    timeline: prisma.timelineEvent.findMany,
    audit: prisma.auditLog.findMany,
  };

  try {
    (prisma.user as any).findUnique = async () => ({ platoonName: 'Bravo' });
    (prisma.drillInstructorAssignment as any).findMany = async () => [
      { platoon: { name: 'Alpha' } },
    ];

    const response: any = {
      statusCode: 200,
      body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };

    await getCadetServiceRecord({
      params: { cadetId: 'synthetic-cadet-bravo' },
      user: { id: 'synthetic-di-alpha', role: 'DRILL_INSTRUCTOR' },
    } as any, response);

    assert.strictEqual(response.statusCode, 403);
    assert.match(response.body.message, /outside your authorized drill instructor scope/);
    console.log('[PASS] Drill Instructor cannot read a cadet service record outside assigned platoons.');

    const cadet = {
      id: 'synthetic-cadet-alpha', fullName: 'Synthetic Cadet', status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'), platoonName: 'Alpha',
    };
    (prisma.user as any).findUnique = async ({ select }: any) => select?.fullName
      ? cadet
      : { platoonName: 'Alpha' };
    (prisma.trainingAttendance as any).findMany = async () => [];
    (prisma.trainingAttendance as any).groupBy = async () => [];
    (prisma.campParticipant as any).findMany = async () => [];
    (prisma.duty as any).findMany = async () => [];
    (prisma.certificate as any).findMany = async () => [];
    (prisma.leave as any).findMany = async () => [];
    (prisma.reviewRecord as any).findMany = async () => [];
    (prisma.rankHistory as any).findMany = async () => [];
    (prisma.biometricTemplate as any).findUnique = async () => null;
    (prisma.timelineEvent as any).findMany = async () => [];
    (prisma.auditLog as any).findMany = async () => [];

    const assignedResponse: any = {
      statusCode: 200,
      body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    await getCadetServiceRecord({
      params: { cadetId: 'synthetic-cadet-alpha' },
      user: { id: 'synthetic-di-alpha', role: 'DRILL_INSTRUCTOR' },
    } as any, assignedResponse);
    assert.strictEqual(assignedResponse.statusCode, 200);
    assert.strictEqual(assignedResponse.body.serviceRecord.currentInformation.id, 'synthetic-cadet-alpha');
    console.log('[PASS] Drill Instructor can read a cadet service record in an assigned platoon.');
  } finally {
    (prisma.user as any).findUnique = originalUserFindUnique;
    (prisma.drillInstructorAssignment as any).findMany = originalAssignmentsFindMany;
    (prisma.trainingAttendance as any).findMany = originalDataReaders.attendanceFindMany;
    (prisma.trainingAttendance as any).groupBy = originalDataReaders.attendanceGroupBy;
    (prisma.campParticipant as any).findMany = originalDataReaders.campParticipants;
    (prisma.duty as any).findMany = originalDataReaders.duties;
    (prisma.certificate as any).findMany = originalDataReaders.certificates;
    (prisma.leave as any).findMany = originalDataReaders.leaves;
    (prisma.reviewRecord as any).findMany = originalDataReaders.reviews;
    (prisma.rankHistory as any).findMany = originalDataReaders.ranks;
    (prisma.biometricTemplate as any).findUnique = originalDataReaders.biometric;
    (prisma.timelineEvent as any).findMany = originalDataReaders.timeline;
    (prisma.auditLog as any).findMany = originalDataReaders.audit;
  }
}

run().catch((error) => {
  console.error('Service record scope test failed:', error);
  process.exitCode = 1;
});
