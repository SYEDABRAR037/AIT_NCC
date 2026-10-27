import assert from 'assert';
import { normalizeHttpUrl } from '../services/httpUrl';

assert.strictEqual(normalizeHttpUrl('https://docs.example.test/path'), 'https://docs.example.test/path');
assert.strictEqual(normalizeHttpUrl('http://docs.example.test'), 'http://docs.example.test/');
assert.strictEqual(normalizeHttpUrl('javascript:alert(1)'), null);
assert.strictEqual(normalizeHttpUrl('data:text/html,hello'), null);
assert.strictEqual(normalizeHttpUrl('https://user:pass@example.test'), null);
assert.strictEqual(normalizeHttpUrl('not a URL'), null);
assert.strictEqual(normalizeHttpUrl('x'.repeat(2049)), null);
console.log('HTTP URL validation tests passed.');
