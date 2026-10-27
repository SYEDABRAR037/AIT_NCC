import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from './apiBaseUrl.mjs';

assert.equal(resolveApiBaseUrl({ envUrl: 'https://preview.invalid/api///', savedBase: 'https://old.invalid' }), 'https://preview.invalid/api');
assert.equal(resolveApiBaseUrl({ savedBase: ' https://saved.invalid/ ' }), 'https://saved.invalid');
assert.equal(resolveApiBaseUrl({ windowBase: 'https://injected.invalid/' }), 'https://injected.invalid');
assert.equal(resolveApiBaseUrl({ hostname: 'ncc.netlify.app' }), 'https://ait-ncc.onrender.com');
assert.equal(resolveApiBaseUrl({ hostname: 'localhost' }), '');
console.log('API base URL resolution tests passed.');
