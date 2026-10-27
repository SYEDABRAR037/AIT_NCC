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

  const rawPort = env.PORT || '5050';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return { port };
}
