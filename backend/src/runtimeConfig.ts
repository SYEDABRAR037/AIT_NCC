import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface RuntimeConfig {
  port: number;
}

export const SUPABASE_CA_URL_PATH = './certs/supabase-root-ca.pem';
export const SUPABASE_CA_FILE_PATH = path.resolve(__dirname, '../prisma/certs/supabase-root-ca.pem');
const SUPABASE_CA_SHA256 = '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa';
const SUPABASE_TLS_ERROR = 'Supabase DATABASE_URL must use strict TLS with the pinned root CA certificate.';

export interface CertificateFileAccess {
  lstat(filePath: string): { isFile(): boolean; isSymbolicLink(): boolean; size: number };
  readUtf8(filePath: string): string;
}

const localCertificateFileAccess: CertificateFileAccess = {
  lstat: (filePath) => fs.lstatSync(filePath),
  readUtf8: (filePath) => fs.readFileSync(filePath, 'utf8'),
};

/** Validate the exact pinned Supabase CA contents, without exposing file contents. */
export function validateSupabaseRootCaContents(contents: string, now = Date.now()): void {
  try {
    const certificateBlocks = contents.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
    if (
      certificateBlocks.length !== 1 ||
      contents.replace(certificateBlocks[0] || '', '').trim() !== '' ||
      /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(contents)
    ) {
      throw new Error(SUPABASE_TLS_ERROR);
    }

    const certificate = new X509Certificate(contents);
    const fingerprint = certificate.fingerprint256.replace(/:/g, '').toLowerCase();
    if (
      !certificate.ca ||
      fingerprint !== SUPABASE_CA_SHA256 ||
      !Number.isFinite(Date.parse(certificate.validFrom)) ||
      !Number.isFinite(Date.parse(certificate.validTo)) ||
      now < Date.parse(certificate.validFrom) ||
      now > Date.parse(certificate.validTo)
    ) {
      throw new Error(SUPABASE_TLS_ERROR);
    }
  } catch {
    throw new Error(SUPABASE_TLS_ERROR);
  }
}

/** Check file type/readability before validating the pinned certificate. */
export function validateSupabaseRootCaFile(
  filePath = SUPABASE_CA_FILE_PATH,
  fileAccess: CertificateFileAccess = localCertificateFileAccess,
): string {
  try {
    const stat = fileAccess.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 256 || stat.size > 16384) {
      throw new Error(SUPABASE_TLS_ERROR);
    }
    const contents = fileAccess.readUtf8(filePath);
    validateSupabaseRootCaContents(contents);
    return contents;
  } catch {
    throw new Error(SUPABASE_TLS_ERROR);
  }
}

function validateStrictSupabaseTls(
  databaseUrl: URL,
  fileAccess: CertificateFileAccess = localCertificateFileAccess,
): string {
  const tlsParameters = ['sslmode', 'sslaccept', 'sslrootcert'] as const;
  const values = new Map<string, string>();
  for (const parameter of tlsParameters) {
    const entries = databaseUrl.searchParams.getAll(parameter);
    if (entries.length !== 1) throw new Error(SUPABASE_TLS_ERROR);
    values.set(parameter, entries[0]);
  }

  // `ssl` is not a Prisma v6 PostgreSQL URL parameter; reject it rather than
  // allowing a competing TLS setting to make the effective configuration unclear.
  if (databaseUrl.searchParams.has('ssl')) throw new Error(SUPABASE_TLS_ERROR);
  if (
    values.get('sslmode') !== 'require' ||
    values.get('sslaccept') !== 'strict' ||
    values.get('sslrootcert') !== SUPABASE_CA_URL_PATH
  ) {
    throw new Error(SUPABASE_TLS_ERROR);
  }

  return validateSupabaseRootCaFile(SUPABASE_CA_FILE_PATH, fileAccess);
}

/** Parse a Supabase runtime URL and return the same URL plus the validated pinned CA. */
export function validateSupabaseDatabaseUrlForPgAdapter(
  rawUrl: string,
  fileAccess: CertificateFileAccess = localCertificateFileAccess,
): { url: URL; caPem: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes('supabase.co') && !host.includes('supabase.com')) {
    throw new Error('The staging PrismaPg adapter requires a Supabase DATABASE_URL.');
  }
  return { url, caPem: validateStrictSupabaseTls(url, fileAccess) };
}

/** Validate required runtime settings without logging their values. */
export function validateRuntimeConfig(env: Readonly<Record<string, string | undefined>>): RuntimeConfig {
  const jwtSecret = env.JWT_SECRET || '';
  const isPlaceholderSecret = /[<>]|placeholder|replace[_ -]?|generate[_ -]?|set[_ -]?me|your[_ -]/i.test(jwtSecret);
  if (jwtSecret.length < 32 || isPlaceholderSecret) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters before the API can start.');
  }

  const otpSecret = env.OTP_SECRET || '';
  const isPlaceholderOtp = /[<>]|placeholder|replace[_ -]?|generate[_ -]?|set[_ -]?me|your[_ -]/i.test(otpSecret);
  if (otpSecret.length < 32 || isPlaceholderOtp) {
    throw new Error('OTP_SECRET must be configured with at least 32 characters before the API can start.');
  }

  if (env.OTP_TRANSITION_CUTOFF) {
    const rawCutoff = env.OTP_TRANSITION_CUTOFF;
    const isStrictIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(rawCutoff);
    const cutoffDate = new Date(rawCutoff);
    if (!isStrictIso || isNaN(cutoffDate.getTime()) || cutoffDate.toISOString().replace(/\.000Z$/, 'Z') !== rawCutoff.replace(/\.000Z$/, 'Z')) {
      throw new Error('OTP_TRANSITION_CUTOFF must be a valid, unambiguous UTC ISO 8601 timestamp (e.g. 2026-11-07T22:30:00.000Z).');
    }
  }

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured before the API can start.');
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || !databaseUrl.hostname || databaseUrl.pathname.length < 2) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  const databaseHost = databaseUrl.hostname.toLowerCase();
  const isSupabaseDb = databaseHost.includes('supabase.co')
    || databaseHost.includes('supabase.com')
    || databaseHost.endsWith('.supabase.invalid');
  if (isSupabaseDb) {
    validateStrictSupabaseTls(databaseUrl);
  }

  const isSupabasePooler = databaseHost.endsWith('pooler.supabase.com')
    || databaseHost.endsWith('pooler.supabase.invalid');
  if (isSupabasePooler) {
    if (!env.DIRECT_URL) {
      throw new Error('Supabase pooled DATABASE_URL requires a dedicated direct DIRECT_URL for migrations.');
    }
  }

  if (env.DIRECT_URL) {
    let directUrl: URL;
    try {
      directUrl = new URL(env.DIRECT_URL);
    } catch {
      throw new Error('DIRECT_URL must be a valid PostgreSQL connection URL.');
    }
    if (!['postgres:', 'postgresql:'].includes(directUrl.protocol) || !directUrl.hostname || directUrl.pathname.length < 2) {
      throw new Error('DIRECT_URL must be a valid PostgreSQL connection URL.');
    }
    const directHost = directUrl.hostname.toLowerCase();
    if (isSupabasePooler && (directHost.endsWith('pooler.supabase.com') || directHost.endsWith('pooler.supabase.invalid'))) {
      throw new Error('DIRECT_URL cannot point to a Supabase pooler host; it must be a direct PostgreSQL endpoint.');
    }
    const isDirectSupabase = directHost.includes('supabase.co')
      || directHost.includes('supabase.com')
      || directHost.endsWith('.supabase.invalid');
    if (isDirectSupabase) {
      const directSslmode = (directUrl.searchParams.get('sslmode') || '').toLowerCase();
      const directSsl = (directUrl.searchParams.get('ssl') || '').toLowerCase();
      if (directSslmode === 'disable' || (!['require', 'verify-full', 'verify-ca'].includes(directSslmode) && directSsl !== 'true')) {
        throw new Error('Supabase DIRECT_URL requires SSL (e.g. sslmode=require or sslmode=verify-full).');
      }
    }
  }

  const rawPort = env.PORT || '5050';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return { port };
}
