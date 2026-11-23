import assert from 'assert';
import {
  BIOMETRIC_CONSENT_PURPOSE,
  BIOMETRIC_DESCRIPTOR_FORMAT,
  BiometricPayload,
  decryptBiometricPayload,
  encryptBiometricPayload,
  isBiometricPayloadCompatible,
  isSyntheticBiometricTemplate,
  loadBiometricKeyring,
  loadBiometricRuntimeConfig,
} from '../services/biometricCrypto.service';

const descriptor = Array.from({ length: 128 }, (_, index) => (index + 1) / 1000);
const key = Buffer.alloc(32, 7);
const keyring = { activeKeyId: 'test-v1', keys: { 'test-v1': key } };
const payload: BiometricPayload = {
  descriptor,
  modelName: 'face-api',
  modelVersion: 'test-model-v1',
  descriptorFormat: BIOMETRIC_DESCRIPTOR_FORMAT,
  captureStatus: 'TEST_ONLY',
  consent: {
    purpose: BIOMETRIC_CONSENT_PURPOSE,
    policyVersion: 'test-policy-v1',
    consentedAt: new Date(0).toISOString(),
    subjectId: 'cadet-test-1',
    recordedById: 'operator-test-1',
    recordedByRole: 'SENIOR',
  },
};

const envelope = encryptBiometricPayload(payload, 'cadet-test-1', keyring);
assert.notStrictEqual(envelope, JSON.stringify(descriptor));
assert.deepStrictEqual(decryptBiometricPayload(envelope, 'cadet-test-1', keyring), payload);
console.log('[PASS] AES-256-GCM biometric envelope encrypts/decrypts with subject-bound AAD');

assert.throws(() => decryptBiometricPayload(envelope, 'cadet-test-2', keyring));
assert.throws(() => decryptBiometricPayload(envelope, 'cadet-test-1', { activeKeyId: 'missing', keys: {} }));
console.log('[PASS] Wrong subject and missing decryption key fail closed');

assert.throws(() => loadBiometricKeyring({} as NodeJS.ProcessEnv));
assert.throws(() => loadBiometricKeyring({
  BIOMETRIC_ENCRYPTION_KEYS: JSON.stringify({ key: Buffer.alloc(31).toString('base64') }),
  BIOMETRIC_ENCRYPTION_ACTIVE_KEY_ID: 'key',
} as NodeJS.ProcessEnv));
assert.throws(() => loadBiometricRuntimeConfig({} as NodeJS.ProcessEnv));
console.log('[PASS] Missing and invalid encryption/runtime configuration is rejected');

assert.throws(() => decryptBiometricPayload(JSON.stringify(descriptor), 'cadet-test-1', keyring));
assert(isSyntheticBiometricTemplate({ registeredBy: 'SYSTEM_ENROLLMENT (legacy synthetic)' }));
assert(isSyntheticBiometricTemplate({ registeredBy: 'TEST_ONLY unit fixture' }));
assert(!isBiometricPayloadCompatible(payload, { modelName: 'face-api', modelVersion: 'test-model-v1' }));
assert(!isBiometricPayloadCompatible({ ...payload, captureStatus: 'SERVER_VERIFIED' }, { modelName: 'other-model', modelVersion: 'test-model-v1' }));
assert(isBiometricPayloadCompatible(payload, { modelName: 'face-api', modelVersion: 'test-model-v1' }, true));
console.log('[PASS] Legacy plaintext, synthetic markers, and incompatible model versions cannot match');

console.log('Biometric hardening unit checks passed.');
