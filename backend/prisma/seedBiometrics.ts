/**
 * Synthetic biometric templates are not valid enrollment data and must never be
 * written to the application database. This legacy entry point now fails closed.
 * Unit tests should construct explicitly marked TEST_ONLY fixtures in memory.
 */
throw new Error('Synthetic biometric seeding is disabled. Use isolated TEST_ONLY unit fixtures.');
