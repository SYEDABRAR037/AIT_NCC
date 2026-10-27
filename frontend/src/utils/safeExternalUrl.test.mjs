import assert from 'node:assert/strict';
import { safeExternalUrl } from './safeExternalUrl.ts';

assert.equal(safeExternalUrl('https://docs.example.test/a'), 'https://docs.example.test/a');
assert.equal(safeExternalUrl('http://docs.example.test'), 'http://docs.example.test/');
assert.equal(safeExternalUrl('javascript:alert(1)'), null);
assert.equal(safeExternalUrl('data:text/html,hello'), null);
assert.equal(safeExternalUrl('https://user:pass@example.test'), null);
assert.equal(safeExternalUrl('not a URL'), null);
console.log('Safe external link tests passed.');
