import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveApiBaseUrl } from './apiBaseUrl.mjs';

const require = createRequire(import.meta.url);
const { resolveBuildConfiguration, generateNetlifyFiles } = require('../../scripts/generate-redirects.cjs');
const stagingBackend = 'https://ait-ncc-backend-staging.onrender.com';

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

const netlifyConfig = fs.readFileSync(new URL('../../../netlify.toml', import.meta.url), 'utf8');
const frontendNetlifyConfig = fs.readFileSync(new URL('../../../frontend/netlify.toml', import.meta.url), 'utf8');
for (const [label, config] of [['repository root', netlifyConfig], ['frontend config', frontendNetlifyConfig]]) {
  const stagingCommand = config.match(/\[context\.ncc-staging\][\s\S]*?command\s*=\s*"([^"]+)"/)?.[1] || '';
  assert.ok(stagingCommand, `${label} Netlify config must define the ncc-staging command`);
  for (const requiredValue of [
    'NCC_STAGING_API_MODE=true',
    'VITE_PUBLIC_PREVIEW_MODE=false',
    'NCC_PUBLIC_PREVIEW_MODE=false',
    `VITE_API_BASE_URL=${stagingBackend}`,
  ]) assert.ok(stagingCommand.includes(requiredValue), `${label} ncc-staging command must set ${requiredValue}`);
}

const stagingOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'ncc-staging-build-'));
const productionOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'ncc-production-build-'));
const otherPreviewOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'ncc-preview-build-'));
try {
  generateNetlifyFiles(validStagingBuild, stagingOutput);
  const stagingRedirects = fs.readFileSync(path.join(stagingOutput, '_redirects'), 'utf8');
  const stagingHeaders = fs.readFileSync(path.join(stagingOutput, '_headers'), 'utf8');
  const stagingRules = stagingRedirects.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));
  assert.equal(stagingRules[0], `/api/*  ${stagingBackend}/api/:splat  200!`);
  assert.equal(stagingRules[1], '/*    /index.html   200');
  assert.ok(stagingRules.indexOf(`/api/*  ${stagingBackend}/api/:splat  200!`) < stagingRules.indexOf('/*    /index.html   200'));
  assert.ok(stagingHeaders.includes(`connect-src 'self' ${stagingBackend}`));
  assert.ok(!stagingHeaders.includes('X-Robots-Tag: noindex'));

  const productionEnv = {
    CONTEXT: 'production',
    BRANCH: 'main',
    VITE_PUBLIC_PREVIEW_MODE: 'true',
    NCC_PUBLIC_PREVIEW_MODE: 'true',
    VITE_API_BASE_URL: stagingBackend,
  };
  generateNetlifyFiles(productionEnv, productionOutput);
  const productionRedirects = fs.readFileSync(path.join(productionOutput, '_redirects'), 'utf8');
  const productionHeaders = fs.readFileSync(path.join(productionOutput, '_headers'), 'utf8');
  assert.ok(!productionRedirects.includes('/api/*'));
  assert.ok(!productionHeaders.includes(stagingBackend));
  assert.ok(productionHeaders.includes('camera=(), microphone=(), geolocation=()'));

  const otherPreviewEnv = { ...validStagingBuild, BRANCH: 'another-branch' };
  generateNetlifyFiles(otherPreviewEnv, otherPreviewOutput);
  const otherPreviewRedirects = fs.readFileSync(path.join(otherPreviewOutput, '_redirects'), 'utf8');
  const otherPreviewHeaders = fs.readFileSync(path.join(otherPreviewOutput, '_headers'), 'utf8');
  assert.ok(!otherPreviewRedirects.includes('/api/*'));
  assert.ok(!otherPreviewHeaders.includes(stagingBackend));
  assert.ok(otherPreviewHeaders.includes('camera=(), microphone=(), geolocation=()'));
} finally {
  fs.rmSync(stagingOutput, { recursive: true, force: true });
  fs.rmSync(productionOutput, { recursive: true, force: true });
  fs.rmSync(otherPreviewOutput, { recursive: true, force: true });
}

const deniedStagingBuilds = [
  { ...validStagingBuild, BRANCH: 'ncc-staging-typo' },
  { ...validStagingBuild, CONTEXT: 'deploy-preview' },
  { ...validStagingBuild, BRANCH: 'codex/ncc-release-candidate-20261028' },
  { ...validStagingBuild, CONTEXT: 'production', BRANCH: 'main' },
  { ...validStagingBuild, CONTEXT: 'production', BRANCH: 'other-production-branch' },
];
for (const env of deniedStagingBuilds) {
  const config = resolveBuildConfiguration(env);
  assert.equal(config.isStagingApiBuild, false);
  assert.equal(config.isPublicPreview, true);
  assert.equal(config.targetUrl, '');
}

for (const invalidStagingBuild of [
  { ...validStagingBuild, NCC_STAGING_API_MODE: 'false' },
  { ...validStagingBuild, VITE_PUBLIC_PREVIEW_MODE: 'true' },
  { ...validStagingBuild, NCC_PUBLIC_PREVIEW_MODE: 'true' },
  { ...validStagingBuild, VITE_API_BASE_URL: 'https://other-backend.example' },
  { ...validStagingBuild, NCC_STAGING_API_MODE: undefined },
]) {
  assert.throws(
    () => resolveBuildConfiguration(invalidStagingBuild),
    /ncc-staging branch deploy is missing its explicit staging API build configuration/
  );
}

console.log('API base URL resolution tests passed.');
