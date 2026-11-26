import crypto from 'node:crypto';

const STAGING_RENDER_SERVICE_ID = 'srv-dc2j1eec6qcc73f6i8t0';
const STAGING_RENDER_BRANCH = 'ncc-backend-staging';
const STAGING_RENDER_URL = 'https://ait-ncc-backend-staging.onrender.com';
const STAGING_RENDER_SERVICE_NAME = 'ait-ncc-backend-staging';
const DIAGNOSTIC_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DiagnosticEnvironment = Readonly<Record<string, string | undefined>>;

const configuredValue = (value?: string): boolean => Boolean(value?.trim() && !/^your_.*$/i.test(value.trim()));

export function isStagingEmailDiagnosticEnabled(env: DiagnosticEnvironment): boolean {
  const secret = env.NCC_STAGING_EMAIL_DIAGNOSTIC_SECRET?.trim() || '';
  const recipient = env.NCC_STAGING_EMAIL_DIAGNOSTIC_RECIPIENT?.trim() || '';
  const recipientDomain = recipient.toLowerCase().split('@')[1] || '';
  const sameAsOtherSecret = [env.JWT_SECRET, env.OTP_SECRET, env.BREVO_API_KEY, env.RECOVERY_RELAY_SECRET]
    .some((other) => Boolean(other) && other === secret);

  return env.NODE_ENV === 'production'
    && env.RENDER === 'true'
    && env.RENDER_SERVICE_ID === STAGING_RENDER_SERVICE_ID
    && env.RENDER_SERVICE_NAME === STAGING_RENDER_SERVICE_NAME
    && env.NCC_STAGING_EMAIL_DIAGNOSTIC_EXPECTED_SERVICE_ID === STAGING_RENDER_SERVICE_ID
    && env.RENDER_GIT_BRANCH === STAGING_RENDER_BRANCH
    && env.RENDER_EXTERNAL_URL === STAGING_RENDER_URL
    && env.IS_PULL_REQUEST === 'false'
    && env.NCC_STAGING_EMAIL_DIAGNOSTIC_ENABLED === 'true'
    && DIAGNOSTIC_SECRET_PATTERN.test(secret)
    && !sameAsOtherSecret
    && EMAIL_PATTERN.test(recipient)
    && !/\.(?:invalid|test|example)$/.test(recipientDomain)
    && !/^(?:example\.(?:com|net|org)|test\.com|invalid\.com)$/i.test(recipientDomain)
    && configuredValue(env.BREVO_API_KEY)
    && EMAIL_PATTERN.test(env.BREVO_SENDER_EMAIL?.trim() || '')
    && configuredValue(env.BREVO_SENDER_EMAIL);
}

export function isValidDiagnosticAuthorization(
  env: DiagnosticEnvironment,
  suppliedSecret: unknown,
): boolean {
  if (!isStagingEmailDiagnosticEnabled(env) || typeof suppliedSecret !== 'string') return false;
  const expected = Buffer.from(env.NCC_STAGING_EMAIL_DIAGNOSTIC_SECRET!.trim(), 'utf8');
  const supplied = Buffer.from(suppliedSecret, 'utf8');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

export const stagingEmailDiagnosticIdentity = Object.freeze({
  serviceId: STAGING_RENDER_SERVICE_ID,
  branch: STAGING_RENDER_BRANCH,
  externalUrl: STAGING_RENDER_URL,
});
