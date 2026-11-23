const fs = require('fs');
const path = require('path');

const STAGING_BRANCH = 'ncc-staging';
const STAGING_BACKEND_URL = 'https://ait-ncc-backend.onrender.com';
const previewContexts = new Set(['deploy-preview', 'branch-deploy']);
const previewBranches = new Set(['codex/ncc-release-candidate-20261028']);

function resolveBuildConfiguration(env = process.env) {
  const deployContext = (env.CONTEXT || '').trim().toLowerCase();
  const deployBranch = (env.BRANCH || '').trim();
  const isStagingApiBuild = deployContext === 'branch-deploy'
    && deployBranch === STAGING_BRANCH
    && env.NCC_STAGING_API_MODE === 'true'
    && env.VITE_PUBLIC_PREVIEW_MODE === 'false'
    && env.NCC_PUBLIC_PREVIEW_MODE === 'false'
    && env.VITE_API_BASE_URL === STAGING_BACKEND_URL;
  const isNetlifyBuild = Boolean(deployContext);
  const isPublicPreview = !isStagingApiBuild && (
    isNetlifyBuild
    || env.VITE_PUBLIC_PREVIEW_MODE === 'true'
    || env.NCC_PUBLIC_PREVIEW_MODE === 'true'
    || previewContexts.has(deployContext)
    || previewBranches.has(deployBranch)
    || (deployContext === 'production' && deployBranch === 'main')
  );

  // Netlify builds may use an API target only for the explicitly approved
  // staging branch. Local builds retain their existing development config.
  const targetUrl = isStagingApiBuild
    ? STAGING_BACKEND_URL
    : isNetlifyBuild || isPublicPreview
      ? ''
      : env.VITE_API_BASE_URL || env.BACKEND_URL || '';

  return { deployContext, deployBranch, isStagingApiBuild, isPublicPreview, targetUrl };
}

function generateNetlifyFiles(env = process.env) {
  const { isStagingApiBuild, isPublicPreview, targetUrl } = resolveBuildConfiguration(env);
  const distDirectory = path.resolve(__dirname, '../dist');
  const redirectsFile = path.join(distDirectory, '_redirects');
  const headersFile = path.join(distDirectory, '_headers');
  fs.mkdirSync(distDirectory, { recursive: true });

  let content = '';

  if (targetUrl && targetUrl.trim().startsWith('http')) {
    const cleanTarget = targetUrl.trim().replace(/\/$/, '');
    content += `# ${isStagingApiBuild ? 'Staging' : 'Development'} API proxy\n/api/*  ${cleanTarget}/api/:splat  200!\n\n`;
  }

  // Single Page Application fallback for React routing
  content += `# Single Page Application Fallback\n/*    /index.html   200\n`;

  fs.writeFileSync(redirectsFile, content, 'utf8');

  if (isPublicPreview) {
    // These lazy chunks contain authenticated portal, personal-record, OTP,
    // attendance, and biometric workflows. They are never reachable from the
    // static preview UI, and must not be published as downloadable assets.
    const restrictedAssetPrefixes = [
      'FaceAttendanceModal-',
      'FaceEnrollmentModal-',
      'face-api',
      'LoginModal-',
      'OTPVerification-',
      'RegisterModal-',
      'RoleShellView-',
      'DigitalIdView-',
    ];
    const assetsDirectory = path.join(distDirectory, 'assets');
    if (fs.existsSync(assetsDirectory)) {
      for (const assetName of fs.readdirSync(assetsDirectory)) {
        if (restrictedAssetPrefixes.some((prefix) => assetName.startsWith(prefix))) {
          fs.rmSync(path.join(assetsDirectory, assetName), { force: true });
        }
      }
    }

    // The browser inference weights are biometric resources and are unnecessary
    // for a static-only preview.
    fs.rmSync(path.join(distDirectory, 'models'), { recursive: true, force: true });
  }

  const backendOrigin = targetUrl ? new URL(targetUrl).origin : '';
  const connectSources = [
    "'self'",
    ...(backendOrigin ? [backendOrigin] : []),
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ].join(' ');
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSources}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ].join('; ');
  const headerContent = `/*\n  Content-Security-Policy: ${csp}\n`;
  const permissionsPolicy = isPublicPreview
    ? 'camera=(), microphone=(), geolocation=()'
    : 'camera=(self), microphone=(), geolocation=()';
  const previewHeaders = isPublicPreview ? '  X-Robots-Tag: noindex, nofollow\n' : '';
  fs.writeFileSync(headersFile, `${headerContent}  Permissions-Policy: ${permissionsPolicy}\n${previewHeaders}`, 'utf8');

  console.log(`[Netlify Build] Generated ${isPublicPreview ? 'preview-only' : isStagingApiBuild ? 'staging API' : 'production'} _redirects and _headers.`);
  return { redirectsFile, headersFile, isPublicPreview, targetUrl };
}

module.exports = { resolveBuildConfiguration, generateNetlifyFiles };

if (require.main === module) generateNetlifyFiles();
