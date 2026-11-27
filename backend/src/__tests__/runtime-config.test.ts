import assert from 'assert';
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import { checkReadiness } from '../health';
import {
  SUPABASE_CA_FILE_PATH,
  SUPABASE_CA_URL_PATH,
  validateRuntimeConfig,
  validateSupabaseRootCaContents,
  validateSupabaseRootCaFile,
} from '../runtimeConfig';

const valid = {
  JWT_SECRET: 'x'.repeat(32),
  OTP_SECRET: 'y'.repeat(32),
  DATABASE_URL: 'postgresql://test_user:TEST_ONLY_NOT_A_SECRET@db.invalid:5432/test_database',
  PORT: '8080',
};
const strictSupabaseUrl = `postgresql://test_user:TEST_ONLY_NOT_A_SECRET@aws-1-ap-northeast-2.pooler.supabase.invalid:5432/test_database?sslmode=require&sslaccept=strict&sslrootcert=${encodeURIComponent(SUPABASE_CA_URL_PATH)}`;

assert.deepStrictEqual(validateRuntimeConfig(valid), { port: 8080 });
assert.deepStrictEqual(validateRuntimeConfig({ ...valid, PORT: undefined }), { port: 5050 });
assert.deepStrictEqual(validateRuntimeConfig({ ...valid, DIRECT_URL: 'postgresql://test_user:TEST_ONLY_NOT_A_SECRET@db.invalid:5432/test_database' }), { port: 8080 });
assert.throws(() => validateRuntimeConfig({ ...valid, DIRECT_URL: 'https://example.invalid/db' }), /DIRECT_URL.*PostgreSQL/);
assert.throws(() => validateRuntimeConfig({ ...valid, DATABASE_URL: undefined }), /DATABASE_URL/);
assert.throws(() => validateRuntimeConfig({ ...valid, DATABASE_URL: 'https://example.invalid/db' }), /PostgreSQL/);
assert.throws(() => validateRuntimeConfig({ ...valid, JWT_SECRET: 'short' }), /JWT_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, JWT_SECRET: '<GENERATE_A_UNIQUE_RANDOM_SECRET>' }), /JWT_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, JWT_SECRET: 'replace_with_a_random_secret_at_least_32_characters' }), /JWT_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_SECRET: undefined }), /OTP_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_SECRET: 'short' }), /OTP_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_SECRET: 'SET_ME' }), /OTP_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_SECRET: '<GENERATE_A_UNIQUE_RANDOM_SECRET>' }), /OTP_SECRET/);
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_SECRET: 'replace_with_a_random_secret_at_least_32_characters' }), /OTP_SECRET/);
assert.deepStrictEqual(validateRuntimeConfig({ ...valid, OTP_TRANSITION_CUTOFF: '2026-11-07T22:30:00.000Z' }), { port: 8080 });
assert.deepStrictEqual(validateRuntimeConfig({ ...valid, OTP_TRANSITION_CUTOFF: '2026-11-07T22:30:00Z' }), { port: 8080 });
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_TRANSITION_CUTOFF: 'invalid-date' }), /OTP_TRANSITION_CUTOFF.*ISO 8601/);
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_TRANSITION_CUTOFF: '2026-11-07 22:30:00' }), /OTP_TRANSITION_CUTOFF.*ISO 8601/);
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_TRANSITION_CUTOFF: '2026-02-31T22:30:00Z' }), /OTP_TRANSITION_CUTOFF.*ISO 8601/);
assert.throws(() => validateRuntimeConfig({ ...valid, OTP_TRANSITION_CUTOFF: '2026' }), /OTP_TRANSITION_CUTOFF.*ISO 8601/);
assert.throws(() => validateRuntimeConfig({ ...valid, PORT: '65536' }), /PORT/);

// Supabase configuration & SSL validations
assert.throws(
  () => validateRuntimeConfig({
    ...valid,
    DATABASE_URL: strictSupabaseUrl,
    DIRECT_URL: undefined,
  }),
  /Supabase pooled DATABASE_URL requires a dedicated direct DIRECT_URL/
);
assert.throws(
  () => validateRuntimeConfig({
    ...valid,
    DATABASE_URL: strictSupabaseUrl,
    DIRECT_URL: 'postgresql://test_user:TEST_ONLY_NOT_A_SECRET@aws-0-eu.pooler.supabase.invalid:5432/test_database?sslmode=require',
  }),
  /DIRECT_URL cannot point to a Supabase pooler host/
);
assert.throws(
  () => validateRuntimeConfig({
    ...valid,
    DATABASE_URL: 'postgresql://test_user:TEST_ONLY_NOT_A_SECRET@aws-0-eu.pooler.supabase.invalid:5432/test_database?sslmode=require',
    DIRECT_URL: 'postgresql://test_user:TEST_ONLY_NOT_A_SECRET@db.proj.supabase.invalid:5432/test_database?sslmode=require',
  }),
  /strict TLS/
);
assert.throws(
  () => validateRuntimeConfig({
    ...valid,
    DATABASE_URL: strictSupabaseUrl,
    DIRECT_URL: 'postgresql://test_user:TEST_ONLY_NOT_A_SECRET@db.proj.supabase.invalid:5432/test_database',
  }),
  /Supabase DIRECT_URL requires SSL/
);
assert.deepStrictEqual(
  validateRuntimeConfig({
    ...valid,
    DATABASE_URL: strictSupabaseUrl,
    DIRECT_URL: 'postgresql://test_user:TEST_ONLY_NOT_A_SECRET@db.proj.supabase.invalid:5432/test_database?sslmode=require',
  }),
  { port: 8080 }
);

const strictConfig = { ...valid, DATABASE_URL: strictSupabaseUrl, DIRECT_URL: 'postgresql://test_user:TEST_ONLY_NOT_A_SECRET@db.proj.supabase.invalid:5432/test_database?sslmode=require' };
assert.throws(() => validateRuntimeConfig({ ...strictConfig, DATABASE_URL: strictSupabaseUrl.replace('sslaccept=strict&', '') }), /strict TLS/);
assert.throws(() => validateRuntimeConfig({ ...strictConfig, DATABASE_URL: strictSupabaseUrl.replace('sslmode=require', 'sslmode=disable') }), /strict TLS/);
assert.throws(() => validateRuntimeConfig({ ...strictConfig, DATABASE_URL: `${strictSupabaseUrl}&sslmode=disable` }), /strict TLS/);
assert.throws(() => validateRuntimeConfig({ ...strictConfig, DATABASE_URL: `${strictSupabaseUrl}&ssl=off` }), /strict TLS/);
assert.doesNotThrow(() => validateRuntimeConfig(strictConfig));

const pinnedCaContents = fs.readFileSync(SUPABASE_CA_FILE_PATH, 'utf8');
assert.doesNotThrow(() => validateSupabaseRootCaContents(pinnedCaContents));
assert.throws(() => validateSupabaseRootCaFile('/path/that/does/not/exist'), /strict TLS/);
assert.throws(() => validateSupabaseRootCaContents(pinnedCaContents, Date.parse('2032-01-01T00:00:00Z')), /strict TLS/);

const pinnedCa = new X509Certificate(pinnedCaContents);
const tamperedDer = Buffer.from(pinnedCa.raw);
tamperedDer[tamperedDer.length - 1] ^= 1;
const tamperedCa = `-----BEGIN CERTIFICATE-----\n${tamperedDer.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----\n`;
assert.throws(() => validateSupabaseRootCaContents(tamperedCa), /strict TLS/);

const unreadableCaAccess = {
  lstat: () => ({ isFile: () => true, isSymbolicLink: () => false, size: 1367 }),
  readUtf8: () => { throw new Error('EACCES'); },
};
assert.throws(() => validateSupabaseRootCaFile(SUPABASE_CA_FILE_PATH, unreadableCaAccess), /strict TLS/);

void (async () => {
  assert.deepStrictEqual(await checkReadiness(async () => 1), { statusCode: 200, body: { status: 'ready' } });
  assert.deepStrictEqual(await checkReadiness(async () => { throw new Error('private database detail'); }), {
    statusCode: 503,
    body: { status: 'unavailable' },
  });
  console.log('Runtime config and mocked readiness tests passed.');
})();
