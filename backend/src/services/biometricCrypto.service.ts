import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { isValidFaceDescriptor } from '../utils/biometricDescriptor';

const ENVELOPE_PREFIX = 'nccbio:v1';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export const BIOMETRIC_DESCRIPTOR_FORMAT = 'face-api-float32-128-v1';
export const BIOMETRIC_CONSENT_PURPOSE = 'ATTENDANCE_IDENTIFICATION';

export interface BiometricKeyring {
  activeKeyId: string;
  keys: Record<string, Buffer>;
}

export interface BiometricPayload {
  descriptor: number[];
  modelName: string;
  modelVersion: string;
  descriptorFormat: string;
  captureStatus: 'CLIENT_UNATTESTED' | 'SERVER_VERIFIED' | 'TEST_ONLY';
  consent: {
    purpose: string;
    policyVersion: string;
    consentedAt: string;
    subjectId: string;
    recordedById: string;
    recordedByRole: string;
  };
}

export interface BiometricRuntimeConfig {
  keyring: BiometricKeyring;
  modelName: string;
  modelVersion: string;
  consentPolicyVersion: string;
}

const failConfig = (): never => {
  throw new Error('BIOMETRIC_CRYPTO_CONFIG_INVALID');
};

export const loadBiometricKeyring = (env: NodeJS.ProcessEnv = process.env): BiometricKeyring => {
  const raw = env.BIOMETRIC_ENCRYPTION_KEYS?.trim();
  const activeKeyId = env.BIOMETRIC_ENCRYPTION_ACTIVE_KEY_ID?.trim();
  if (!raw || !activeKeyId || /^your_|^set_me$/i.test(raw) || /[:\s]/.test(activeKeyId)) return failConfig();

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return failConfig(); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return failConfig();

  const keys: Record<string, Buffer> = {};
  for (const [keyId, encoded] of Object.entries(parsed as Record<string, unknown>)) {
    if (!keyId || /[:\s]/.test(keyId) || typeof encoded !== 'string') return failConfig();
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) return failConfig();
    keys[keyId] = key;
  }

  if (!keys[activeKeyId]) return failConfig();
  return { activeKeyId, keys };
};

export const loadBiometricRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): BiometricRuntimeConfig => {
  const modelName = env.BIOMETRIC_MODEL_NAME?.trim();
  const modelVersion = env.BIOMETRIC_MODEL_VERSION?.trim();
  const consentPolicyVersion = env.BIOMETRIC_CONSENT_POLICY_VERSION?.trim();
  if (!modelName || !modelVersion || !consentPolicyVersion) return failConfig();
  return { keyring: loadBiometricKeyring(env), modelName, modelVersion, consentPolicyVersion };
};

const aadFor = (cadetId: string) => `${ENVELOPE_PREFIX}:${cadetId}`;

export const encryptBiometricPayload = (
  payload: BiometricPayload,
  cadetId: string,
  keyring: BiometricKeyring,
): string => {
  if (!cadetId || !isValidFaceDescriptor(payload.descriptor)) throw new Error('BIOMETRIC_PAYLOAD_INVALID');
  const key = keyring.keys[keyring.activeKeyId];
  if (!key || key.length !== 32) return failConfig();

  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(aadFor(cadetId), 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_PREFIX, keyring.activeKeyId, nonce.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
};

export const decryptBiometricPayload = (
  envelope: string,
  cadetId: string,
  keyring: BiometricKeyring,
): BiometricPayload => {
  const parts = envelope.split(':');
  if (parts.length !== 6 || `${parts[0]}:${parts[1]}` !== ENVELOPE_PREFIX) throw new Error('BIOMETRIC_LEGACY_OR_INVALID');
  const [, , keyId, nonceText, tagText, ciphertextText] = parts;
  const key = keyring.keys[keyId];
  const nonce = Buffer.from(nonceText, 'base64url');
  const tag = Buffer.from(tagText, 'base64url');
  const ciphertext = Buffer.from(ciphertextText, 'base64url');
  if (!key || key.length !== 32 || nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES || !ciphertext.length) {
    throw new Error('BIOMETRIC_KEY_OR_ENVELOPE_INVALID');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(aadFor(cadetId), 'utf8'));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const payload = JSON.parse(plaintext) as BiometricPayload;
  if (!payload || !isValidFaceDescriptor(payload.descriptor)
    || typeof payload.modelName !== 'string' || !payload.modelName
    || typeof payload.modelVersion !== 'string' || !payload.modelVersion
    || payload.descriptorFormat !== BIOMETRIC_DESCRIPTOR_FORMAT
    || !['CLIENT_UNATTESTED', 'SERVER_VERIFIED', 'TEST_ONLY'].includes(payload.captureStatus)
    || payload.consent?.subjectId !== cadetId
    || payload.consent?.purpose !== BIOMETRIC_CONSENT_PURPOSE
    || !payload.consent?.policyVersion
    || !payload.consent?.consentedAt) {
    throw new Error('BIOMETRIC_PAYLOAD_INVALID');
  }
  return payload;
};

export const isBiometricPayloadCompatible = (
  payload: Pick<BiometricPayload, 'modelName' | 'modelVersion' | 'descriptorFormat' | 'captureStatus'>,
  expected: Pick<BiometricRuntimeConfig, 'modelName' | 'modelVersion'>,
  allowTestFixture = false,
): boolean => payload.modelName === expected.modelName
  && payload.modelVersion === expected.modelVersion
  && payload.descriptorFormat === BIOMETRIC_DESCRIPTOR_FORMAT
  && (payload.captureStatus === 'SERVER_VERIFIED' || (allowTestFixture && payload.captureStatus === 'TEST_ONLY'));

export const isSyntheticBiometricTemplate = (template: { registeredBy?: string | null }): boolean =>
  Boolean(template.registeredBy && /^(SYSTEM_ENROLLMENT|TEST_ONLY)(\b|\s|\()/i.test(template.registeredBy));

export const buildBiometricPayload = (
  descriptor: number[],
  cadetId: string,
  actor: { id: string; role: string },
  config: Pick<BiometricRuntimeConfig, 'modelName' | 'modelVersion' | 'consentPolicyVersion'>,
): BiometricPayload => ({
  descriptor,
  modelName: config.modelName,
  modelVersion: config.modelVersion,
  descriptorFormat: BIOMETRIC_DESCRIPTOR_FORMAT,
  // Browser-derived descriptors have no server-side provenance or liveness proof.
  captureStatus: 'CLIENT_UNATTESTED',
  consent: {
    purpose: BIOMETRIC_CONSENT_PURPOSE,
    policyVersion: config.consentPolicyVersion,
    consentedAt: new Date().toISOString(),
    subjectId: cadetId,
    recordedById: actor.id,
    recordedByRole: actor.role,
  },
});
