import dotenv from 'dotenv';

// Load local environment before importing the server graph (which constructs Prisma).
// Tests and controlled deployments can explicitly prevent dotenv fallback.
if (process.env.PRISMA_DONT_LOAD_DOTENV !== '1') {
  dotenv.config();
}

require('./server');
