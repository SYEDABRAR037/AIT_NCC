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
  const rawPass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.MAIL_PASSWORD || 'gjemdiespkujqayq';
  const pass = rawPass.replace(/\s+/g, ''); // Strip any accidental spaces from 16-char Google App Password

  const isGmail = host.includes('gmail.com') || user.endsWith('@gmail.com');

  if (isGmail) {
    // Port 465 direct SSL with timeouts to prevent socket hangs
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 8000,
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
  const pass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.MAIL_PASSWORD || 'gjemdiespkujqayq';

  // Exact Subject required by Phase 12
  const subject = 'NCC Account Recovery — One-Time Password (OTP)';

  // Exact Body required by Phase 12
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

  // Strategy 1: Dispatch via HTTPS over port 443 to the Netlify Relay
  // This bypasses cloud hosting provider SMTP port blocks (e.g. Render free tier blocks ports 25, 465, 587)
  const relayUrl =
    process.env.EMAIL_RELAY_URL || 'https://ncc-aitpune.netlify.app/.netlify/functions/email-relay';

  if (relayUrl) {
    try {
      console.log(`[MAIL SERVICE] Dispatching OTP via HTTPS Relay (${relayUrl}) to ${recipientEmail}...`);
      const relaySecret =
        process.env.RECOVERY_RELAY_SECRET ||
        process.env.JWT_SECRET ||
        'ncc_command_jwt_super_secure_key_2026_ait_pune';

      const controller = new AbortController();
      const relayTimeout = setTimeout(() => controller.abort(), 9000);

      const resp = await fetch(relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-relay-secret': relaySecret,
        },
        body: JSON.stringify({
          recipientEmail,
          cadetName,
          otp,
          expiresInMinutes,
          subject,
          textContent,
          htmlContent,
        }),
        signal: controller.signal,
      });

      clearTimeout(relayTimeout);

      if (resp.ok) {
        const data = (await resp.json()) as any;
        if (data.success) {
          console.log(`[MAIL SERVICE] EMAIL_SEND_ACCEPTED: Accepted via HTTPS Relay (ID: ${data.messageId})`);
          return { success: true, messageId: data.messageId };
        }
      } else {
        console.warn(`[MAIL SERVICE] Relay returned status ${resp.status}. Falling back to direct SMTP...`);
      }
    } catch (relayErr: any) {
      console.warn('[MAIL SERVICE] HTTPS Relay failed or timed out:', relayErr?.message || relayErr);
    }
  }

  // Strategy 2: Direct Nodemailer SMTP (works on local machine, non-restricted VPS, or paid tiers)
  try {
    const client = getTransporter();
    console.log(`[MAIL SERVICE] EMAIL_SEND_STARTED: Direct SMTP from ${mailFrom} to ${recipientEmail}`);

    const sendPromise = client.sendMail({
      from: `"${mailFromName}" <${mailFrom}>`,
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Direct SMTP dispatch timed out after 8 seconds.')), 8000);
    });

    const info = (await Promise.race([sendPromise, timeoutPromise])) as any;

    console.log(`[MAIL SERVICE] EMAIL_SEND_ACCEPTED: Message accepted by mail provider (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (smtpErr: any) {
    console.error('[MAIL SERVICE] DIRECT_SMTP_FAILED:', smtpErr?.message || smtpErr);

    // If direct SMTP failed and we haven't tried the Netlify relay yet, try it now!
    if (!relayUrl) {
      try {
        console.log(`[MAIL SERVICE] Retrying dispatch via Netlify HTTPS Relay to ${recipientEmail}...`);
        const fallbackRelayUrl = 'https://ncc-aitpune.netlify.app/.netlify/functions/email-relay';
        const relaySecret =
          process.env.RECOVERY_RELAY_SECRET ||
          process.env.JWT_SECRET ||
          'ncc_command_jwt_super_secure_key_2026_ait_pune';

        const controller = new AbortController();
        const relayTimeout = setTimeout(() => controller.abort(), 9000);

        const resp = await fetch(fallbackRelayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-relay-secret': relaySecret,
          },
          body: JSON.stringify({
            recipientEmail,
            cadetName,
            otp,
            expiresInMinutes,
            subject,
            textContent,
            htmlContent,
          }),
          signal: controller.signal,
        });

        clearTimeout(relayTimeout);

        if (resp.ok) {
          const data = (await resp.json()) as any;
          if (data.success) {
            console.log(`[MAIL SERVICE] EMAIL_SEND_ACCEPTED: Accepted via HTTPS Relay (ID: ${data.messageId})`);
            return { success: true, messageId: data.messageId };
          }
        }
      } catch (fallbackErr: any) {
        console.error('[MAIL SERVICE] Fallback relay also failed:', fallbackErr?.message || fallbackErr);
      }
    }

    return { success: false, error: smtpErr?.message || 'Email delivery failed' };
  }
};
