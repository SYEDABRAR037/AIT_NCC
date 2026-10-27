import assert from 'assert';
import { checkReadiness } from '../health';
import { validateRuntimeConfig } from '../runtimeConfig';

const valid = {
  JWT_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgresql://synthetic:placeholder@db.invalid:5432/ncc_test',
  PORT: '8080',
};

assert.deepStrictEqual(validateRuntimeConfig(valid), { port: 8080 });
assert.deepStrictEqual(validateRuntimeConfig({ ...valid, PORT: undefined }), { port: 5050 });
assert.throws(() => validateRuntimeConfig({ ...valid, DATABASE_URL: undefined }), /DATABASE_URL/);
assert.throws(() => validateRuntimeConfig({ ...valid, DATABASE_URL: 'https://example.invalid/db' }), /PostgreSQL/);
assert.throws(() => validateRuntimeConfig({ ...valid, JWT_SECRET: 'short' }), /JWT_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, JWT_SECRET: '<GENERATE_A_UNIQUE_RANDOM_SECRET>' }), /JWT_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, JWT_SECRET: 'replace_with_a_random_secret_at_least_32_characters' }), /JWT_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, PORT: '65536' }), /PORT/);

void (async () => {
  assert.deepStrictEqual(await checkReadiness(async () => 1), { statusCode: 200, body: { status: 'ready' } });
  assert.deepStrictEqual(await checkReadiness(async () => { throw new Error('private database detail'); }), {
    statusCode: 503,
    body: { status: 'unavailable' },
  });
  console.log('Runtime config and mocked readiness tests passed.');
})();
