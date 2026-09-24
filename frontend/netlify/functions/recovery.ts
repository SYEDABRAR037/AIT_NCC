import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://ncc_admin:bJEqUwKC6TI1LjRdOz43vwnsEskmtJWq@dpg-daq7ov49v7es73c55f0g-a.singapore-postgres.render.com/ncc_command_db?sslmode=require';

const JWT_SECRET = process.env.JWT_SECRET || 'ncc_command_jwt_super_secure_key_2026_ait_pune';
const SENDER_EMAIL = process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || 'kashmirgaming033@gmail.com';
const SENDER_NAME = process.env.SMTP_FROM_NAME || 'Army Institute of Technology NCC';
const SENDER_PASS = (process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || 'gjemdiespkujqayq').replace(/\s+/g, '');

const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local.charAt(0)}*@${domain}`;
  return `${local.charAt(0)}${'*'.repeat(Math.min(local.length - 2, 8))}${local.charAt(local.length - 1)}@${domain}`;
};

const sendMailOverSmtp = async (recipientEmail: string, cadetName: string, otp: string): Promise<boolean> => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: SENDER_EMAIL,
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

This OTP is valid for 1 minutes.

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
        <div class="validity">Valid for 5 minutes only</div>
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

  const body = JSON.parse(event.body || '{}');

  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pgClient.connect();

    // 1. REQUEST OTP
    if (action === 'request-otp') {
      const { email, regimentalNumber } = body;
      if (!email || !regimentalNumber) {
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
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'No registered cadet found matching both the provided Email ID and Regimental Number.',
          }),
        };
      }

      const user = userRes.rows[0];
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const recoveryId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          otpSent: true,
          nextStep: 'VERIFY_OTP',
          status: 'OTP_SENT',
          message: 'A verification code has been dispatched to your official registered email address.',
          recoveryId,
          verificationId: recoveryId,
          maskedEmail: maskEmail(user.email),
          expiresInSeconds: 300,
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
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'Invalid or expired recovery session.' }),
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

      await pgClient.query('UPDATE "PasswordReset" SET "usedAt" = NOW() WHERE id = $1', [prev.id]);

      const otp = crypto.randomInt(100000, 999999).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const newRecoveryId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          otpSent: true,
          nextStep: 'VERIFY_OTP',
          status: 'OTP_SENT',
          message: 'A fresh verification code has been dispatched.',
          recoveryId: newRecoveryId,
          verificationId: newRecoveryId,
          maskedEmail: maskEmail(prev.email),
          expiresInSeconds: 300,
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
          body: JSON.stringify({ success: false, message: 'Invalid or expired recovery session.' }),
        };
      }

      const reset = resetRes.rows[0];
      if (reset.usedAt) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: 'This OTP has already been utilized.' }),
        };
      }

      if (new Date() > new Date(reset.expiresAt)) {
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

      const isOtpValid = await bcrypt.compare(String(otp).trim(), reset.otpHash);
      if (!isOtpValid) {
        const attempts = reset.attemptCount + 1;
        await pgClient.query('UPDATE "PasswordReset" SET "attemptCount" = $1, "usedAt" = $2 WHERE id = $3', [
          attempts,
          attempts >= 5 ? new Date() : null,
          reset.id,
        ]);

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
            message: `Invalid OTP. Please check the code and try again. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`,
          }),
        };
      }

      await pgClient.query('UPDATE "PasswordReset" SET "verifiedAt" = NOW() WHERE id = $1', [reset.id]);

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
      if (resetRes.rows.length === 0 || !resetRes.rows[0].verifiedAt || resetRes.rows[0].usedAt) {
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
        await pgClient.query('UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2', [
          passwordHash,
          decoded.userId,
        ]);

        await pgClient.query('UPDATE "PasswordReset" SET "usedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1', [
          decoded.recoveryId,
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
    console.error('[NETLIFY RECOVERY] Error:', error);
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
