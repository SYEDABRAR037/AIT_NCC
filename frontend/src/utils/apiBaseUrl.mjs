const normalize = (value) => typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';

/** Build config is authoritative; saved overrides remain available when unset. */
export function resolveApiBaseUrl({ envUrl, savedBase, windowBase, hostname, previewMode = false }) {
  // Public preview builds must ignore both configured URLs and stale browser overrides.
  if (previewMode) return '';

  const configured = normalize(envUrl);
  if (configured) return configured;

  const saved = normalize(savedBase);
  if (saved) return saved;

  const globalBase = normalize(windowBase);
  if (globalBase) return globalBase;
  return '';
}
