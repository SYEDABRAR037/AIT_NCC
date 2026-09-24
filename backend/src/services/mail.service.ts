import nodemailer, { Transporter } from 'nodemailer';

interface SendOtpEmailParams {
  recipientEmail: string;
  cadetName: string;
  otp: string;
  expiresInMinutes?: number;
}

let transporter: Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } else {
    // Development / fallback transporter
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass',
      },
    });
  }

  return transporter;
};

export const sendOtpEmail = async ({
  recipientEmail,
  cadetName,
  otp,
  expiresInMinutes = 5,
}: SendOtpEmailParams): Promise<{ success: boolean; messageId?: string; simulated?: boolean }> => {
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@ncc.aitpune.edu.in';
  const mailFromName = process.env.MAIL_FROM_NAME || 'NCC AIT Pune Command';

  const textContent = `Dear Cadet,

A password reset request was initiated for your NCC AIT Pune account.

Your One-Time Password (OTP) is:

${otp}

This OTP is valid for ${expiresInMinutes} minutes.

Do not share this OTP with anyone.

If you did not request a password reset, you can safely ignore this email.

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
    .header h2 { margin: 0; font-size: 20px; letter-spacing: 0.05em; font-weight: 700; }
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
      <p>Digital Command & Cadet Management System</p>
    </div>
    <div class="body">
      <div class="salutation">Dear ${cadetName || 'Cadet'},</div>
      <div class="intro">
        A password reset request was initiated for your NCC AIT Pune institutional account.
      </div>
      <div class="otp-box">
        <div class="otp-label">Your One-Time Password (OTP)</div>
        <div class="otp-code">${otp}</div>
        <div class="validity">Valid for ${expiresInMinutes} minutes only</div>
      </div>
      <div class="notice">
        <strong>Security Notice:</strong> Do not share this OTP with anyone. Institutional officers will never ask for your verification code. If you did not initiate this request, you can safely ignore this email.
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

  try {
    const hasSmtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);

    if (!hasSmtpConfigured) {
      console.warn(`[MAIL SERVICE] SMTP credentials not set. OTP email generation simulated for ${recipientEmail}.`);
      return { success: true, simulated: true };
    }

    const client = getTransporter();
    const info = await client.sendMail({
      from: `"${mailFromName}" <${mailFrom}>`,
      to: recipientEmail,
      subject: 'NCC AIT Pune — Password Reset OTP',
      text: textContent,
      html: htmlContent,
    });

    return { success: true, messageId: info.messageId, simulated: false };
  } catch (error: any) {
    console.error('[MAIL SERVICE] Failed to dispatch OTP email:', error?.message || error);
    // Return simulated success in case of network/SMTP restriction during non-production runs
    if (process.env.NODE_ENV !== 'production') {
      return { success: true, simulated: true };
    }
    throw error;
  }
};
