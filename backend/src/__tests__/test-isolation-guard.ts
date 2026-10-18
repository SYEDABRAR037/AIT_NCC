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

// 2. Prevent Prisma CLI / Client internal dotenv autoloading
process.env.PRISMA_DONT_LOAD_DOTENV = '1';

// 3. Strictly overwrite DATABASE_URL with unreachable loopback discard sentinel
// RFC 863 Discard Port (Port 9) on 127.0.0.1 - guarantees no TCP connection can succeed
export const MOCK_SENTINEL_DATABASE_URL =
  'postgresql://mock_isolated:fail_closed@127.0.0.1:9/ncc_isolated_mock_db?connect_timeout=1';

// If ALLOW_DISPOSABLE_TEST_DB is not explicitly set, force mock sentinel
if (process.env.ALLOW_DISPOSABLE_TEST_DB !== 'true') {
  process.env.DATABASE_URL = MOCK_SENTINEL_DATABASE_URL;
}
