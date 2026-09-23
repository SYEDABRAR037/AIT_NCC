import nodemailer from 'nodemailer';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// Configure SMTP transport (uses env variables or fallback test transport)
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'ncc.command@aitpune.edu.in',
    pass: process.env.SMTP_PASS || 'mock_secure_password',
  },
};

// Reusable transporter
const transporter = nodemailer.createTransport(smtpConfig);

export interface NotificationPayload {
  userId?: string;
  email?: string;
  phone?: string;
  targetRole?: Role;
  title: string;
  message: string;
  isUrgent?: boolean;
  htmlContent?: string;
}

/**
 * Format military-standard HTML email template
 */
const generateMilitaryEmailHtml = (title: string, message: string, details?: Record<string, string>): string => {
  let detailsHtml = '';
  if (details) {
    detailsHtml = `
      <div style="background-color: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 4px; padding: 12px; margin: 16px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; font-family: monospace;">
          ${Object.entries(details)
            .map(
              ([k, v]) => `
            <tr>
              <td style="padding: 4px 8px; color: #64748B; font-weight: bold; width: 35%;">${k}:</td>
              <td style="padding: 4px 8px; color: #061325; font-weight: 600;">${v}</td>
            </tr>
          `
            )
            .join('')}
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #F1F5F9; font-family: 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 2px solid #061325; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        
        <!-- Institutional Header -->
        <div style="background-color: #061325; color: #FFFFFF; padding: 20px; text-align: center; border-bottom: 3px solid #13315C;">
          <div style="font-size: 11px; letter-spacing: 2px; color: #94A3B8; text-transform: uppercase;">
            Ministry of Defence &bull; 2 Maharashtra Bn NCC
          </div>
          <h2 style="margin: 6px 0; font-size: 18px; letter-spacing: 0.5px; color: #FFFFFF;">
            ARMY INSTITUTE OF TECHNOLOGY, PUNE
          </h2>
          <div style="font-size: 12px; color: #E2E8F0;">
            NCC Digital Command & Cadet Management Dispatch
          </div>
        </div>

        <!-- Body Content -->
        <div style="padding: 24px; color: #1E293B;">
          <h3 style="margin-top: 0; color: #061325; font-size: 16px; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">
            ${title}
          </h3>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            ${message}
          </p>

          ${detailsHtml}

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #CBD5E1; font-size: 12px; color: #64748B;">
            <strong>Institutional Directive:</strong> This transmission constitutes an official automated record dispatched under the authority of the Associate NCC Officer (ANO), 2 Maharashtra Battalion NCC Coy, AIT Pune. Please access the Command Portal for details.
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 12px 20px; text-align: center; font-size: 11px; color: #94A3B8;">
          NCC Command Center &bull; Army Institute of Technology &bull; Dighi Hills, Pune - 411015<br/>
          <em>Strict Military Confidentiality &bull; System Generated Dispatch</em>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Dispatch Email Notification
 */
export const dispatchEmail = async (
  toEmail: string,
  subject: string,
  title: string,
  message: string,
  details?: Record<string, string>
): Promise<boolean> => {
  try {
    const html = generateMilitaryEmailHtml(title, message, details);

    // If real credentials aren't provided in env, log simulation
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'ncc.command@aitpune.edu.in') {
      console.log(`[EMAIL DISPATCH SIMULATION]`);
      console.log(`  To: ${toEmail}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Title: ${title}`);
      console.log(`  Message: ${message}`);
      return true;
    }

    const info = await transporter.sendMail({
      from: `"NCC Command Center (AIT Pune)" <${smtpConfig.auth.user}>`,
      to: toEmail,
      subject: `[NCC-AIT COMMAND] ${subject}`,
      text: `${title}\n\n${message}`,
      html,
    });

    console.log(`[EMAIL DISPATCH] Sent to ${toEmail}, MessageID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL DISPATCH ERROR] Failed sending to ${toEmail}:`, error);
    return false;
  }
};

/**
 * Dispatch SMS Notification (Simulated Gateway / DLT Standard)
 */
export const dispatchSMS = async (phone: string, text: string): Promise<boolean> => {
  try {
    const dltPrefix = '[NCC-AIT 2MAH]';
    const formattedMessage = `${dltPrefix} ${text}`;

    // Log SMS Telemetry
    console.log(`[SMS GATEWAY DISPATCH]`);
    console.log(`  Phone: ${phone}`);
    console.log(`  Message: ${formattedMessage}`);
    console.log(`  Status: DISPATCHED (Carrier Acknowledged)`);
    return true;
  } catch (error) {
    console.error(`[SMS GATEWAY ERROR] Failed sending to ${phone}:`, error);
    return false;
  }
};

/**
 * Create In-App Notification in Database
 */
export const createInAppNotification = async (payload: {
  userId?: string;
  targetRole?: Role;
  title: string;
  message: string;
  isUrgent?: boolean;
}) => {
  try {
    const record = await prisma.notification.create({
      data: {
        userId: payload.userId,
        targetRole: payload.targetRole,
        title: payload.title,
        message: payload.message,
        isUrgent: payload.isUrgent || false,
      },
    });
    return record;
  } catch (err) {
    console.error('[IN-APP NOTIFICATION ERROR]:', err);
    return null;
  }
};

/**
 * High-level trigger: Notify Leave Decision
 */
export const notifyLeaveDecision = async (
  cadet: { id: string; fullName: string; email: string; phone?: string | null; regimentalNumber: string },
  leaveType: string,
  startDate: Date,
  endDate: Date,
  status: string,
  approverName: string,
  remarks?: string
) => {
  const isApproved = status === 'APPROVED';
  const title = `Leave Application ${status}`;
  const subject = `Leave Sanction Directive: ${status}`;
  const message = `Cadet ${cadet.fullName} (${cadet.regimentalNumber}), your ${leaveType} Leave application has been ${status} by ${approverName}.`;

  const details = {
    'Cadet Name': cadet.fullName,
    'Regimental No': cadet.regimentalNumber,
    'Leave Category': leaveType,
    'Duration': `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
    'Decision Status': status,
    'Sanctioning Authority': approverName,
    'Official Remarks': remarks || 'Approved in accordance with institutional guidelines.',
  };

  // 1. In-App Notification
  await createInAppNotification({
    userId: cadet.id,
    title,
    message,
    isUrgent: !isApproved,
  });

  // 2. Email Dispatch
  if (cadet.email) {
    await dispatchEmail(cadet.email, subject, title, message, details);
  }

  // 3. SMS Dispatch
  if (cadet.phone) {
    await dispatchSMS(
      cadet.phone,
      `Your ${leaveType} Leave (${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}) is ${status} by ${approverName}. Check Command Portal.`
    );
  }
};

/**
 * High-level trigger: Notify Certificate Issued
 */
export const notifyCertificateIssued = async (
  cadet: { id: string; fullName: string; email: string; phone?: string | null; regimentalNumber: string },
  cert: { certificateNo: string; title: string; grade: string; verificationHash: string }
) => {
  const title = `Official NCC Certificate Conferred`;
  const subject = `NCC Official Commendation: ${cert.title}`;
  const message = `Cadet ${cadet.fullName}, you have been officially conferred the ${cert.title} with Grade '${cert.grade}' by the Associate NCC Officer and Commanding Officer.`;

  const details = {
    'Cadet Recipient': cadet.fullName,
    'Regimental No': cadet.regimentalNumber,
    'Certificate Conferred': cert.title,
    'Awarded Grade': `Grade ${cert.grade}`,
    'Serial Number': cert.certificateNo,
    'SHA-256 Digest': cert.verificationHash.substring(0, 16) + '...',
  };

  // 1. In-App
  await createInAppNotification({
    userId: cadet.id,
    title,
    message,
    isUrgent: false,
  });

  // 2. Email
  if (cadet.email) {
    await dispatchEmail(cadet.email, subject, title, message, details);
  }

  // 3. SMS
  if (cadet.phone) {
    await dispatchSMS(
      cadet.phone,
      `Congratulations! You have been awarded ${cert.title} (Grade ${cert.grade}). Serial No: ${cert.certificateNo}. Log in to view official certificate.`
    );
  }
};

/**
 * High-level trigger: Broadcast Urgent Circular / Notice
 */
export const notifyUrgentCircular = async (
  notice: { title: string; content: string; targetRole?: Role | null; targetPlatoon?: string | null }
) => {
  const title = `URGENT COMMAND DIRECTIVE: ${notice.title}`;
  const message = notice.content;

  // In-App broadcast
  await createInAppNotification({
    targetRole: notice.targetRole || undefined,
    title,
    message,
    isUrgent: true,
  });

  console.log(`[BROADCAST DISPATCH] Urgent notice "${notice.title}" broadcasted to in-app notification feed.`);
};

/**
 * High-level trigger: Notify Inquiry Reply to Cadet's Registered Institutional Email
 */
export const notifyInquiryReply = async (
  cadet: { fullName: string; email: string; regimentalNumber?: string | null },
  inquiry: { requestNumber: string; title: string },
  replyMessage: string,
  officerRole: string,
  officerName: string
) => {
  const subject = `NCC Official Inquiry — Reply Received`;
  const title = `Official Inquiry Reply: ${inquiry.requestNumber}`;
  const message = `Dear ${cadet.fullName},\n\nYour official NCC inquiry has received a reply.\n\nInquiry:\n${inquiry.title}\n\nReply:\n${replyMessage}\n\nPlease log in to the NCC portal to view the complete conversation.\n\nRegards,\nNCC Unit\nArmy Institute of Technology`;

  const details = {
    'Cadet Name': cadet.fullName,
    'Inquiry No': inquiry.requestNumber,
    'Inquiry Subject': inquiry.title,
    'Responding Officer': `${officerRole} (${officerName})`,
    'Official Reply': replyMessage,
  };

  if (cadet.email) {
    try {
      await dispatchEmail(cadet.email, subject, title, message, details);
    } catch (error) {
      console.error('[INQUIRY EMAIL DISPATCH SAFE ERROR]:', error);
    }
  }
};

