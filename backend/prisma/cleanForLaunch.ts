import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function cleanForLaunch() {
  console.log('================================================================');
  console.log('🚀 INITIALIZING FRESH LAUNCH DATABASE WIPE FOR LIVE CADET ONBOARDING');
  console.log('================================================================\n');

  // 1. Wipe dependent operational data
  console.log('Step 1: Removing all test attendance, biometric, and training data...');
  const delAttendance = await prisma.trainingAttendance.deleteMany();
  const delInspections = await prisma.turnoutInspection.deleteMany();
  const delBiometrics = await prisma.biometricTemplate.deleteMany();
  const delCertificates = await prisma.certificate.deleteMany();
  const delDuties = await prisma.duty.deleteMany();
  const delSessions = await prisma.trainingSession.deleteMany();

  console.log(`  - Deleted ${delAttendance.count} attendance records`);
  console.log(`  - Deleted ${delInspections.count} turnout inspection records`);
  console.log(`  - Deleted ${delBiometrics.count} biometric templates`);
  console.log(`  - Deleted ${delCertificates.count} certificates`);
  console.log(`  - Deleted ${delDuties.count} duty assignments`);
  console.log(`  - Deleted ${delSessions.count} training sessions`);

  console.log('\nStep 2: Removing all test leaves, requests, reviews, and activity records...');
  const delReqHistory = await prisma.requestHistoryRecord.deleteMany();
  const delRequests = await prisma.request.deleteMany();
  const delLeaveReviews = await prisma.leaveReviewRecord.deleteMany();
  const delLeaves = await prisma.leave.deleteMany();
  const delReviews = await prisma.reviewRecord.deleteMany();
  const delSeniorAssignments = await prisma.seniorAssignment.deleteMany();
  const delPlatoonAssignments = await prisma.platoonSeniorAssignment.deleteMany();
  const delTimeline = await prisma.timelineEvent.deleteMany();
  const delCampParticipants = await prisma.campParticipant.deleteMany();
  const delEventParticipants = await prisma.eventParticipant.deleteMany();
  const delCamps = await prisma.camp.deleteMany();
  const delEvents = await prisma.event.deleteMany();
  const delNotices = await prisma.notice.deleteMany();
  const delAchievements = await prisma.achievement.deleteMany();
  const delAudit = await prisma.auditLog.deleteMany();
  const delNotifications = await prisma.notification.deleteMany();

  console.log(`  - Deleted ${delReqHistory.count} request history items`);
  console.log(`  - Deleted ${delRequests.count} cadet requests`);
  console.log(`  - Deleted ${delLeaveReviews.count} leave review records`);
  console.log(`  - Deleted ${delLeaves.count} leave records`);
  console.log(`  - Deleted ${delReviews.count} application reviews`);
  console.log(`  - Deleted ${delTimeline.count} timeline events`);
  console.log(`  - Deleted ${delCampParticipants.count} camp participant records`);
  console.log(`  - Deleted ${delEventParticipants.count} event participant records`);
  console.log(`  - Deleted ${delCamps.count} sample camps`);
  console.log(`  - Deleted ${delEvents.count} sample events`);
  console.log(`  - Deleted ${delNotices.count} sample notices`);
  console.log(`  - Deleted ${delAchievements.count} sample achievements`);
  console.log(`  - Deleted ${delNotifications.count} notifications`);

  // 2. Wipe all non-command users and purge any test accounts permanently
  console.log('\nStep 3: Removing all test accounts...');
  const leadershipEmails = [
    'ano.admin@aitpune.edu.in',
  ];

  // Explicitly purge all other accounts so database starts from absolute zero
  const delUsers = await prisma.user.deleteMany({
    where: {
      email: { notIn: leadershipEmails },
    },
  });
  console.log(`  - Deleted ${delUsers.count} test accounts.`);

  // 3. Ensure base wings/platoons exist
  console.log('\nStep 4: Verifying official unit cadet wings...');
  const platoons = ['Senior Division', 'Senior Wing'];
  for (const name of platoons) {
    await prisma.platoon.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `Official cadet wing for ${name}, 2 Maharashtra Bn NCC, AIT Pune.`,
      },
    });
  }
  console.log('  - Platoons "Senior Division" and "Senior Wing" ready.');

  // 4. Ensure ONLY the Institutional ANO Administrator Account exists
  console.log('\nStep 5: Verifying Institutional ANO Administrator Account...');
  const commandAccounts = [
    {
      fullName: 'Lt. Col. Sanjeev Sharma (ANO)',
      regimentalNumber: 'ANO/MH/2026/01',
      collegeRollNumber: 'ANO001',
      email: 'ano.admin@aitpune.edu.in',
      plainPassword: 'AdminCommand@2026',
      role: 'ADMIN_ANO' as const,
      status: 'ACTIVE' as const,
      year: 'FACULTY',
      branch: 'Institutional Command',
      platoonName: 'Senior Division',
    },
  ];

  for (const acc of commandAccounts) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(acc.plainPassword, salt);

    await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        fullName: acc.fullName,
        regimentalNumber: acc.regimentalNumber,
        collegeRollNumber: acc.collegeRollNumber,
        role: acc.role,
        status: acc.status,
        year: acc.year,
        branch: acc.branch,
        platoonName: acc.platoonName,
        passwordHash,
      },
      create: {
        fullName: acc.fullName,
        regimentalNumber: acc.regimentalNumber,
        collegeRollNumber: acc.collegeRollNumber,
        email: acc.email,
        phone: '9876543210',
        year: acc.year,
        branch: acc.branch,
        platoonName: acc.platoonName,
        passwordHash,
        role: acc.role,
        status: acc.status,
      },
    });

    console.log(`  ✓ ${acc.role} verified: ${acc.email} (${acc.fullName})`);
  }

  // 5. Final Verification of Total Users and Cadets
  const finalTotal = await prisma.user.count();
  const finalCadets = await prisma.user.count({ where: { role: 'CADET' } });

  console.log('\n================================================================');
  console.log('✅ LAUNCH CLEANUP COMPLETE');
  console.log(`Total Users in System: ${finalTotal} (Official ANO Admin Command Account only)`);
  console.log(`Total Cadets in System: ${finalCadets} (PRISTINE - ZERO CADETS)`);
  console.log('================================================================\n');
  console.log('The platform is now 100% ready for new cadet registrations.');
  console.log('1. Cadets register via "#register" or "Register" button.');
  console.log('2. Cadets appear in Senior & Platoon Senior Review Panels with status "UNDER_REVIEW".');
  console.log('3. Senior forwards -> Admin ANO performs Final Sanction to "APPROVED".');
}

cleanForLaunch()
  .catch((e) => {
    console.error('Clean for launch failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
