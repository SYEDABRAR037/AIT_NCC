import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const helperPath = new URL('../src/utils/registrationPhoto.ts', import.meta.url);
const componentPath = new URL('../src/components/auth/RegisterModal.tsx', import.meta.url);
const helperText = await readFile(helperPath, 'utf8');
const transpiled = ts.transpileModule(helperText, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

const testDependencies = (dataUrlSizes) => {
  let encodingAttempt = 0;
  const drawnDimensions = [];
  return {
    drawnDimensions,
    dependencies: {
      decode: async () => ({ width: 3200, height: 2400, source: {} }),
      createCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: (_image, _x, _y, width, height) => drawnDimensions.push([width, height]) }),
      }),
      encode: async () => ({ attempt: encodingAttempt++ }),
      toDataUrl: async ({ attempt }) => `data:image/jpeg;base64,${'A'.repeat(dataUrlSizes[Math.min(attempt, dataUrlSizes.length - 1)])}`,
    },
  };
};

test('registration payload sends the photo only as profilePhotoUrl', () => {
  const payload = helper.createRegistrationPayload({ fullName: 'Synthetic', phone: '+919876543210', profilePhoto: 'duplicate' }, 'email-proof', 'data:image/jpeg;base64,photo');
  assert.equal(payload.profilePhotoUrl, 'data:image/jpeg;base64,photo');
  assert.equal(Object.hasOwn(payload, 'profilePhoto'), false);
  assert.equal(payload.emailChallengeId, 'email-proof');
  assert.equal(payload.phone, '+919876543210');
});

test('large photo is repeatedly compressed until it is within the conservative budget', async () => {
  const mock = testDependencies([60 * 1024, 30 * 1024]);
  const result = await helper.compressRegistrationPhoto({ type: 'image/jpeg', size: 5 * 1024 * 1024 }, mock.dependencies);
  assert.ok(new TextEncoder().encode(result).byteLength <= helper.MAX_PROFILE_PHOTO_DATA_URL_BYTES);
  assert.ok(mock.drawnDimensions.length >= 2);
  assert.ok(mock.drawnDimensions[0][0] <= 1600 && mock.drawnDimensions[0][1] <= 1600);
});

test('photo that cannot fit the budget is rejected with a safe fixed error', async () => {
  const mock = testDependencies([60 * 1024]);
  await assert.rejects(
    helper.compressRegistrationPhoto({ type: 'image/jpeg', size: 5 * 1024 * 1024 }, mock.dependencies),
    (error) => error.message === 'PHOTO_TOO_LARGE',
  );
});

test('optional photo payload remains valid and complete JSON is budgeted below parser default', () => {
  const payload = helper.createRegistrationPayload({ fullName: 'Synthetic', phone: '+919876543210' }, 'email-proof', null);
  assert.equal(payload.profilePhotoUrl, null);
  assert.ok(helper.registrationPayloadByteLength(payload) < helper.MAX_REGISTRATION_JSON_BYTES);
});

test('complete JSON that exceeds the safe body budget is rejected before submission', () => {
  const payload = helper.createRegistrationPayload({ fullName: 'Synthetic', phone: '+919876543210' }, 'email-proof', `data:image/jpeg;base64,${'A'.repeat(90 * 1024)}`);
  assert.equal(helper.isRegistrationPayloadWithinBudget(payload), false);
});

test('component uses email proof and required mobile while adding only the single photo field', async () => {
  const source = await readFile(componentPath, 'utf8');
  assert.match(source, /if \(!verifiedEmail \|\| !emailProofId\)/);
  assert.match(source, /name="phone"[\s\S]*?required/);
  assert.match(source, /createRegistrationPayload\(formData, emailProofId, profilePhoto\)/);
  assert.match(source, /if \(!isRegistrationPayloadWithinBudget\(payload\)\)/);
  assert.doesNotMatch(source, /profilePhotoUrl:\s*profilePhoto,[\s\S]{0,80}profilePhoto,/);
});
