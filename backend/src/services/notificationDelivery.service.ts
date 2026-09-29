import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import webpush, { PushSubscription } from 'web-push';
import { prisma } from '../db';

const MAX_ATTEMPTS = 5;

const expandRoleBroadcasts = async () => {
  const broadcasts = await prisma.notification.findMany({ where: { userId: null, fanoutAt: null }, take: 10, orderBy: { createdAt: 'asc' } });
  for (const broadcast of broadcasts) {
    const recipients = await prisma.user.findMany({ where: { ...(broadcast.targetRole ? { role: broadcast.targetRole } : {}), status: { in: ['ACTIVE', 'APPROVED'] } }, select: { id: true } });
    if (recipients.length) await prisma.notification.createMany({ data: recipients.map(({ id }) => ({ userId: id, title: broadcast.title, message: broadcast.message, isUrgent: broadcast.isUrgent, type: broadcast.type, priority: broadcast.priority, referenceType: broadcast.referenceType, referenceId: broadcast.referenceId, securityMandatory: broadcast.securityMandatory, eventKey: `broadcast:${broadcast.id}:${id}` })), skipDuplicates: true });
    await prisma.notification.update({ where: { id: broadcast.id }, data: { fanoutAt: new Date(), emailStatus: 'FANOUT', pushStatus: 'FANOUT', nextDeliveryAt: new Date('9999-12-31T00:00:00.000Z') } });
  }
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const encryptionKey = (): Buffer => {
  const value = process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Push subscription encryption key is not configured.');
  return Buffer.from(value, 'hex');
};
const encryptSubscription = (subscription: PushSubscription): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(subscription), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
};
const decryptSubscription = (value: string): PushSubscription => {
  const [iv, tag, ciphertext] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')) as PushSubscription;
};

const getWebPush = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ncc@aitpune.edu.in', publicKey, privateKey);
  return webpush;
};

const sendEmail = async (to: string, title: string, message: string, createdAt: Date, actionUrl?: string | null) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM_EMAIL || user;
  if (!host || !user || !password || !from) throw new Error('SMTP is not configured.');
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true' || port === 465, auth: { user, pass: password }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000 });
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const link = actionUrl ? `<p><a href="${escapeHtml(actionUrl)}">Open NCC AIT Pune</a></p>` : '';
  await transporter.sendMail({ from: `"NCC AIT Pune" <${from}>`, to, subject: `NCC AIT Pune – ${title}`, text: `${title}\n\n${message}\n\n${createdAt.toISOString()}${actionUrl ? `\n${actionUrl}` : ''}`, html: `<main style="font-family:Arial,sans-serif;color:#0b1f3a"><h1>NCC AIT Pune</h1><h2>${safeTitle}</h2><p>${safeMessage}</p>${link}<small>${createdAt.toISOString()}</small></main>` });
};

const deliverOne = async (id: string) => {
  const now = new Date();
  const claim = await prisma.notification.updateMany({
    where: { id, nextDeliveryAt: { lte: now }, OR: [{ processingLeaseAt: null }, { processingLeaseAt: { lt: new Date(now.getTime() - 120_000) } }] },
    data: { processingLeaseAt: now },
  });
  if (!claim.count) return;
  try {
    const notification = await prisma.notification.findUnique({ where: { id }, include: { user: { select: { id: true, email: true } } } });
    if (!notification) return;
    if (!notification.userId || !notification.user) {
      await prisma.notification.update({ where: { id }, data: { emailStatus: 'SKIPPED', pushStatus: 'SKIPPED', processingLeaseAt: null } });
      return;
    }
    const preferences = await prisma.notificationPreferences.findUnique({ where: { userId: notification.userId } });
    let nextRetry = new Date(now.getTime() + 60_000);
    const actionUrl = process.env.PUBLIC_APP_URL || 'https://ncc-aitpune.netlify.app/';
    let lastError: string | null = null;

    if (notification.emailStatus === 'PENDING' || notification.emailStatus === 'RETRY') {
      if (preferences?.emailEnabled === false && !notification.securityMandatory) {
        await prisma.notification.update({ where: { id }, data: { emailStatus: 'DISABLED' } });
      } else if (notification.emailAttempts >= MAX_ATTEMPTS) {
        await prisma.notification.update({ where: { id }, data: { emailStatus: 'FAILED' } });
      } else {
        try {
          await sendEmail(notification.user.email, notification.title, notification.message, notification.createdAt, actionUrl);
          await prisma.notification.update({ where: { id }, data: { emailStatus: 'SENT', emailAttempts: { increment: 1 } } });
        } catch (error) {
          const attempts = notification.emailAttempts + 1;
          nextRetry = new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000);
          lastError = error instanceof Error ? error.message : 'Email delivery failed.';
          await prisma.notification.update({ where: { id }, data: { emailStatus: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'RETRY', emailAttempts: attempts } });
        }
      }
    }

    if (notification.pushStatus === 'PENDING' || notification.pushStatus === 'RETRY') {
      if (preferences?.pushEnabled === false && !notification.securityMandatory) {
        await prisma.notification.update({ where: { id }, data: { pushStatus: 'DISABLED' } });
      } else {
        const push = getWebPush();
        const subscriptions = await prisma.webPushSubscription.findMany({ where: { userId: notification.userId } });
        if (!push) {
          await prisma.notification.update({ where: { id }, data: { pushStatus: 'NOT_CONFIGURED' } });
        } else if (!subscriptions.length) {
          await prisma.notification.update({ where: { id }, data: { pushStatus: 'NO_SUBSCRIPTION' } });
        } else if (notification.pushAttempts >= MAX_ATTEMPTS) {
          await prisma.notification.update({ where: { id }, data: { pushStatus: 'FAILED' } });
        } else {
          let anySent = false;
          for (const subscription of subscriptions) {
            try {
              await push.sendNotification(decryptSubscription(subscription.encryptedSubscription), JSON.stringify({ title: notification.title, body: notification.message, url: actionUrl, notificationId: id }));
              anySent = true;
              await prisma.webPushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: now } });
            } catch (error: any) {
              if (error?.statusCode === 404 || error?.statusCode === 410) await prisma.webPushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
              lastError = error instanceof Error ? error.message : 'Push delivery failed.';
            }
          }
          const attempts = notification.pushAttempts + 1;
          await prisma.notification.update({ where: { id }, data: { pushStatus: anySent ? 'SENT' : attempts >= MAX_ATTEMPTS ? 'FAILED' : 'RETRY', pushAttempts: attempts } });
          if (!anySent && attempts < MAX_ATTEMPTS) nextRetry = new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000);
        }
      }
    }
    const current = await prisma.notification.findUnique({ where: { id }, select: { emailStatus: true, pushStatus: true } });
    const retryPending = current && [current.emailStatus, current.pushStatus].some((status) => status === 'PENDING' || status === 'RETRY');
    await prisma.notification.update({ where: { id }, data: { processingLeaseAt: null, nextDeliveryAt: retryPending ? nextRetry : new Date('9999-12-31T00:00:00.000Z'), deliveryLastError: lastError } });
  } catch (error) {
    console.error('Notification delivery worker failed for notification:', id, error instanceof Error ? error.message : 'unknown error');
    await prisma.notification.update({ where: { id }, data: { processingLeaseAt: null, nextDeliveryAt: new Date(Date.now() + 60_000), deliveryLastError: 'Notification delivery worker error.' } }).catch(() => undefined);
  }
};

let running = false;
export const processNotificationDeliveries = async () => {
  if (running) return;
  running = true;
  try {
    await expandRoleBroadcasts();
    const pending = await prisma.notification.findMany({ where: { userId: { not: null }, nextDeliveryAt: { lte: new Date() }, OR: [{ emailStatus: { in: ['PENDING', 'RETRY'] } }, { pushStatus: { in: ['PENDING', 'RETRY'] } }] }, orderBy: { createdAt: 'asc' }, take: 25, select: { id: true } });
    await Promise.all(pending.map(({ id }) => deliverOne(id)));
  } finally { running = false; }
};

export const storePushSubscription = async (userId: string, subscription: PushSubscription) => {
  const endpointHash = createHash('sha256').update(subscription.endpoint).digest('hex');
  const encryptedSubscription = encryptSubscription(subscription);
  return prisma.webPushSubscription.upsert({ where: { endpointHash }, create: { userId, endpointHash, encryptedSubscription }, update: { userId, encryptedSubscription, lastUsedAt: new Date() } });
};

export const removePushSubscription = async (userId: string, endpoint: string) => {
  const endpointHash = createHash('sha256').update(endpoint).digest('hex');
  return prisma.webPushSubscription.deleteMany({ where: { userId, endpointHash } });
};

export const getPushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;
