const fs = require('fs');
const path = require('path');

const targetUrl = process.env.VITE_API_BASE_URL || process.env.BACKEND_URL || '';
const redirectsFile = path.resolve(__dirname, '../public/_redirects');

let content = '';

if (targetUrl && targetUrl.trim().startsWith('http')) {
  const cleanTarget = targetUrl.trim().replace(/\/$/, '');
  content += `# Proxy API calls to real command backend\n/api/*  ${cleanTarget}/api/:splat  200!\n\n`;
}

// Single Page Application fallback for React routing
content += `# Single Page Application Fallback\n/*    /index.html   200\n`;

fs.writeFileSync(redirectsFile, content, 'utf8');
console.log('[Netlify Build] Successfully generated _redirects:\n' + content);
