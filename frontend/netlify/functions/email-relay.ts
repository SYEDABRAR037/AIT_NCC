import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import nodemailer from 'nodemailer';

const SENDER_EMAIL = process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || 'kashmirgaming033@gmail.com';
const SENDER_NAME = process.env.SMTP_FROM_NAME || 'Army Institute of Technology NCC';
// App password for kashmirgaming033@gmail.com
const SENDER_PASS = (process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || 'gjemdiespkujqayq').replace(/\s+/g, '');
const RELAY_SECRET = process.env.RECOVERY_RELAY_SECRET || process.env.JWT_SECRET || 'ncc_command_jwt_super_secure_key_2026_ait_pune';

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { secret, recipientEmail, cadetName, otp, expiresInMinutes = 5, subject, htmlContent, textContent } = body;

    // Validate relay authorization
    const reqSecret = event.headers['x-relay-secret'] || secret;
    if (reqSecret !== RELAY_SECRET) {
      console.warn('[EMAIL-RELAY] Unauthorized dispatch attempt.');
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Unauthorized relay access' }),
      };
    }

    if (!recipientEmail || !otp) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Missing recipient email or OTP' }),
      };
    }

    console.log(`[EMAIL-RELAY] Dispatching OTP for ${cadetName || 'Cadet'} to ${recipientEmail}...`);

    // Create secure transporter on port 465 (AWS Lambda/Netlify allows outbound 465)
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

    const emailSubject = subject || 'NCC Account Recovery — OTP Verification';
    const emailText =
      textContent ||
      `Dear Cadet,

Your One-Time Password (OTP) for NCC account recovery is:

${otp}

This OTP is valid for ${expiresInMinutes} minutes.

If you did not request an account recovery, please ignore this email.

Regards,
NCC
Army Institute of Technology, Pune
Official Account Recovery System`;

    const emailHtml =
      htmlContent ||
      `
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
      <div class="salutation">Dear Cadet,</div>
      <div class="intro">
        Your One-Time Password (OTP) for NCC account recovery is:
      </div>
      <div class="otp-box">
        <div class="otp-label">One-Time Password</div>
        <div class="otp-code">${otp}</div>
        <div class="validity">Valid for ${expiresInMinutes} minutes only</div>
      </div>
      <div class="notice">
        If you did not request an account recovery, please ignore this email. Do not share this OTP with anyone.
      </div>
    </div>
    <div class="footer">
      <strong>NCC Unit — 2 Maharashtra Battalion NCC</strong><br>
      Army Institute of Technology (AIT), Dighi Hills, Pune 411015
    </div>
  </div>
</body>
</html>
`;

    const info = await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: recipientEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    console.log(`[EMAIL-RELAY] Message dispatched successfully (ID: ${info.messageId})`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
      }),
    };
  } catch (err: any) {
    console.error('[EMAIL-RELAY] Dispatch failed:', err?.message || err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: err?.message || 'Email dispatch failed via relay',
      }),
    };
  }
};
