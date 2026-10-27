import assert from 'assert';
import { readFileSync } from 'fs';
import { escapeHtml } from '../utils/html';

const hostileValue = `Cadet <img src=x onerror="alert('x')"> & 'verified'`;
const escapedValue = 'Cadet &lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; &#39;verified&#39;';

assert.strictEqual(escapeHtml(hostileValue), escapedValue);

const mailSource = readFileSync('src/services/mail.service.ts', 'utf8');
const recoverySource = readFileSync('../frontend/netlify/functions/recovery.ts', 'utf8');
const composeSource = readFileSync('../docker-compose.yml', 'utf8');
assert.match(mailSource, /Dear \$\{escapeHtml\(cadetName \|\| 'Cadet'\)\}/);
assert.match(mailSource, /\$\{escapeHtml\(otp\)\}/);
assert.match(recoverySource, /resolveRecoveryApiTarget\(\s*process\.env\.RECOVERY_API_BASE_URL,\s*action/);
assert.match(recoverySource, /if \(!targetUrl\) return serviceUnavailable\(\)/);
assert.doesNotMatch(recoverySource, /from ['"]pg['"]|DATABASE_URL|JWT_SECRET|new Client\(|pgClient\.query|nodemailer|sendMailOverSmtp/);
assert.doesNotMatch(recoverySource, /https:\/\/ait-ncc\.onrender\.com/);
assert.doesNotMatch(composeSource, /POSTGRES_PASSWORD:-/);
assert.doesNotMatch(composeSource, /JWT_SECRET:-/);

console.log('Security template regressions passed.');
