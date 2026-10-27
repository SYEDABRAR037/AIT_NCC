import { prepareTestDatabaseEnvironment } from './databaseSafety';

process.env.NODE_ENV = 'test';
if (process.env.ALLOW_DISPOSABLE_TEST_DB !== 'true') {
  throw new Error('[FAIL-CLOSED DB GUARD] Integration scripts require an explicitly enabled disposable test database.');
}
prepareTestDatabaseEnvironment();
