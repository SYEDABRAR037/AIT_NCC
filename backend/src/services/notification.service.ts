import { Role } from '@prisma/client';
import { prisma } from '../db';

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
 * Create In-App Notification in Database
 */
export const createInAppNotification = async (payload: {
  userId?: string;
  targetRole?: Role;
  title: string;
  message: string;
  isUrgent?: boolean;
  type?: string;
  priority?: string;
  eventKey?: string;
  referenceType?: string;
  referenceId?: string;
  securityMandatory?: boolean;
}) => {
  try {
    const record = await prisma.notification.create({
      data: {
        userId: payload.userId,
        targetRole: payload.targetRole,
        title: payload.title,
        message: payload.message,
        isUrgent: payload.isUrgent || false,
        type: payload.type || 'SYSTEM',
        priority: payload.priority || (payload.isUrgent ? 'HIGH' : 'NORMAL'),
        eventKey: payload.eventKey,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        securityMandatory: payload.securityMandatory || false,
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
  remarks?: string,
  referenceId?: string
) => {
  const isApproved = status === 'APPROVED';
  const title = `Leave Application ${status}`;
  const message = `Cadet ${cadet.fullName} (${cadet.regimentalNumber}), your ${leaveType} leave from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} has been ${status} by ${approverName}.${remarks ? ` Remarks: ${remarks}` : ''}`;

  // 1. In-App Notification
  await createInAppNotification({
    userId: cadet.id,
    title,
    message,
    isUrgent: !isApproved,
    type: 'LEAVE_DECISION',
    referenceType: 'LEAVE',
    referenceId: String(referenceId || ''),
    eventKey: referenceId ? `leave-decision:${referenceId}:${status}` : undefined,
  });

};

/**
 * High-level trigger: Notify Certificate Issued
 */
export const notifyCertificateIssued = async (
  cadet: { id: string; fullName: string; email: string; phone?: string | null; regimentalNumber: string },
  cert: { certificateNo: string; title: string; grade: string; verificationHash: string }
) => {
  const title = `Official NCC Certificate Conferred`;
  const message = `Cadet ${cadet.fullName}, you have been officially conferred the ${cert.title} with Grade '${cert.grade}' by the Associate NCC Officer and Commanding Officer.`;

  // 1. In-App
  await createInAppNotification({
    userId: cadet.id,
    title,
    message,
    isUrgent: false,
    type: 'CERTIFICATE_ISSUED',
    referenceType: 'CERTIFICATE',
    referenceId: cert.certificateNo,
    eventKey: `certificate-issued:${cert.certificateNo}`,
  });

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

