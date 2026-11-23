export interface ApiBaseUrlOptions {
  envUrl?: string;
  savedBase?: string;
  windowBase?: string;
  hostname?: string;
  previewMode?: boolean;
}
export function resolveApiBaseUrl(options: ApiBaseUrlOptions): string;
