import dotenv from 'dotenv';

// Load local environment before importing the server graph (which constructs Prisma).
// Tests and controlled deployments can explicitly prevent dotenv fallback.
if (process.env.PRISMA_DONT_LOAD_DOTENV !== '1') {
  dotenv.config();
}

// Preserve Render and single-URL fallback: default DIRECT_URL to DATABASE_URL if absent.
// Supabase pooler configurations must explicitly configure a direct migration URL and are not defaulted.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  const isSupabasePooler = process.env.DATABASE_URL.toLowerCase().includes('pooler.supabase.com');
  if (!isSupabasePooler) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}

require('./server');
