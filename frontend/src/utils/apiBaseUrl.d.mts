export interface ApiBaseUrlOptions {
  envUrl?: string;
  savedBase?: string;
  windowBase?: string;
  hostname?: string;
}
export function resolveApiBaseUrl(options: ApiBaseUrlOptions): string;
