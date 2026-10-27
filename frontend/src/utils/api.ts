/**
 * NCC Institutional API Client
 * Handles base URL resolution (VITE_API_BASE_URL / Netlify proxy / Localhost Vite dev)
 * and guards against HTML doctype error pages (e.g. Netlify 404 / 500 HTML responses).
 */
import { resolveApiBaseUrl } from './apiBaseUrl.mjs';

export const getApiBaseUrl = (): string => {
  // Build-time config must win so a stale browser override cannot pin old API deployments.
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  let savedBase = '';
  try {
    savedBase = localStorage.getItem('ncc_api_base_url') || '';
  } catch {}

  return resolveApiBaseUrl({
    envUrl,
    savedBase,
    windowBase: typeof window !== 'undefined' ? (window as any).__NCC_API_BASE_URL__ : '',
    hostname: typeof window !== 'undefined' ? window.location.hostname : '',
  });
};

export const resolveApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
};

export const getAuthToken = (): string | null => {
  const token = localStorage.getItem('token') || localStorage.getItem('ncc_auth_token');
  return token;
};

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export const safeApiFetch = async <T = any>(
  endpoint: string,
  options: SafeFetchOptions = {}
): Promise<{ ok: boolean; status: number; data: T }> => {
  const url = resolveApiUrl(endpoint);
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const timeoutMs = options.timeoutMs || 25000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (fetchErr: any) {
    if (fetchErr.name === 'AbortError' || controller.signal.aborted) {
      throw new Error('Account recovery service is taking too long to respond. Please try again.');
    }
    throw fetchErr;
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get('content-type') || '';

  // Check if server returned HTML (e.g. <!DOCTYPE html> Netlify catch-all or error page)
  if (contentType.includes('text/html')) {
    const text = await res.text();
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error(
        `Institutional Server Notice: Backend endpoint (${endpoint}) returned HTML instead of JSON. Ensure the command server is running.`
      );
    }
    try {
      const parsed = JSON.parse(text);
      return { ok: res.ok, status: res.status, data: parsed };
    } catch {
      throw new Error(`Invalid response format from API endpoint (HTTP ${res.status}).`);
    }
  }

  try {
    const data = await res.json();
    if (res.status === 401) {
      // Server rejected token as invalid or expired; clear stale credentials
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('ncc_auth_token');
        localStorage.removeItem('ncc_current_user');
      } catch {}
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    throw new Error(`Failed to parse response from ${endpoint}: ${err.message}`);
  }
};
