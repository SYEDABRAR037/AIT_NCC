import assert from 'assert';
import { validatePassword } from '../services/passwordPolicy';

assert.strictEqual(validatePassword('Short1!').valid, false);
assert.strictEqual(validatePassword('longpasswordonly').valid, false);
assert.strictEqual(validatePassword('VerySecure123!Pass').valid, true);
assert.strictEqual(validatePassword('Password123!').valid, false, 'common choices are rejected');
assert.strictEqual(validatePassword('A'.repeat(71) + '😀').valid, false, 'bcrypt byte limit is enforced for multibyte input');
console.log('Password policy cases passed.');
