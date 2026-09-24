import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5050';

async function main() {
  console.log('=== NCC AIT PUNE: AUTHENTICATION & OTP RECOVERY TEST SUITE ===\n');

  const testId = Date.now().toString().slice(-6);
  const regNumber = `MH26SDA${testId}`;
  const rollNumber = `ROLL${testId}`;
  const email = `cadet.auth.${testId}@aitpune.edu.in`;
  const initialPassword = 'InitialSecret@2026';
  const newPassword = 'NewSecurePassword@2026';

  // -------------------------------------------------------------
  // TEST 1: Register Cadet
  // -------------------------------------------------------------
  console.log(`[TEST 1] Registering Cadet: ${email} (${regNumber})`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: `Cadet Auth ${testId}`,
      email,
      password: initialPassword,
      collegeRollNumber: rollNumber,
      regimentalNumber: regNumber,
      rank: 'CDT',
      year: 'FE',
      branch: 'Information Technology',
      gender: 'MALE',
      bloodGroup: 'O+',
      phone: '9822012345',
      platoon: 'Senior Division',
      team: 'Bravo',
      faceDescriptor: new Array(128).fill(0.04),
      photoSnapshot: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      qualityScore: 98,
    }),
  });
  const regData: any = await regRes.json();
  if (!regRes.ok || !regData.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const cadetId = regData.userId;
  console.log(`✓ Registration succeeded. Status: ${regData.status} (ID: ${cadetId})\n`);

  // Activate Cadet for testing login/logout (ANO approval)
  await prisma.user.update({
    where: { id: cadetId },
    data: { status: 'ACTIVE' },
  });
  console.log(`✓ Cadet activated to ACTIVE for operational login testing.\n`);

  // -------------------------------------------------------------
  // TEST 2: Login -> Logout -> Relogin (Phase 5, 6, 28)
  // -------------------------------------------------------------
  console.log(`[TEST 2] Testing Login -> Logout -> Relogin cycle...`);

  // 2a. Login with Email
  const loginRes1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: initialPassword }),
  });
  const loginData1: any = await loginRes1.json();
  if (!loginRes1.ok || !loginData1.success) {
    throw new Error(`Login with email failed: ${JSON.stringify(loginData1)}`);
  }
  console.log(`✓ 2a. Login with Email succeeded. Token issued for: ${loginData1.user.fullName}`);

  // 2b. Logout (must not delete or alter user account)
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST' });
  const logoutData: any = await logoutRes.json();
  if (!logoutRes.ok || !logoutData.success) {
    throw new Error(`Logout failed: ${JSON.stringify(logoutData)}`);
  }
  console.log(`✓ 2b. Logout succeeded. Session cookie cleared.`);

  // 2c. Relogin with Regimental Number (Case-insensitive check)
  const loginRes2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: regNumber.toLowerCase(), password: initialPassword }),
  });
  const loginData2: any = await loginRes2.json();
  if (!loginRes2.ok || !loginData2.success) {
    throw new Error(`Relogin with Regimental Number failed: ${JSON.stringify(loginData2)}`);
  }
  console.log(`✓ 2c. Relogin with Regimental Number succeeded.`);

  // 2d. Relogin with Roll Number (Case-insensitive check)
  const loginRes3 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: rollNumber.toLowerCase(), password: initialPassword }),
  });
  const loginData3: any = await loginRes3.json();
  if (!loginRes3.ok || !loginData3.success) {
    throw new Error(`Relogin with Roll Number failed: ${JSON.stringify(loginData3)}`);
  }
  console.log(`✓ 2d. Relogin with Roll Number succeeded.\n`);

  // -------------------------------------------------------------
  // TEST 3: Password Recovery — Identification Mismatch (Phase 9)
  // -------------------------------------------------------------
  console.log(`[TEST 3] Testing Identification Mismatch (Cadet A Email + Wrong Regimental Number)...`);
  const mismatchRes = await fetch(`${BASE_URL}/api/auth/recovery/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, regimentalNumber: 'MH26SDA999999' }),
  });
  const mismatchData: any = await mismatchRes.json();
  if (mismatchRes.ok || mismatchData.success) {
    throw new Error(`Mismatch security check failed! Expected 400 error but got: ${JSON.stringify(mismatchData)}`);
  }
  console.log(`✓ 3. Mismatch rejected with generic notice: "${mismatchData.message}"\n`);

  // -------------------------------------------------------------
  // TEST 4: Password Recovery — Correct Request & OTP Generation (Phase 8, 9, 10, 11)
  // -------------------------------------------------------------
  console.log(`[TEST 4] Requesting OTP with valid credentials (${email}, ${regNumber})...`);
  const otpReqRes = await fetch(`${BASE_URL}/api/auth/recovery/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, regimentalNumber: regNumber }),
  });
  const otpReqData: any = await otpReqRes.json();
  if (!otpReqRes.ok || !otpReqData.success) {
    throw new Error(`OTP request failed: ${JSON.stringify(otpReqData)}`);
  }
  const recoveryId = otpReqData.recoveryId;
  console.log(`✓ 4. OTP dispatched. Masked Email: ${otpReqData.maskedEmail}, Recovery ID: ${recoveryId}`);

  // Fetch the generated OTP from DB for test verification
  const resetRecord = await prisma.passwordReset.findUnique({
    where: { id: recoveryId },
  });
  if (!resetRecord) {
    throw new Error(`PasswordReset record not found in database!`);
  }
  console.log(`✓ 4. Verified PasswordReset record exists in DB (expiresAt: ${resetRecord.expiresAt.toISOString()})\n`);

  // -------------------------------------------------------------
  // TEST 5: Rate Limiting & Cooldown Protection (Phase 26)
  // -------------------------------------------------------------
  console.log(`[TEST 5] Testing Rate Limiting / Cooldown on rapid OTP requests...`);
  const rapidRes = await fetch(`${BASE_URL}/api/auth/recovery/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, regimentalNumber: regNumber }),
  });
  const rapidData: any = await rapidRes.json();
  if (rapidRes.status !== 429) {
    throw new Error(`Expected 429 Cooldown response but got: ${rapidRes.status} ${JSON.stringify(rapidData)}`);
  }
  console.log(`✓ 5. Cooldown enforced: "${rapidData.message}"\n`);

  // -------------------------------------------------------------
  // TEST 6: Invalid OTP Attempt & Brute-Force Protection (Phase 16)
  // -------------------------------------------------------------
  console.log(`[TEST 6] Testing Incorrect OTP attempt...`);
  const wrongOtpRes = await fetch(`${BASE_URL}/api/auth/recovery/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryId, otp: '000000' }),
  });
  const wrongOtpData: any = await wrongOtpRes.json();
  if (wrongOtpRes.ok || wrongOtpData.success) {
    throw new Error(`Expected wrong OTP to fail but got success!`);
  }
  console.log(`✓ 6. Invalid OTP correctly rejected: "${wrongOtpData.message}"\n`);

  // -------------------------------------------------------------
  // TEST 7: Correct OTP Verification (Phase 14, 15)
  // -------------------------------------------------------------
  console.log(`[TEST 7] Verifying correct OTP...`);
  // Find which 6-digit code matches the hash
  let correctOtp = '';
  // Test codes or create a known test code in DB
  const testOtp = '482731';
  const newHash = await bcrypt.hash(testOtp, 10);
  await prisma.passwordReset.update({
    where: { id: recoveryId },
    data: { otpHash: newHash, attemptCount: 0 },
  });
  correctOtp = testOtp;

  const verifyRes = await fetch(`${BASE_URL}/api/auth/recovery/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryId, otp: correctOtp }),
  });
  const verifyData: any = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.success || !verifyData.resetToken) {
    throw new Error(`OTP verification failed: ${JSON.stringify(verifyData)}`);
  }
  const resetToken = verifyData.resetToken;
  console.log(`✓ 7. OTP verified. Reset Token issued.\n`);

  // -------------------------------------------------------------
  // TEST 8: Reset Password (Phase 18, 19)
  // -------------------------------------------------------------
  console.log(`[TEST 8] Resetting Password to new credentials...`);
  const resetRes = await fetch(`${BASE_URL}/api/auth/recovery/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resetToken,
      newPassword,
      confirmPassword: newPassword,
    }),
  });
  const resetData: any = await resetRes.json();
  if (!resetRes.ok || !resetData.success) {
    throw new Error(`Password reset failed: ${JSON.stringify(resetData)}`);
  }
  console.log(`✓ 8. Password reset successfully: "${resetData.message}"\n`);

  // -------------------------------------------------------------
  // TEST 9: Old Password Fails & New Password Works (Phase 19, 20, 21)
  // -------------------------------------------------------------
  console.log(`[TEST 9] Testing Old Password (must FAIL)...`);
  const oldLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: initialPassword }),
  });
  const oldLoginData: any = await oldLoginRes.json();
  if (oldLoginRes.ok || oldLoginData.success) {
    throw new Error(`Old password unexpectedly worked! Security violation.`);
  }
  console.log(`✓ 9a. Old password rejected: "${oldLoginData.message}"`);

  console.log(`Testing New Password (must SUCCEED)...`);
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: newPassword }),
  });
  const newLoginData: any = await newLoginRes.json();
  if (!newLoginRes.ok || !newLoginData.success) {
    throw new Error(`New password login failed: ${JSON.stringify(newLoginData)}`);
  }
  console.log(`✓ 9b. New password login succeeded! User role: ${newLoginData.user.role}, Status: ${newLoginData.user.status}`);

  // -------------------------------------------------------------
  // TEST 10: Verify Data Integrity (Phase 20, 21)
  // -------------------------------------------------------------
  console.log(`\n[TEST 10] Verifying Profile & Assignment Data Integrity...`);
  const updatedCadet = await prisma.user.findUnique({
    where: { id: cadetId },
    include: { biometricTemplate: true },
  });
  if (!updatedCadet) {
    throw new Error(`Cadet user was deleted! Critical bug.`);
  }
  if (updatedCadet.email !== email.toLowerCase()) {
    throw new Error(`Cadet email was altered!`);
  }
  if (updatedCadet.regimentalNumber !== regNumber.toUpperCase()) {
    throw new Error(`Cadet regimental number was altered!`);
  }
  if (updatedCadet.role !== 'CADET') {
    throw new Error(`Cadet role was altered!`);
  }
  if (updatedCadet.status !== 'ACTIVE') {
    throw new Error(`Cadet status was altered!`);
  }
  if (!updatedCadet.biometricTemplate) {
    throw new Error(`Biometric template was deleted!`);
  }
  console.log(`✓ 10. All cadet attributes, biometrics, role, and status remain 100% intact.`);

  console.log('\n=============================================================');
  console.log('ALL AUTHENTICATION & OTP RECOVERY TESTS PASSED (0 ERRORS)');
  console.log('=============================================================\n');
}

main()
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
