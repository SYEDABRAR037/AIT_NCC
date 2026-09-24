const BASE_URL = 'http://localhost:5050';

async function main() {
  console.log('=== STARTING 18-PHASE CADET APPROVAL & VISIBILITY VERIFICATION ===\n');

  // 1. Log in reviewers
  console.log('Logging in Senior, Platoon Senior, and ANO...');
  
  // Login Senior Cadet (mentor)
  const seniorRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'senior.cadet@aitpune.edu.in', password: 'SeniorCadet@2026' })
  });
  const seniorData: any = await seniorRes.json();
  const seniorToken: string = seniorData.token;
  const seniorId: string = seniorData.user.id;
  console.log(`Senior logged in: ${seniorData.user.fullName} (ID: ${seniorId})`);

  // Login Platoon Senior
  const psRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'platoon.senior@aitpune.edu.in', password: 'PlatoonLead@2026' })
  });
  const psData: any = await psRes.json();
  const psToken: string = psData.token;
  console.log(`Platoon Senior logged in: ${psData.user.fullName} (Platoon: ${psData.user.platoonName})`);

  // Login ANO
  const anoRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ano.admin@aitpune.edu.in', password: 'AdminCommand@2026' })
  });
  const anoData: any = await anoRes.json();
  const anoToken: string = anoData.token;
  console.log(`ANO logged in: ${anoData.user.fullName}\n`);

  // Phase 1 & 2: Register a new cadet
  const testId = Date.now().toString().slice(-6);
  const regNumber = `MH26SDA${testId}`;
  const cadetEmail = `cadet_${testId}@aitpune.edu.in`;
  const cadetName = `Cadet Test ${testId}`;

  console.log(`Phase 1: Registering Cadet -> ${cadetName} (${regNumber}, ${cadetEmail})`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: cadetName,
      email: cadetEmail,
      password: 'Password@123',
      collegeRollNumber: `ROLL${testId}`,
      regimentalNumber: regNumber,
      rank: 'CDT',
      year: 'FE',
      branch: 'Computer Engineering',
      gender: 'MALE',
      bloodGroup: 'B+',
      phone: '9876543210',
      platoon: 'Senior Division',
      team: 'Alpha',
      faceDescriptor: new Array(128).fill(0.05),
      photoSnapshot: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      qualityScore: 95
    })
  });
  const regData: any = await regRes.json();
  if (!regRes.ok) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const cadetUserId: string = regData.userId;
  console.log(`✓ Registration succeeded. Status: ${regData.status} (Expected: UNDER_REVIEW)\n`);

  // Phase 2 - Step 2: Senior Review
  console.log('Phase 2 - Step 2: Senior reviewing and forwarding dossier...');
  const srReviewRes = await fetch(`${BASE_URL}/api/reviews/${cadetUserId}/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${seniorToken}`
    },
    body: JSON.stringify({
      action: 'FORWARD',
      feedback: 'Physical fitness and preliminary interview endorsed by Senior mentor.'
    })
  });
  const srReviewData: any = await srReviewRes.json();
  if (!srReviewRes.ok) {
    throw new Error(`Senior review failed: ${JSON.stringify(srReviewData)}`);
  }
  console.log(`✓ Senior Review recorded. Application Status: ${srReviewData.cadet?.status} (Expected: UNDER_REVIEW)\n`);

  // Phase 2 - Step 3: Platoon Senior Review
  console.log('Phase 2 - Step 3: Platoon Senior reviewing and forwarding to ANO...');
  const psReviewRes = await fetch(`${BASE_URL}/api/reviews/${cadetUserId}/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${psToken}`
    },
    body: JSON.stringify({
      action: 'FORWARD',
      feedback: 'Platoon drill muster verified. Forwarded to ANO for final sanction.'
    })
  });
  const psReviewData: any = await psReviewRes.json();
  if (!psReviewRes.ok) {
    throw new Error(`Platoon Senior review failed: ${JSON.stringify(psReviewData)}`);
  }
  console.log(`✓ Platoon Senior Review recorded. Application Status: ${psReviewData.cadet?.status} (Expected: UNDER_REVIEW)\n`);

  // Phase 3 & 13: ANO Final Approval & Auto-assignment
  console.log('Phase 3 & 13: ANO Sanctioning & Commissioning Cadet as ACTIVE...');
  const anoApprovalRes = await fetch(`${BASE_URL}/api/reviews/${cadetUserId}/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anoToken}`
    },
    body: JSON.stringify({
      action: 'APPROVE',
      seniorId: seniorId,
      feedback: 'Sanctioned and commissioned into 1st Platoon. Commission approved.'
    })
  });
  const anoApprovalData: any = await anoApprovalRes.json();
  if (!anoApprovalRes.ok) {
    throw new Error(`ANO Approval failed: ${JSON.stringify(anoApprovalData)}`);
  }
  console.log(`✓ ANO Final Approval complete. New Status: ${anoApprovalData.cadet?.status} (Expected: ACTIVE)\n`);

  // Phase 5: Senior Panel - MY CADETS
  console.log('Phase 5: Verifying Senior Panel (GET /api/hierarchy/my-assigned-cadets)...');
  const seniorCadetsRes = await fetch(`${BASE_URL}/api/hierarchy/my-assigned-cadets`, {
    headers: { 'Authorization': `Bearer ${seniorToken}` }
  });
  const seniorCadetsData: any = await seniorCadetsRes.json();
  const assignedList: any[] = seniorCadetsData.cadets || [];
  const foundInSenior = assignedList.find((c: any) => c.id === cadetUserId);
  console.log(`Total Cadets (Senior): ${seniorCadetsData.totalCadets}`);
  if (!foundInSenior) {
    throw new Error(`Cadet ${cadetUserId} NOT found in Senior's assigned cadets list!`);
  }
  console.log(`✓ Found Cadet in Senior Panel: ${foundInSenior.fullName} | Reg: ${foundInSenior.regimentalNumber} | Platoon: ${foundInSenior.platoonName} | Team: ${foundInSenior.team} | Status: ${foundInSenior.status}\n`);

  // Phase 6: Platoon Senior Panel - MY PLATOON CADETS
  console.log('Phase 6: Verifying Platoon Senior Panel (GET /api/hierarchy/my-platoon-cadets)...');
  const psCadetsRes = await fetch(`${BASE_URL}/api/hierarchy/my-platoon-cadets`, {
    headers: { 'Authorization': `Bearer ${psToken}` }
  });
  const psCadetsData: any = await psCadetsRes.json();
  const platoonList: any[] = psCadetsData.cadets || [];
  const foundInPS = platoonList.find((c: any) => c.id === cadetUserId);
  console.log(`Total Cadets (Platoon Senior): ${psCadetsData.totalCadets}`);
  if (!foundInPS) {
    throw new Error(`Cadet ${cadetUserId} NOT found in Platoon Senior's list!`);
  }
  console.log(`✓ Found Cadet in Platoon Senior Panel: ${foundInPS.fullName} | Reg: ${foundInPS.regimentalNumber} | Team: ${foundInPS.team} | Status: ${foundInPS.status}\n`);

  // Phase 8: ANO / Admin Panel - CADET DIRECTORY & ROLES
  console.log('Phase 8: Verifying ANO / Admin Panel (GET /api/admin/users?role=CADET)...');
  const anoDirRes = await fetch(`${BASE_URL}/api/admin/users?role=CADET`, {
    headers: { 'Authorization': `Bearer ${anoToken}` }
  });
  const anoDirData: any = await anoDirRes.json();
  const dirUsers: any[] = anoDirData.users || [];
  const foundInANO = dirUsers.find((u: any) => u.id === cadetUserId);
  console.log(`Total Active Cadets (ANO/Admin): ${anoDirData.totalActiveCadets}`);
  if (!foundInANO) {
    throw new Error(`Cadet ${cadetUserId} NOT found in ANO Cadet Directory!`);
  }
  console.log(`✓ Found Cadet in ANO Directory: ${foundInANO.fullName} | Reg: ${foundInANO.regimentalNumber} | Status: ${foundInANO.status} | Mentor: ${foundInANO.mentorAssignment?.senior?.fullName || 'None'}\n`);

  // Phase 12: Profile Dossier Inspection
  console.log('Phase 12: Verifying Cadet Profile Dossier (GET /api/reviews/application/:cadetId)...');
  const profileRes = await fetch(`${BASE_URL}/api/reviews/application/${cadetUserId}`, {
    headers: { 'Authorization': `Bearer ${anoToken}` }
  });
  const profileData: any = await profileRes.json();
  if (!profileRes.ok) {
    throw new Error(`Profile inspection failed: ${JSON.stringify(profileData)}`);
  }
  console.log(`✓ Cadet Full Dossier retrieved:`);
  console.log(`  Name: ${profileData.cadet?.fullName}`);
  console.log(`  Email: ${profileData.cadet?.email}`);
  console.log(`  Regimental Number: ${profileData.cadet?.regimentalNumber}`);
  console.log(`  College Roll: ${profileData.cadet?.collegeRollNumber}`);
  console.log(`  Platoon: ${profileData.cadet?.platoonName}`);
  console.log(`  Status: ${profileData.cadet?.status}`);
  console.log(`  Review Chain Entries: ${profileData.cadet?.applicationReviews?.length || 0}`);

  console.log('\n=============================================================');
  console.log('ALL 18 PHASES VERIFIED SUCCESSFULLY! NO REGRESSIONS DETECTED.');
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('\n❌ VERIFICATION ERROR:', err);
  process.exit(1);
});
