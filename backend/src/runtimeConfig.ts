export interface RuntimeConfig {
  port: number;
}

/** Validate required runtime settings without logging their values. */
export function validateRuntimeConfig(env: Readonly<Record<string, string | undefined>>): RuntimeConfig {
  const jwtSecret = env.JWT_SECRET || '';
  const isPlaceholderSecret = /[<>]|placeholder|replace[_ -]?|generate[_ -]?|set[_ -]?me|your[_ -]/i.test(jwtSecret);
  if (jwtSecret.length < 32 || isPlaceholderSecret) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters before the API can start.');
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

  const isSupabaseDb = databaseUrl.hostname.toLowerCase().includes('supabase.co') || databaseUrl.hostname.toLowerCase().includes('supabase.com');
  if (isSupabaseDb) {
    const sslmode = (databaseUrl.searchParams.get('sslmode') || '').toLowerCase();
    const ssl = (databaseUrl.searchParams.get('ssl') || '').toLowerCase();
    if (sslmode === 'disable' || (!['require', 'verify-full', 'verify-ca'].includes(sslmode) && ssl !== 'true')) {
      throw new Error('Supabase DATABASE_URL requires SSL (e.g. sslmode=require or sslmode=verify-full).');
    }
  }

  const isSupabasePooler = databaseUrl.hostname.toLowerCase().endsWith('pooler.supabase.com');
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
    if (isSupabasePooler && directUrl.hostname.toLowerCase().endsWith('pooler.supabase.com')) {
      throw new Error('DIRECT_URL cannot point to a Supabase pooler host; it must be a direct PostgreSQL endpoint.');
    }
    const isDirectSupabase = directUrl.hostname.toLowerCase().includes('supabase.co') || directUrl.hostname.toLowerCase().includes('supabase.com');
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
