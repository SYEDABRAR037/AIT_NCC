const RECOVERY_ACTIONS = new Set(['request-otp', 'resend-otp', 'verify-otp', 'reset-password']);

export const isRecoveryAction = (action: string): boolean => RECOVERY_ACTIONS.has(action);

export const resolveRecoveryApiTarget = (
  apiBase: string | undefined,
  action: string,
  allowLocalHttp = false,
): string | null => {
  if (!apiBase?.trim() || !isRecoveryAction(action)) return null;
  try {
    const base = new URL(apiBase);
    const isLocalHttp = allowLocalHttp && base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if ((base.protocol !== 'https:' && !isLocalHttp) || base.username || base.password || base.search || base.hash) return null;
    return `${base.origin}${base.pathname.replace(/\/+$/, '')}/api/auth/recovery/${action}`;
  } catch {
    return null;
  }
};
