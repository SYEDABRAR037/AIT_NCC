import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolveApiBaseUrl } from './apiBaseUrl.mjs';

const require = createRequire(import.meta.url);
const { resolveBuildConfiguration } = require('../../scripts/generate-redirects.cjs');
const stagingBackend = 'https://ait-ncc-backend.onrender.com';

assert.equal(resolveApiBaseUrl({ envUrl: 'https://preview.invalid/api///', savedBase: 'https://old.invalid' }), 'https://preview.invalid/api');
assert.equal(resolveApiBaseUrl({ envUrl: stagingBackend, previewMode: false }), stagingBackend);
assert.equal(resolveApiBaseUrl({ savedBase: ' https://saved.invalid/ ' }), 'https://saved.invalid');
assert.equal(resolveApiBaseUrl({ windowBase: 'https://injected.invalid/' }), 'https://injected.invalid');
assert.equal(resolveApiBaseUrl({ hostname: 'ncc.netlify.app' }), '');
assert.equal(resolveApiBaseUrl({ envUrl: 'https://backend.example.test', previewMode: true }), '');
assert.equal(resolveApiBaseUrl({ envUrl: stagingBackend, savedBase: 'https://old.invalid', previewMode: true }), '');
assert.equal(resolveApiBaseUrl({ hostname: 'localhost' }), '');

const validStagingBuild = {
  CONTEXT: 'branch-deploy',
  BRANCH: 'ncc-staging',
  NCC_STAGING_API_MODE: 'true',
  VITE_PUBLIC_PREVIEW_MODE: 'false',
  NCC_PUBLIC_PREVIEW_MODE: 'false',
  VITE_API_BASE_URL: stagingBackend,
};
const stagingConfig = resolveBuildConfiguration(validStagingBuild);
assert.equal(stagingConfig.isStagingApiBuild, true);
assert.equal(stagingConfig.isPublicPreview, false);
assert.equal(stagingConfig.targetUrl, stagingBackend);

const deniedStagingBuilds = [
  { ...validStagingBuild, BRANCH: 'ncc-staging-typo' },
  { ...validStagingBuild, CONTEXT: 'deploy-preview' },
  { ...validStagingBuild, NCC_STAGING_API_MODE: 'false' },
  { ...validStagingBuild, VITE_PUBLIC_PREVIEW_MODE: 'true' },
  { ...validStagingBuild, NCC_PUBLIC_PREVIEW_MODE: 'true' },
  { ...validStagingBuild, VITE_API_BASE_URL: 'https://other-backend.example' },
  { ...validStagingBuild, BRANCH: 'codex/ncc-release-candidate-20261028' },
  { ...validStagingBuild, CONTEXT: 'production', BRANCH: 'main' },
  { ...validStagingBuild, CONTEXT: 'production', BRANCH: 'other-production-branch' },
  { ...validStagingBuild, NCC_STAGING_API_MODE: undefined },
];
for (const env of deniedStagingBuilds) {
  const config = resolveBuildConfiguration(env);
  assert.equal(config.isStagingApiBuild, false);
  assert.equal(config.isPublicPreview, true);
  assert.equal(config.targetUrl, '');
}

console.log('API base URL resolution tests passed.');
