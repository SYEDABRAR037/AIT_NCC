import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const SENDER_EMAIL = 'kashmirgaming033@gmail.com';
const SENDER_NAME = process.env.SMTP_FROM_NAME || 'Army Institute of Technology NCC';
const SMTP_USER = process.env.SMTP_USER || SENDER_EMAIL;
const SENDER_PASS = (process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const OTP_TTL_MS = 60_000;
const requestLimits = new Map<string, number[]>();
const dummySessions = new Map<string, { email: string; lastIssuedAt: number; issuedAtTimes: number[] }>();

const isRateLimited = (key: string, max: number, windowMs: number): boolean => {
  const now = Date.now();
  const recent = (requestLimits.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    requestLimits.set(key, recent);
    return true;
  }
  recent.push(now);
  requestLimits.set(key, recent);
  return false;
};

const genericChallenge = (email: string, headers: Record<string, string>) => {
  const serverNow = new Date();
  const recoveryId = crypto.randomUUID();
  dummySessions.set(recoveryId, { email: email ? maskEmail(email.trim()) : 'your registered email address', lastIssuedAt: serverNow.getTime(), issuedAtTimes: [serverNow.getTime()] });
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      challengeAccepted: true,
      nextStep: 'VERIFY_OTP',
      message: 'If the details match an account, a code was sent to its registered email address.',
      recoveryId,
      verificationId: recoveryId,
      maskedEmail: dummySessions.get(recoveryId)!.email,
      expiresAt: new Date(serverNow.getTime() + OTP_TTL_MS).toISOString(),
      serverNow: serverNow.toISOString(),
    }),
  };
};

const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local.charAt(0)}*@${domain}`;
  return `${local.charAt(0)}${'*'.repeat(Math.min(local.length - 2, 8))}${local.charAt(local.length - 1)}@${domain}`;
};

const sendMailOverSmtp = async (recipientEmail: string, cadetName: string, otp: string): Promise<boolean> => {
  try {
    if (!SENDER_PASS || !SMTP_USER || SMTP_USER.toLowerCase() !== SENDER_EMAIL) return false;
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SENDER_PASS,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });

    const subject = 'NCC Account Recovery — One-Time Password (OTP)';
    const textContent = `Dear ${cadetName || 'Cadet'},

Your NCC account recovery OTP is:

${otp}

This OTP is valid for 60 seconds only.

Please do not share this OTP with anyone.

If you did not request an account recovery, please ignore this email.

Regards,
NCC AIT Pune
NCC Digital Command & Cadet Management System`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px; color: #0F172A; }
    .card { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #031B4E; color: #FFFFFF; padding: 24px; text-align: center; border-bottom: 3px solid #C59A27; }
    .header h2 { margin: 0; font-size: 20px; letter-spacing: 0.05em; font-weight: 700; color: #FFFFFF; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.08em; }
    .body { padding: 30px 24px; }
    .salutation { font-size: 15px; font-weight: 600; color: #1E293B; margin-bottom: 12px; }
    .intro { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
    .otp-box { background: #F1F5F9; border: 2px dashed #031B4E; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 12px; text-transform: uppercase; font-weight: 700; color: #64748B; letter-spacing: 0.1em; margin-bottom: 6px; }
    .otp-code { font-size: 32px; font-weight: 800; color: #031B4E; letter-spacing: 0.25em; font-family: monospace; }
    .validity { font-size: 12px; color: #D97706; font-weight: 600; margin-top: 6px; }
    .notice { font-size: 13px; color: #64748B; line-height: 1.5; margin-top: 20px; border-left: 3px solid #CBD5E1; padding-left: 12px; }
    .footer { background: #F8FAFC; padding: 20px 24px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B; line-height: 1.5; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>NCC AIT PUNE</h2>
      <p>Official Account Recovery System</p>
    </div>
    <div class="body">
      <div class="salutation">Dear ${cadetName || 'Cadet'},</div>
      <div class="intro">
        Your NCC account recovery OTP is:
      </div>
      <div class="otp-box">
        <div class="otp-label">One-Time Password</div>
        <div class="otp-code">${otp}</div>
        <div class="validity">Valid for 60 seconds only</div>
      </div>
      <div class="notice">
        Please do not share this OTP with anyone.<br><br>
        If you did not request an account recovery, please ignore this email.
      </div>
    </div>
    <div class="footer">
      <strong>NCC AIT Pune</strong><br>
      NCC Digital Command & Cadet Management System<br>
      Army Institute of Technology (AIT), Dighi Hills, Pune 411015
    </div>
  </div>
</body>
</html>
`;

    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (err) {
    console.error('[NETLIFY RECOVERY] Email dispatch failed:', err);
    return false;
  }
};

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Determine action from query string or path or body
  const action =
    event.queryStringParameters?.action ||
    event.path.split('/').pop() ||
    'request-otp';

  let body: Record<string, any>;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid request.' }) };
  }

  const clientIp = event.headers['x-nf-client-connection-ip'] || 'unknown';
  const maxRequestsByAction: Record<string, number> = { 'request-otp': 10, 'resend-otp': 20, 'verify-otp': 30, 'reset-password': 10 };
  if (maxRequestsByAction[action] && isRateLimited(`${action}:${clientIp}`, maxRequestsByAction[action], 10 * 60_000)) {
    return { statusCode: 429, headers, body: JSON.stringify({ success: false, message: 'Please wait before trying again.' }) };
  }
  if (!DATABASE_URL || !JWT_SECRET) {
    return { statusCode: 503, headers, body: JSON.stringify({ success: false, message: 'Account recovery is temporarily unavailable.' }) };
  }

  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pgClient.connect();

    // 1. REQUEST OTP
    if (action === 'request-otp') {
      const { email, regimentalNumber } = body;
      if (typeof email !== 'string' || typeof regimentalNumber !== 'string' || !email.trim() || !regimentalNumber.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Both registered Email ID and Regimental Number are required.',
          }),
        };
      }

      const userRes = await pgClient.query(
        'SELECT id, email, "fullName", "regimentalNumber" FROM "User" WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND UPPER(TRIM("regimentalNumber")) = UPPER(TRIM($2))',
        [email, regimentalNumber]
      );

      if (userRes.rows.length === 0) {
        return genericChallenge(email, headers);
      }

      const user = userRes.rows[0];
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentRequests = await pgClient.query(
        'SELECT COUNT(*)::int AS count FROM "PasswordReset" WHERE "userId" = $1 AND "createdAt" >= $2',
        [user.id, hourAgo]
      );
      if (recentRequests.rows[0].count >= 5 || isRateLimited(`account:${user.id}`, 5, 60 * 60_000)) {
        return genericChallenge(email, headers);
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const recoveryId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);

      // Invalidate existing unused records
      await pgClient.query('UPDATE "PasswordReset" SET "usedAt" = NOW() WHERE "userId" = $1 AND "usedAt" IS NULL', [
        user.id,
      ]);

      // Insert new PasswordReset record
      await pgClient.query(
        'INSERT INTO "PasswordReset" (id, "userId", "otpHash", "expiresAt", "attemptCount", "lastResendAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 0, NOW(), NOW(), NOW())',
        [recoveryId, user.id, otpHash, expiresAt]
      );

      // Send OTP email
      const emailSent = await sendMailOverSmtp(user.email, user.fullName, otp);
      if (!emailSent) {
        // Rollback
        await pgClient.query('DELETE FROM "PasswordReset" WHERE id = $1', [recoveryId]);
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Unable to send the verification email right now. Please try again.',
          }),
        };
      }

      // Start the 60-second window after the provider accepts the email.
      const issuedAt = new Date();
      const actualExpiresAt = new Date(issuedAt.getTime() + OTP_TTL_MS);
      await pgClient.query('UPDATE "PasswordReset" SET "expiresAt" = $1, "lastResendAt" = $2 WHERE id = $3', [actualExpiresAt, issuedAt, recoveryId]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          challengeAccepted: true,
          nextStep: 'VERIFY_OTP',
          message: 'If the details match an account, a code was sent to its registered email address.',
          recoveryId,
          verificationId: recoveryId,
          maskedEmail: maskEmail(user.email),
          expiresAt: actualExpiresAt.toISOString(),
          serverNow: issuedAt.toISOString(),
        }),
      };
    }

    // 2. RESEND OTP
    if (action === 'resend-otp') {
      const { recoveryId } = body;
      if (!recoveryId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Recovery session ID required.' }),
        };
      }

      const prevRes = await pgClient.query(
        'SELECT r.id, r."userId", r."lastResendAt", u.email, u."fullName" FROM "PasswordReset" r JOIN "User" u ON r."userId" = u.id WHERE r.id = $1',
        [recoveryId]
      );

      if (prevRes.rows.length === 0) {
        const dummy = dummySessions.get(String(recoveryId));
        if (!dummy || Date.now() - dummy.lastIssuedAt < 45_000) {
          return { statusCode: 429, headers, body: JSON.stringify({ success: false, message: 'Please wait 45 seconds before requesting a new code.' }) };
        }
        const recentDummyIssues = dummy.issuedAtTimes.filter((time) => Date.now() - time < 60 * 60_000);
        if (recentDummyIssues.length >= 5) {
          return { statusCode: 429, headers, body: JSON.stringify({ success: false, message: 'Please wait before requesting another code.' }) };
        }
        const issuedAt = new Date();
        const newRecoveryId = crypto.randomUUID();
        dummySessions.delete(String(recoveryId));
        dummySessions.set(newRecoveryId, { email: dummy.email, lastIssuedAt: issuedAt.getTime(), issuedAtTimes: [...recentDummyIssues, issuedAt.getTime()] });
        const expiresAt = new Date(issuedAt.getTime() + OTP_TTL_MS);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            challengeAccepted: true,
            nextStep: 'VERIFY_OTP',
            message: 'If the details match an account, a code was sent to its registered email address.',
            recoveryId: newRecoveryId,
            verificationId: newRecoveryId,
            maskedEmail: dummy.email,
            expiresAt: expiresAt.toISOString(),
            serverNow: issuedAt.toISOString(),
          }),
        };
      }

      const prev = prevRes.rows[0];
      const cooldownMs = 45 * 1000;
      const timeSinceLast = Date.now() - new Date(prev.lastResendAt).getTime();
      if (timeSinceLast < cooldownMs) {
        const waitSecs = Math.ceil((cooldownMs - timeSinceLast) / 1000);
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ success: false, message: `Please wait ${waitSecs} seconds before requesting a new OTP.` }),
        };
      }

      const issuedLastHour = await pgClient.query(
        'SELECT COUNT(*)::int AS count FROM "PasswordReset" WHERE "userId" = $1 AND "createdAt" >= $2',
        [prev.userId, new Date(Date.now() - 60 * 60_000)]
      );
      if (issuedLastHour.rows[0].count >= 5) {
        return { statusCode: 429, headers, body: JSON.stringify({ success: false, message: 'Please wait before requesting another code.' }) };
      }

      if (isRateLimited(`resend:${prev.userId}`, 5, 60 * 60_000)) {
        return { statusCode: 429, headers, body: JSON.stringify({ success: false, message: 'Please wait 45 seconds before requesting a new code.' }) };
      }

      await pgClient.query('UPDATE "PasswordReset" SET "usedAt" = NOW() WHERE id = $1', [prev.id]);

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const newRecoveryId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);

      await pgClient.query(
        'INSERT INTO "PasswordReset" (id, "userId", "otpHash", "expiresAt", "attemptCount", "lastResendAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 0, NOW(), NOW(), NOW())',
        [newRecoveryId, prev.userId, otpHash, expiresAt]
      );

      const emailSent = await sendMailOverSmtp(prev.email, prev.fullName, otp);
      if (!emailSent) {
        await pgClient.query('DELETE FROM "PasswordReset" WHERE id = $1', [newRecoveryId]);
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({ success: false, message: 'Unable to send the verification email right now.' }),
        };
      }

      const issuedAt = new Date();
      const actualExpiresAt = new Date(issuedAt.getTime() + OTP_TTL_MS);
      await pgClient.query('UPDATE "PasswordReset" SET "expiresAt" = $1, "lastResendAt" = $2 WHERE id = $3', [actualExpiresAt, issuedAt, newRecoveryId]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          challengeAccepted: true,
          nextStep: 'VERIFY_OTP',
          message: 'If the details match an account, a code was sent to its registered email address.',
          recoveryId: newRecoveryId,
          verificationId: newRecoveryId,
          maskedEmail: maskEmail(prev.email),
          expiresAt: actualExpiresAt.toISOString(),
          serverNow: issuedAt.toISOString(),
        }),
      };
    }

    // 3. VERIFY OTP
    if (action === 'verify-otp') {
      const { recoveryId, otp } = body;
      if (!recoveryId || !otp) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Please provide both recovery session ID and 6-digit OTP.' }),
        };
      }

      const resetRes = await pgClient.query('SELECT * FROM "PasswordReset" WHERE id = $1', [recoveryId]);
      if (resetRes.rows.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Invalid or expired OTP. Please request a new one.' }),
        };
      }

      const reset = resetRes.rows[0];
      if (reset.usedAt) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Invalid or expired OTP. Please request a new one.' }),
        };
      }

      if (Date.now() >= new Date(reset.expiresAt).getTime()) {
        await pgClient.query('UPDATE "PasswordReset" SET "usedAt" = NOW() WHERE id = $1', [reset.id]);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'The verification OTP has expired. Please request a new one.' }),
        };
      }

      if (reset.attemptCount >= 5) {
        await pgClient.query('UPDATE "PasswordReset" SET "usedAt" = NOW() WHERE id = $1', [reset.id]);
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ success: false, message: 'Too many incorrect attempts. Please request a new OTP.' }),
        };
      }

      const isOtpValid = /^\d{6}$/.test(String(otp)) && await bcrypt.compare(String(otp), reset.otpHash);
      if (!isOtpValid) {
        const attemptResult = await pgClient.query(
          'UPDATE "PasswordReset" SET "attemptCount" = "attemptCount" + 1, "usedAt" = CASE WHEN "attemptCount" + 1 >= 5 THEN NOW() ELSE "usedAt" END WHERE id = $1 AND "usedAt" IS NULL AND "attemptCount" < 5 RETURNING "attemptCount"',
          [reset.id]
        );
        const attempts = attemptResult.rows[0]?.attemptCount || 5;

        if (attempts >= 5) {
          return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ success: false, message: 'Too many incorrect attempts. Please request a new OTP.' }),
          };
        }

        const remaining = 5 - attempts;
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid or expired OTP. Please request a new one.',
          }),
        };
      }

      const verified = await pgClient.query(
        'UPDATE "PasswordReset" SET "verifiedAt" = NOW() WHERE id = $1 AND "usedAt" IS NULL AND "verifiedAt" IS NULL AND "expiresAt" > NOW() RETURNING id',
        [reset.id]
      );
      if (verified.rows.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid or expired recovery session.' }) };
      }

      const resetToken = jwt.sign(
        { userId: reset.userId, recoveryId: reset.id, purpose: 'PASSWORD_RESET' },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          verified: true,
          nextStep: 'RESET_PASSWORD',
          status: 'OTP_VERIFIED',
          message: 'OTP verified successfully. You may now create your new password.',
          resetToken,
        }),
      };
    }

    // 4. RESET PASSWORD
    if (action === 'reset-password') {
      const { resetToken, newPassword, confirmPassword } = body;
      if (!resetToken || !newPassword || !confirmPassword) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Please provide reset token and your new password.' }),
        };
      }

      if (newPassword !== confirmPassword) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'New password and confirmation password do not match.' }),
        };
      }

      if (String(newPassword).length < 6) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Password must be at least 6 characters in length.' }),
        };
      }

      let decoded: any;
      try {
        decoded = jwt.verify(resetToken, JWT_SECRET);
      } catch {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, message: 'Password reset session has expired or is invalid.' }),
        };
      }

      if (decoded.purpose !== 'PASSWORD_RESET' || !decoded.userId || !decoded.recoveryId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Invalid password recovery token.' }),
        };
      }

      const resetRes = await pgClient.query('SELECT * FROM "PasswordReset" WHERE id = $1', [decoded.recoveryId]);
      if (resetRes.rows.length === 0 || resetRes.rows[0].userId !== decoded.userId || !resetRes.rows[0].verifiedAt || resetRes.rows[0].usedAt) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Password recovery session has already been used or expired.' }),
        };
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Atomic Transaction: update passwordHash and invalidate recovery records
      await pgClient.query('BEGIN');
      try {
        const claimed = await pgClient.query(
          'UPDATE "PasswordReset" SET "usedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1 AND "userId" = $2 AND "verifiedAt" IS NOT NULL AND "usedAt" IS NULL RETURNING id',
          [decoded.recoveryId, decoded.userId]
        );
        if (claimed.rows.length !== 1) throw new Error('Reset session already consumed');

        await pgClient.query('UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2', [
          passwordHash,
          decoded.userId,
        ]);

        await pgClient.query(
          'UPDATE "PasswordReset" SET "usedAt" = NOW(), "updatedAt" = NOW() WHERE "userId" = $1 AND "usedAt" IS NULL',
          [decoded.userId]
        );

        await pgClient.query('COMMIT');
      } catch (txErr) {
        await pgClient.query('ROLLBACK');
        throw txErr;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          passwordReset: true,
          nextStep: 'LOGIN',
          status: 'PASSWORD_RESET_SUCCESS',
          message: 'Your password has been updated successfully. You may now log in.',
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, message: `Unknown recovery action: ${action}` }),
    };
  } catch (error: any) {
    console.error('[NETLIFY RECOVERY] Request failed:', error?.name || 'internal error');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Unable to complete password reset right now. Please try again.',
      }),
    };
  } finally {
    await pgClient.end().catch(() => { });
  }
};
