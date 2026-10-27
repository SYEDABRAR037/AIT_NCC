export const normalizeHttpUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
};
