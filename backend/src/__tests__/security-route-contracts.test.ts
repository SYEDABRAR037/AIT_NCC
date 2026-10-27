import assert from 'assert';
import { readFileSync } from 'fs';

const auth = readFileSync('src/controllers/auth.controller.ts', 'utf8');
const otpAuth = readFileSync('src/controllers/otpAuth.controller.ts', 'utf8');
const sessionPolicy = readFileSync('src/services/sessionPolicy.ts', 'utf8');
const review = readFileSync('src/controllers/review.controller.ts', 'utf8');
const attendance = readFileSync('src/controllers/attendance.controller.ts', 'utf8');
const requests = readFileSync('src/controllers/request.controller.ts', 'utf8');

assert.match(auth, /rejectThrottledLogin\(res, identifierKey\)/);
assert.match(auth, /failedLoginAttempts\.consume\(key, LOGIN_FAILURE_LIMIT, LOGIN_FAILURE_WINDOW_MS\)/);
assert.match(auth, /revokePresentedSession\(prisma\.authSession, decoded\)/);
assert.match(otpAuth, /authSession\.create/);
assert.match(sessionPolicy, /revokedAt: null/);
assert.match(review, /reviewerCanAccessCadet\(/);
assert.match(review, /whereClause\.id = \{ in: assignments\.map/);
assert.match(attendance, /resolvePlatoonSeniorScope\(req\.user\.id, req\.user\.platoonName\)/);
assert.doesNotMatch(attendance, /falls back to ALL active cadets/);
assert.match(attendance, /drillInstructorAssignment\.findMany/);
assert.match(attendance, /assignedDrillPlatoonNames/);
assert.match(requests, /normalizeHttpUrl\(supportingDocUrl\)/);
assert.ok((requests.match(/updatedAt: inquiry\.updatedAt/g) || []).length >= 2, 'reply and status transitions use compare-and-set timestamps');
console.log('Security route contract checks passed (static source checks only).');
