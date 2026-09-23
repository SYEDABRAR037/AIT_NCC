import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  triggerPresentAttendanceNotifications,
  triggerAbsentAttendanceNotifications,
  resolveDispatchRecipient,
  isAttendanceNotificationTestMode,
  DESIGNATED_ATTENDANCE_TEST_RECIPIENT
} from '../src/services/attendanceNotification.service';

const prisma = new PrismaClient();

async function run() {
  console.log('================================================================');
  console.log('🧪 VERIFYING ATTENDANCE NOTIFICATION TEST RECIPIENT: 7893732737');
  console.log('================================================================');
  console.log('Is Test Mode Active?:', isAttendanceNotificationTestMode());
  console.log('Designated Test Recipient:', DESIGNATED_ATTENDANCE_TEST_RECIPIENT);

  // 1. Verify routing logic directly
  const testPhoneNumbers = ['+919876543210', '9812345678', '+919988776655'];
  for (const p of testPhoneNumbers) {
    const res = resolveDispatchRecipient(p);
    console.log(`Original: ${p} -> Routed Recipient: ${res.finalRecipient} (isTestMode: ${res.isTestMode})`);
    if (res.finalRecipient !== '+917893732737') {
      throw new Error(`FAIL: Expected +917893732737 but got ${res.finalRecipient}`);
    }
  }
  console.log('✓ TEST RECIPIENT RESOLUTION VERIFIED: All routes point strictly to +917893732737\n');

  // 2. Fetch ANO user
  const ano = await prisma.user.findFirst({ where: { role: 'ADMIN_ANO' } });
  if (!ano) throw new Error('ANO user not found in database');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('CadetTest@1234', salt);

  // 3. Create 2 temporary test cadets
  const testCadet1 = await prisma.user.upsert({
    where: { email: 'test.present.cadet@aitpune.edu.in' },
    update: {},
    create: {
      fullName: 'CDT Vikramaditya Rathore',
      regimentalNumber: 'MH25SDA100901',
      collegeRollNumber: '250101',
      email: 'test.present.cadet@aitpune.edu.in',
      passwordHash,
      role: 'CADET',
      status: 'ACTIVE',
      year: 'SE',
      branch: 'Computer Engineering',
      platoonName: 'Senior Division',
      phone: '9811122233',
    },
  });

  const testCadet2 = await prisma.user.upsert({
    where: { email: 'test.absent.cadet@aitpune.edu.in' },
    update: {},
    create: {
      fullName: 'CDT Shreya Deshmukh',
      regimentalNumber: 'MH25SWA100902',
      collegeRollNumber: '250102',
      email: 'test.absent.cadet@aitpune.edu.in',
      passwordHash,
      role: 'CADET',
      status: 'ACTIVE',
      year: 'SE',
      branch: 'Electronics & Telecommunication',
      platoonName: 'Senior Wing',
      phone: '9844455566',
    },
  });

  // 4. Create active attendance session
  const session = await prisma.trainingSession.create({
    data: {
      title: 'Ceremonial Drill & Arms Turnout',
      activity: 'Ceremonial Drill & Arms Turnout',
      timing: '0600 - 0730 hrs',
      startTime: '06:00',
      location: 'AIT Parade Grounds',
      focus: 'Live Biometric Muster',
      conductedBy: ano.id,
      creatorRole: 'ADMIN_ANO',
      targetPlatoon: 'Senior Division',
      status: 'ACTIVE',
      expectedCount: 2,
      presentCount: 1,
      absentCount: 1,
      date: new Date(),
    },
  });

  // 5. Mark testCadet1 Present
  const presentAttendance = await prisma.trainingAttendance.create({
    data: {
      sessionId: session.id,
      cadetId: testCadet1.id,
      status: 'PRESENT',
      verificationMethod: 'FACE',
      verificationStatus: 'VERIFIED',
      confidenceScore: 0.98,
      verifiedBy: 'AI_FACE_SCANNER',
    },
  });

  console.log('Triggering Present notifications (SMS & WhatsApp)...');
  await triggerPresentAttendanceNotifications({
    attendanceId: presentAttendance.id,
    sessionId: session.id,
    cadet: {
      id: testCadet1.id,
      fullName: testCadet1.fullName,
      regimentalNumber: testCadet1.regimentalNumber,
      phone: testCadet1.phone,
    },
    activityName: session.activity,
    dateStr: 'September 14, 2026',
    timeStr: '16:58',
  });

  // 6. Mark testCadet2 Absent
  const absentAttendance = await prisma.trainingAttendance.create({
    data: {
      sessionId: session.id,
      cadetId: testCadet2.id,
      status: 'ABSENT',
      verificationMethod: 'AUTO_RECONCILE',
      verificationStatus: 'FAILED',
      verifiedBy: 'SESSION_RECONCILER',
    },
  });

  console.log('Triggering Absent notifications (SMS & WhatsApp)...');
  await triggerAbsentAttendanceNotifications({
    attendanceId: absentAttendance.id,
    sessionId: session.id,
    cadet: {
      id: testCadet2.id,
      fullName: testCadet2.fullName,
      regimentalNumber: testCadet2.regimentalNumber,
      phone: testCadet2.phone,
    },
    activityName: session.activity,
    dateStr: 'September 14, 2026',
    timeStr: '17:00',
  });

  // Close session
  await prisma.trainingSession.update({
    where: { id: session.id },
    data: { status: 'CLOSED' },
  });

  console.log('\nWaiting 1200ms for background worker queue to process...');
  await new Promise((r) => setTimeout(r, 1200));

  const notifs = await prisma.attendanceNotification.findMany({
    where: { sessionId: session.id },
  });

  console.log(`\nFound ${notifs.length} notification records created for session ${session.id}:`);
  for (const n of notifs) {
    console.log(`  ID: ${n.id} | Event: ${n.eventType} | Channel: ${n.channel} | Status: ${n.status} | Recipient: ${n.recipientPhone}`);
  }

  console.log('\nSession ID ready for live inspection:', session.id);
}

run()
  .catch((err) => {
    console.error('Execution error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
