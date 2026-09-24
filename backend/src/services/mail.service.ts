import nodemailer, { Transporter } from 'nodemailer';

interface SendOtpEmailParams {
  recipientEmail: string;
  cadetName: string;
  otp: string;
  expiresInMinutes?: number;
}

let transporter: Transporter | null = null;

export const getTransporter = (): Transporter => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || 'kashmirgaming033@gmail.com';
  const rawPass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.MAIL_PASSWORD || '';
  const pass = rawPass.replace(/\s+/g, ''); // Strip any accidental spaces from 16-char Google App Password

  const isGmail = host.includes('gmail.com') || user.endsWith('@gmail.com');

  if (isGmail) {
    // Explicit port 465 direct SSL with strict timeouts to prevent hanging in cloud/Render containers
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 8000, // 8 seconds connection limit
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  } else {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465 || process.env.SMTP_SECURE === 'true',
      auth: {
        user,
        pass,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }

  return transporter;
};

export const verifyEmailService = async (): Promise<{ connected: boolean; message: string }> => {
  try {
    const client = getTransporter();
    await client.verify();
    console.log('[MAIL SERVICE] EMAIL_PROVIDER_AUTHENTICATED: Connected to mail provider successfully.');
    return { connected: true, message: 'Mail provider authenticated.' };
  } catch (err: any) {
    console.error('[MAIL SERVICE] EMAIL_PROVIDER_AUTH_ERROR:', err?.message || err);
    return { connected: false, message: err?.message || 'Authentication failed' };
  }
};

export const sendOtpEmail = async ({
  recipientEmail,
  cadetName,
  otp,
  expiresInMinutes = 5,
}: SendOtpEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const mailFrom = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'kashmirgaming033@gmail.com';
  const mailFromName = process.env.SMTP_FROM_NAME || 'Army Institute of Technology NCC';
  const pass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.MAIL_PASSWORD || '';

  if (!pass) {
    const errorMsg = 'SMTP_PASSWORD secret is not configured on the command server.';
    console.error(`[MAIL SERVICE] FAILED: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }

  // Exact Subject required by Phase 8
  const subject = 'NCC Account Recovery — OTP Verification';

  // Exact Body required by Phase 8
  const textContent = `Dear Cadet,

Your One-Time Password (OTP) for NCC account recovery is:

${otp}

This OTP is valid for ${expiresInMinutes} minutes.

If you did not request an account recovery, please ignore this email.

Regards,
NCC
Army Institute of Technology, Pune
Official Account Recovery System`;

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

  try {
    const client = getTransporter();
    console.log(`[MAIL SERVICE] EMAIL_SEND_STARTED: Dispatching from ${mailFrom} to ${recipientEmail}`);

    const sendPromise = client.sendMail({
      from: `"${mailFromName}" <${mailFrom}>`,
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Email dispatch timed out after 10 seconds.')), 10000);
    });

    const info = (await Promise.race([sendPromise, timeoutPromise])) as any;

    console.log(`[MAIL SERVICE] EMAIL_SEND_ACCEPTED: Message accepted by mail provider (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('[MAIL SERVICE] EMAIL_SEND_FAILED:', error?.message || error);
    return { success: false, error: error?.message || 'Email delivery failed' };
  }
};
