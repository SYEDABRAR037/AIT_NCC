/**
 * NCC AIT PUNE — Fail-Closed Test Isolation Guard
 *
 * This module MUST be imported as the very first line of any test suite.
 * It strictly prevents test processes from inheriting live/production credentials
 * from .env or the ambient environment, and configures an unreachable loopback
 * discard port (RFC 863) as the fallback connection string.
 */

// 1. Force test environment
process.env.NODE_ENV = 'test';
process.env.PURE_MOCK_TEST = 'true';

// Central guard disables Prisma dotenv loading and rejects inherited URLs before client construction.
const { MOCK_SENTINEL_DATABASE_URL, prepareTestDatabaseEnvironment } = require('../databaseSafety');
prepareTestDatabaseEnvironment();

export { MOCK_SENTINEL_DATABASE_URL };
