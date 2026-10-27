const normalize = (value) => typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';

/** Build config is authoritative; saved overrides remain available when unset. */
export function resolveApiBaseUrl({ envUrl, savedBase, windowBase, hostname }) {
  const configured = normalize(envUrl);
  if (configured) return configured;

  const saved = normalize(savedBase);
  if (saved) return saved;

  const globalBase = normalize(windowBase);
  if (globalBase) return globalBase;

  if (hostname && hostname.includes('netlify.app')) return 'https://ait-ncc.onrender.com';
  return '';
}
