import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const netlify = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const policy = netlify.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
assert.ok(policy, 'Netlify CSP must be configured');
for (const directive of [
  "default-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
]) {
  assert.ok(policy.includes(directive), `CSP is missing ${directive}`);
}
assert.match(policy, /connect-src[^;]*https:\/\/ait-ncc\.onrender\.com/);
assert.match(policy, /media-src 'self' blob:/);
assert.match(netlify, /Permissions-Policy\s*=\s*"camera=\(self\)/);
assert.match(netlify, /X-Content-Type-Options\s*=\s*"nosniff"/);
assert.match(netlify, /Strict-Transport-Security\s*=\s*"max-age=31536000"/);
console.log('Netlify security-header contract tests passed.');
