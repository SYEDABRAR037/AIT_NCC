const fs = require('fs');
const path = require('path');

const previewContexts = new Set(['deploy-preview', 'branch-deploy']);
const previewBranches = new Set(['codex/ncc-release-candidate-20261028']);
const isPublicPreview = process.env.VITE_PUBLIC_PREVIEW_MODE === 'true'
  || process.env.NCC_PUBLIC_PREVIEW_MODE === 'true'
  || previewContexts.has((process.env.CONTEXT || '').trim().toLowerCase())
  || previewBranches.has((process.env.BRANCH || '').trim());
const targetUrl = isPublicPreview
  ? ''
  : process.env.VITE_API_BASE_URL || process.env.BACKEND_URL || 'https://ait-ncc.onrender.com';
const distDirectory = path.resolve(__dirname, '../dist');
const redirectsFile = path.join(distDirectory, '_redirects');
const headersFile = path.join(distDirectory, '_headers');
fs.mkdirSync(distDirectory, { recursive: true });

let content = '';

if (targetUrl && targetUrl.trim().startsWith('http')) {
  const cleanTarget = targetUrl.trim().replace(/\/$/, '');
  content += `# Production API proxy\n/api/*  ${cleanTarget}/api/:splat  200!\n\n`;
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

const connectSources = isPublicPreview
  ? "'self' https://fonts.googleapis.com https://fonts.gstatic.com"
  : `'self' ${new URL(targetUrl).origin} https://fonts.googleapis.com https://fonts.gstatic.com`;
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

console.log(`[Netlify Build] Generated ${isPublicPreview ? 'preview-only' : 'production'} _redirects and _headers.`);
