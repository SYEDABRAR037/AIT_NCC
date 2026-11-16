export const MIN_PASSWORD_LENGTH = 12;
const COMMON_PASSWORDS = new Set([
  'password123!', 'password123', 'password@123', 'qwerty123456',
  'admin123456!', 'ncccadet123!', 'welcome12345!', '123456789012',
]);

export type PasswordPolicyResult = { valid: true } | { valid: false; message: string };

/** bcrypt only uses the first 72 UTF-8 bytes, so reject longer values instead of silently truncating. */
export function validatePassword(password: unknown): PasswordPolicyResult {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` };
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return { valid: false, message: 'Password must be no more than 72 UTF-8 bytes.' };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Use uppercase and lowercase letters, a number, and a symbol.' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, message: 'Choose a less common password.' };
  }
  return { valid: true };
}
