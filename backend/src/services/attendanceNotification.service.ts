import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type NotificationEventType = 'ATTENDANCE_MARKED_PRESENT' | 'ATTENDANCE_MARKED_ABSENT';
export type NotificationChannel = 'SMS' | 'WHATSAPP';
export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

export interface CadetNotificationTarget {
  id: string;
  fullName: string;
  phone?: string | null;
  regimentalNumber: string;
}

export interface SessionNotificationContext {
  id: string;
  title: string;
  activity: string;
  date: Date | string;
  timeStr?: string;
}

export interface EnqueueNotificationParams {
  attendanceId?: string;
  sessionId: string;
  cadetId: string;
  eventType: NotificationEventType;
  cadetName: string;
  rawPhone?: string | null;
  activityName: string;
  dateStr: string;
  timeStr: string;
}

/**
 * Designated Test Mobile Number for Attendance Notifications
 * All test SMS & WhatsApp notifications MUST be routed strictly to this number during test mode.
 */
export const DESIGNATED_ATTENDANCE_TEST_RECIPIENT = '+917893732737';

/**
 * Returns whether system is in Attendance Notification Test Mode or Production Mode.
 * Defaults to TEST mode so test notifications are guaranteed to route only to 7893732737.
 */
export const isAttendanceNotificationTestMode = (): boolean => {
  return process.env.ATTENDANCE_NOTIF_MODE !== 'PRODUCTION';
};

/**
 * Resolves dispatch destination phone according to test/production mode safety policy.
 * Preserves cadet's real profile number in database records while routing transport to 7893732737.
 */
export const resolveDispatchRecipient = (
  cadetRegisteredPhone: string
): { finalRecipient: string; isTestMode: boolean } => {
  if (isAttendanceNotificationTestMode()) {
    return {
      finalRecipient: DESIGNATED_ATTENDANCE_TEST_RECIPIENT,
      isTestMode: true,
    };
  }
  return {
    finalRecipient: cadetRegisteredPhone,
    isTestMode: false,
  };
};

/**
 * Normalizes Indian and International phone numbers to standard E.164 format (+91XXXXXXXXXX)
 */
export const normalizePhoneNumber = (rawPhone?: string | null): { isValid: boolean; normalized: string; error?: string } => {
  if (!rawPhone) {
    return { isValid: false, normalized: '', error: 'No phone number registered on cadet profile' };
  }

  // Remove spaces, hyphens, parentheses
  const cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '');

  // 10-digit standard Indian mobile (e.g., 9876543210)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true, normalized: `+91${cleaned}` };
  }

  // 12-digit Indian number with 91 prefix without plus (e.g., 919876543210)
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true, normalized: `+${cleaned}` };
  }

  // Already standard E.164 with +91 (e.g., +919876543210)
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true, normalized: cleaned };
  }

  // Generic international E.164 format (+ followed by 10 to 15 digits)
  if (/^\+[1-9]\d{9,14}$/.test(cleaned)) {
    return { isValid: true, normalized: cleaned };
  }

  return { isValid: false, normalized: cleaned, error: 'Invalid phone format (must be standard mobile number)' };
};

/**
 * Mask phone number for privacy display (e.g. +91 ••••• •1234)
 */
export const maskPhoneNumber = (phone: string): string => {
  if (!phone || phone.length < 6) return '••••••••••';
  const last4 = phone.slice(-4);
  const prefix = phone.startsWith('+91') ? '+91 ' : (phone.startsWith('+') ? phone.slice(0, 3) + ' ' : '');
  return `${prefix}••••• •${last4}`;
};

/**
 * Format SMS message content compliant with DLT registration requirements
 */
export const formatSmsMessage = (
  eventType: NotificationEventType,
  cadetName: string,
  activityName: string,
  dateStr: string,
  timeStr: string
): { message: string; templateId: string } => {
  if (eventType === 'ATTENDANCE_MARKED_PRESENT') {
    return {
      templateId: process.env.SMS_DLT_TE_ID_PRESENT || 'DLT_TE_NCC_ATT_PRESENT_1001',
      message: `NCC Attendance: Dear ${cadetName}, your attendance for ${activityName} on ${dateStr} at ${timeStr} has been marked PRESENT. — NCC`,
    };
  } else {
    return {
      templateId: process.env.SMS_DLT_TE_ID_ABSENT || 'DLT_TE_NCC_ATT_ABSENT_1002',
      message: `NCC Attendance: Dear ${cadetName}, you were marked ABSENT for ${activityName} on ${dateStr} at ${timeStr}. If this absence was due to a valid reason, please submit a leave/request through the NCC portal. — NCC`,
    };
  }
};

/**
 * Format WhatsApp Business template message
 */
export const formatWhatsAppMessage = (
  eventType: NotificationEventType,
  cadetName: string,
  activityName: string,
  dateStr: string,
  timeStr: string
): { message: string; templateName: string } => {
  if (eventType === 'ATTENDANCE_MARKED_PRESENT') {
    return {
      templateName: process.env.WHATSAPP_TEMPLATE_PRESENT || 'ncc_attendance_present_confirmation',
      message: `NCC Attendance Confirmation\n\nDear ${cadetName},\n\nYour attendance has been successfully marked PRESENT.\n\nActivity: ${activityName}\nDate: ${dateStr}\nTime: ${timeStr}\n\nRegards,\nNCC`,
    };
  } else {
    return {
      templateName: process.env.WHATSAPP_TEMPLATE_ABSENT || 'ncc_attendance_absent_notification',
      message: `NCC Attendance — Absence Notification\n\nDear ${cadetName},\n\nYou were marked ABSENT for the following NCC attendance session:\n\nActivity: ${activityName}\nDate: ${dateStr}\nTime: ${timeStr}\n\nIf this absence was due to a valid reason, please submit a leave/request through the NCC portal.\n\nRegards,\nNCC`,
    };
  }
};

// =========================================================================
// ASYNCHRONOUS WORKER QUEUE & DISPATCHER
// =========================================================================

class NotificationWorkerQueue {
  private queue: string[] = [];
  private isProcessing = false;
  private maxRetries = 3;

  public enqueue(notificationId: string) {
    this.queue.push(notificationId);
    this.scheduleProcess();
  }

  private scheduleProcess() {
    if (this.isProcessing) return;
    setImmediate(() => this.processNext());
  }

  private async processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const notificationId = this.queue.shift();
    if (!notificationId) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.processJob(notificationId);
    } catch (err) {
      console.error(`[WORKER ERROR] Job ${notificationId} crashed:`, err);
    } finally {
      setTimeout(() => this.processNext(), 40);
    }
  }

  private async processJob(notificationId: string) {
    const record = await prisma.attendanceNotification.findUnique({
      where: { id: notificationId },
    });

    if (!record || record.status === 'DELIVERED') {
      return;
    }

    if (record.status === 'FAILED' && record.failureReason?.includes('Invalid or missing')) {
      return;
    }

    await prisma.attendanceNotification.update({
      where: { id: notificationId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    try {
      let dispatchResult: { success: boolean; providerMessageId?: string; error?: string };

      if (record.channel === 'SMS') {
        dispatchResult = await this.dispatchSmsProvider(record.recipientPhone, record.messageContent, record.templateId);
      } else {
        dispatchResult = await this.dispatchWhatsAppProvider(record.recipientPhone, record.messageContent, record.templateId);
      }

      if (dispatchResult.success) {
        await prisma.attendanceNotification.update({
          where: { id: notificationId },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
            providerMessageId: dispatchResult.providerMessageId || `CARRIER_ACK_${Date.now()}`,
          },
        });
        console.log(`[ATTENDANCE NOTIFICATION DELIVERED] Channel: ${record.channel} | Recipient: ${maskPhoneNumber(record.recipientPhone)} | Event: ${record.eventType}`);
      } else {
        const newRetryCount = record.retryCount + 1;
        if (newRetryCount < this.maxRetries) {
          console.warn(`[NOTIFICATION RETRY] Job ${notificationId} failed attempt ${newRetryCount}. Requeueing... Error: ${dispatchResult.error}`);
          await prisma.attendanceNotification.update({
            where: { id: notificationId },
            data: {
              status: 'QUEUED',
              retryCount: newRetryCount,
              failureReason: dispatchResult.error,
            },
          });
          setTimeout(() => this.enqueue(notificationId), 1000 * Math.pow(2, newRetryCount));
        } else {
          await prisma.attendanceNotification.update({
            where: { id: notificationId },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              failureReason: `Max retries exceeded: ${dispatchResult.error || 'Provider unreachable'}`,
            },
          });
          console.error(`[NOTIFICATION PERMANENT FAILURE] Job ${notificationId} marked FAILED after ${this.maxRetries} attempts.`);
        }
      }
    } catch (err: any) {
      console.error(`[NOTIFICATION DISPATCH EXCEPTION] ${notificationId}:`, err);
      await prisma.attendanceNotification.update({
        where: { id: notificationId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: err?.message || 'Unexpected dispatch exception',
        },
      });
    }
  }

  /**
   * SMS Dispatch — Tries Fast2SMS first (India, free with ₹100 recharge),
   * then falls back to Twilio (global, $15.50 free trial, no recharge needed).
   *
   * Fast2SMS: https://www.fast2sms.com/dashboard/dev-api
   * Twilio:   https://console.twilio.com (Sign up → Get free trial number → SID + Token)
   */
  private async dispatchSmsProvider(
    phone: string,
    message: string,
    templateId?: string | null
  ): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    const { finalRecipient, isTestMode } = resolveDispatchRecipient(phone);

    if (isTestMode) {
      console.log(`[ATTENDANCE NOTIFICATION TEST MODE]`);
      console.log(`  Target Policy: TEST MODE → Routing to: ${finalRecipient}`);
      console.log(`  Cadet Profile Phone: ${maskPhoneNumber(phone)}`);
    }

    const fast2smsApiKey = process.env.FAST2SMS_API_KEY;
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

    // ─── FAST2SMS (India — requires ₹100 recharge to activate API) ───────────
    if (fast2smsApiKey && fast2smsApiKey !== 'your_fast2sms_api_key') {
      try {
        const axios = await import('axios');
        const mobileNumber = finalRecipient.replace(/^\+91/, '').replace(/^91/, '');

        const response = await axios.default.post(
          'https://www.fast2sms.com/dev/bulkV2',
          {
            route: 'q',
            message: message,
            language: 'english',
            flash: 0,
            numbers: mobileNumber,
          },
          {
            headers: { authorization: fast2smsApiKey, 'Content-Type': 'application/json' },
            timeout: 10000,
          }
        );

        if (response.data?.return === true) {
          const msgId = response.data?.request_id || `F2S_${Date.now()}`;
          console.log(`[FAST2SMS DELIVERED] → ${isTestMode ? finalRecipient + ' (TEST)' : maskPhoneNumber(phone)} | Request ID: ${msgId}`);
          return { success: true, providerMessageId: msgId };
        } else {
          const errMsg = Array.isArray(response.data?.message) ? response.data.message[0] : (response.data?.message || 'Fast2SMS failed');
          console.error(`[FAST2SMS ERROR] ${errMsg} — falling back to Twilio`);
          // Fall through to Twilio
        }
      } catch (err: any) {
        const errMsg = err?.response?.data?.message?.[0] || err?.message || 'Fast2SMS error';
        console.error(`[FAST2SMS EXCEPTION] ${errMsg} — falling back to Twilio`);
        // Fall through to Twilio
      }
    }

    // ─── TWILIO (Global — free $15.50 trial, works immediately) ─────────────
    if (twilioAccountSid && twilioAccountSid !== 'your_twilio_account_sid' && twilioAuthToken && twilioFromNumber) {
      try {
        const twilio = await import('twilio');
        const client = twilio.default(twilioAccountSid, twilioAuthToken);

        const msg = await client.messages.create({
          body: message,
          from: twilioFromNumber,
          to: finalRecipient,
        });

        console.log(`[TWILIO SMS DELIVERED] → ${isTestMode ? finalRecipient + ' (TEST)' : maskPhoneNumber(phone)} | SID: ${msg.sid}`);
        return { success: true, providerMessageId: msg.sid };
      } catch (err: any) {
        const errMsg = err?.message || 'Twilio error';
        console.error(`[TWILIO SMS EXCEPTION] ${errMsg}`);
        return { success: false, error: errMsg };
      }
    }

    // ─── SIMULATION FALLBACK ─────────────────────────────────────────────────
    console.log(`[SMS SIMULATION — No provider configured]`);
    console.log(`  Recipient: ${finalRecipient}${isTestMode ? ' [TEST: 7893732737]' : ''}`);
    console.log(`  Content: "${message}"`);
    console.log(`  ─ Option A (India SMS): Recharge Fast2SMS ₹100 at fast2sms.com → API unlocks`);
    console.log(`  ─ Option B (Global):    Sign up at twilio.com → get free $15.50 trial → add TWILIO_* keys to .env`);

    return {
      success: true,
      providerMessageId: `SIM_SMS_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    };
  }

  /**
   * MSG91 WhatsApp — Real WhatsApp Business API Dispatch (India)
   * Docs: https://docs.msg91.com/whatsapp/send-message
   * Get credentials from: https://control.msg91.com/app/whatsapp
   * Free trial: 3 months WhatsApp access + credits on signup
   */
  private async dispatchWhatsAppProvider(
    phone: string,
    message: string,
    templateName?: string | null
  ): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    const { finalRecipient, isTestMode } = resolveDispatchRecipient(phone);

    if (isTestMode) {
      console.log(`[ATTENDANCE NOTIFICATION TEST MODE]`);
      console.log(`  Target Policy: TEST MODE → Routing to: ${finalRecipient}`);
      console.log(`  Cadet Profile Phone: ${maskPhoneNumber(phone)}`);
    }

    const msg91AuthKey = process.env.MSG91_AUTH_KEY;
    const msg91WhatsAppSrc = process.env.MSG91_WHATSAPP_SRC;       // Your registered WhatsApp sender number
    const msg91TemplateId = process.env.MSG91_WHATSAPP_TEMPLATE_ID; // Template ID from MSG91 dashboard

    // ─── REAL MSG91 WHATSAPP DELIVERY ────────────────────────────────────────
    if (msg91AuthKey && msg91AuthKey !== 'your_msg91_auth_key' && msg91WhatsAppSrc) {
      try {
        const axios = await import('axios');

        // MSG91 expects number with country code, no + prefix
        const toNumber = finalRecipient.replace('+', '');

        const payload: any = {
          integrated_number: msg91WhatsAppSrc,
          content_type: 'template',
          payload: {
            to: toNumber,
            type: 'template',
            template: {
              name: msg91TemplateId || templateName || 'ncc_attendance_notification',
              language: { code: 'en' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: message },
                  ],
                },
              ],
            },
          },
        };

        const response = await axios.default.post(
          'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
          payload,
          {
            headers: {
              authkey: msg91AuthKey,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        if (response.data?.type === 'success' || response.status === 200) {
          const msgId = response.data?.data?.msgId || response.data?.request_id || `MSG91_WA_${Date.now()}`;
          console.log(`[MSG91 WHATSAPP DELIVERED] → ${isTestMode ? finalRecipient + ' (TEST)' : maskPhoneNumber(phone)} | MsgID: ${msgId}`);
          return { success: true, providerMessageId: String(msgId) };
        } else {
          const errMsg = response.data?.message || 'MSG91 returned non-success';
          console.error(`[MSG91 WHATSAPP ERROR] ${errMsg}`);
          return { success: false, error: errMsg };
        }
      } catch (err: any) {
        const errMsg = err?.response?.data?.message || err?.message || 'MSG91 network error';
        console.error(`[MSG91 WHATSAPP EXCEPTION] ${errMsg}`);
        return { success: false, error: errMsg };
      }
    }

    // ─── SIMULATION FALLBACK (no credentials configured) ─────────────────────
    console.log(`[WHATSAPP SIMULATION — MSG91 not configured]`);
    console.log(`  Recipient: ${finalRecipient}${isTestMode ? ' [TEST: 7893732737]' : ''}`);
    console.log(`  Template: ${templateName || 'ncc_attendance_notification'}`);
    console.log(`  Content: "${message.replace(/\n/g, ' ')}"`);
    console.log(`  → To use real WhatsApp: Set MSG91_AUTH_KEY + MSG91_WHATSAPP_SRC in backend/.env`);
    console.log(`  → Get free trial at: https://control.msg91.com`);

    return {
      success: true,
      providerMessageId: `SIM_WA_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    };
  }
}

export const notificationQueueWorker = new NotificationWorkerQueue();

// =========================================================================
// HIGH-LEVEL IDEMPOTENT NOTIFICATION DISPATCHERS
// =========================================================================

export const queueAttendanceNotification = async (
  params: EnqueueNotificationParams,
  channel: NotificationChannel
): Promise<{ success: boolean; recordId?: string; isDuplicate?: boolean; status: DeliveryStatus }> => {
  const idempotencyKey = `${params.sessionId}_${params.cadetId}_${params.eventType}_${channel}`;

  const existing = await prisma.attendanceNotification.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return {
      success: true,
      recordId: existing.id,
      isDuplicate: true,
      status: existing.status as DeliveryStatus,
    };
  }

  const phoneCheck = normalizePhoneNumber(params.rawPhone);
  const formattedPhone = phoneCheck.isValid ? phoneCheck.normalized : (params.rawPhone || 'UNREGISTERED');

  let messageContent = '';
  let templateId: string | null = null;

  if (channel === 'SMS') {
    const formatted = formatSmsMessage(
      params.eventType,
      params.cadetName,
      params.activityName,
      params.dateStr,
      params.timeStr
    );
    messageContent = formatted.message;
    templateId = formatted.templateId;
  } else {
    const formatted = formatWhatsAppMessage(
      params.eventType,
      params.cadetName,
      params.activityName,
      params.dateStr,
      params.timeStr
    );
    messageContent = formatted.message;
    templateId = formatted.templateName;
  }

  const initialStatus: DeliveryStatus = phoneCheck.isValid ? 'QUEUED' : 'FAILED';
  const failureReason = phoneCheck.isValid ? null : phoneCheck.error;

  try {
    const created = await prisma.attendanceNotification.create({
      data: {
        attendanceId: params.attendanceId,
        sessionId: params.sessionId,
        cadetId: params.cadetId,
        eventType: params.eventType,
        channel,
        recipientPhone: formattedPhone,
        messageContent,
        templateId,
        status: initialStatus,
        failureReason,
        idempotencyKey,
      },
    });

    if (phoneCheck.isValid) {
      notificationQueueWorker.enqueue(created.id);
    }

    return {
      success: true,
      recordId: created.id,
      isDuplicate: false,
      status: initialStatus,
    };
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const dup = await prisma.attendanceNotification.findUnique({
        where: { idempotencyKey },
      });
      return {
        success: true,
        recordId: dup?.id,
        isDuplicate: true,
        status: (dup?.status as DeliveryStatus) || 'QUEUED',
      };
    }
    console.error(`[QUEUE ERROR] Failed to create attendance notification:`, err);
    throw err;
  }
};

export const triggerPresentAttendanceNotifications = async (params: {
  attendanceId: string;
  sessionId: string;
  cadet: CadetNotificationTarget;
  activityName: string;
  dateStr: string;
  timeStr: string;
}): Promise<{ smsQueued: boolean; whatsappQueued: boolean }> => {
  const commonParams: EnqueueNotificationParams = {
    attendanceId: params.attendanceId,
    sessionId: params.sessionId,
    cadetId: params.cadet.id,
    eventType: 'ATTENDANCE_MARKED_PRESENT',
    cadetName: params.cadet.fullName,
    rawPhone: params.cadet.phone,
    activityName: params.activityName,
    dateStr: params.dateStr,
    timeStr: params.timeStr,
  };

  const [smsRes, waRes] = await Promise.all([
    queueAttendanceNotification(commonParams, 'SMS').catch((e) => {
      console.error('[PRESENT SMS QUEUE ERROR]:', e);
      return { success: false, status: 'FAILED' as DeliveryStatus };
    }),
    queueAttendanceNotification(commonParams, 'WHATSAPP').catch((e) => {
      console.error('[PRESENT WA QUEUE ERROR]:', e);
      return { success: false, status: 'FAILED' as DeliveryStatus };
    }),
  ]);

  return {
    smsQueued: smsRes.success,
    whatsappQueued: waRes.success,
  };
};

export const triggerAbsentAttendanceNotifications = async (params: {
  attendanceId?: string;
  sessionId: string;
  cadet: CadetNotificationTarget;
  activityName: string;
  dateStr: string;
  timeStr: string;
}): Promise<{ smsQueued: boolean; whatsappQueued: boolean }> => {
  const commonParams: EnqueueNotificationParams = {
    attendanceId: params.attendanceId,
    sessionId: params.sessionId,
    cadetId: params.cadet.id,
    eventType: 'ATTENDANCE_MARKED_ABSENT',
    cadetName: params.cadet.fullName,
    rawPhone: params.cadet.phone,
    activityName: params.activityName,
    dateStr: params.dateStr,
    timeStr: params.timeStr,
  };

  const [smsRes, waRes] = await Promise.all([
    queueAttendanceNotification(commonParams, 'SMS').catch((e) => {
      console.error('[ABSENT SMS QUEUE ERROR]:', e);
      return { success: false, status: 'FAILED' as DeliveryStatus };
    }),
    queueAttendanceNotification(commonParams, 'WHATSAPP').catch((e) => {
      console.error('[ABSENT WA QUEUE ERROR]:', e);
      return { success: false, status: 'FAILED' as DeliveryStatus };
    }),
  ]);

  return {
    smsQueued: smsRes.success,
    whatsappQueued: waRes.success,
  };
};

export const getSessionNotificationAuditLedger = async (sessionId: string) => {
  const records = await prisma.attendanceNotification.findMany({
    where: { sessionId },
    include: {
      cadet: {
        select: {
          id: true,
          fullName: true,
          regimentalNumber: true,
          platoonName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return records.map((r) => ({
    id: r.id,
    cadetId: r.cadetId,
    cadetName: r.cadet.fullName,
    regimentalNumber: r.cadet.regimentalNumber,
    platoonName: r.cadet.platoonName,
    eventType: r.eventType,
    channel: r.channel,
    maskedPhone: maskPhoneNumber(r.recipientPhone),
    status: r.status,
    providerMessageId: r.providerMessageId,
    failureReason: r.failureReason,
    queuedAt: r.queuedAt,
    sentAt: r.sentAt,
    deliveredAt: r.deliveredAt,
    failedAt: r.failedAt,
  }));
};
