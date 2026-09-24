/**
 * NCC Institutional API Client
 * Handles base URL resolution (VITE_API_BASE_URL / Netlify proxy / Localhost Vite dev)
 * and guards against HTML doctype error pages (e.g. Netlify 404 / 500 HTML responses).
 */

export const getApiBaseUrl = (): string => {
  // 1. Runtime override (e.g. set in console or settings: localStorage.setItem('ncc_api_base_url', 'https://...'))
  try {
    const savedBase = localStorage.getItem('ncc_api_base_url');
    if (savedBase && typeof savedBase === 'string' && savedBase.trim().length > 0) {
      return savedBase.trim().replace(/\/$/, '');
    }
  } catch {}

  // 2. Build-time environment variable injected by Vite / Netlify
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, '');
  }

  // 3. Global window variable if injected by host HTML
  if (typeof window !== 'undefined' && (window as any).__NCC_API_BASE_URL__) {
    return String((window as any).__NCC_API_BASE_URL__).trim().replace(/\/$/, '');
  }

  return '';
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
  return localStorage.getItem('token') || localStorage.getItem('ncc_auth_token');
};

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

export const safeApiFetch = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
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

  const res = await fetch(url, {
    ...options,
    headers,
  });

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
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    throw new Error(`Failed to parse response from ${endpoint}: ${err.message}`);
  }
};
