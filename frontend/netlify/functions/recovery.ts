import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { isRecoveryAction, resolveRecoveryApiTarget } from './recoverySecurity.ts';

const responseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const serviceUnavailable = () => ({
  statusCode: 503,
  headers: responseHeaders,
  body: JSON.stringify({ success: false, message: 'Account recovery is temporarily unavailable.' }),
});

const isLocalDevelopment = (): boolean => {
  if (process.env.NETLIFY_DEV === 'true' || process.env.CONTEXT === 'dev') return true;
  if (process.env.NETLIFY === 'true' || process.env.CONTEXT) return false;
  return process.env.NODE_ENV === 'development';
};

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: responseHeaders, body: '' };
  }

  const action = event.queryStringParameters?.action || event.path.split('/').pop() || 'request-otp';
  if (!isRecoveryAction(action)) {
    return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ success: false, message: 'Invalid recovery request.' }) };
  }

  const targetUrl = resolveRecoveryApiTarget(
    process.env.RECOVERY_API_BASE_URL,
    action,
    isLocalDevelopment(),
  );
  if (!targetUrl) return serviceUnavailable();

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(event.body || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid request body');
    body = parsed as Record<string, unknown>;
  } catch {
    return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ success: false, message: 'Invalid request.' }) };
  }

  try {
    const forwardRes = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: { 'Content-Type': 'application/json' },
      body: event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' ? JSON.stringify(body) : undefined,
      redirect: 'error',
    });
    const responseBody = await forwardRes.text();
    return {
      statusCode: forwardRes.status,
      headers: {
        ...responseHeaders,
        'Content-Type': forwardRes.headers.get('content-type') || 'application/json',
      },
      body: responseBody,
    };
  } catch {
    console.error('[NETLIFY RECOVERY] Configured backend request failed.');
    return serviceUnavailable();
  }
};
