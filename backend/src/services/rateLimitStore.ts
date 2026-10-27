import { BoundedWindowLimiter, RateLimitResult } from './boundedWindowLimiter';

/** Async port so deployment can adopt a shared store without changing endpoint policy. */
export interface RateLimitStore {
  check(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
  record(key: string, windowMs: number): Promise<void>;
  /** Atomic check-and-increment. Shared adapters must use a single atomic store operation. */
  consume(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
  clear(key: string): Promise<void>;
}

/** Local fallback only. Separate backend instances do not share these buckets. */
export class ProcessLocalRateLimitStore implements RateLimitStore {
  private readonly limiter: BoundedWindowLimiter;

  constructor(maxKeys = 10_000) {
    this.limiter = new BoundedWindowLimiter(maxKeys);
  }

  async check(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    return this.limiter.check(key, max, windowMs);
  }

  async record(key: string, windowMs: number): Promise<void> {
    this.limiter.record(key, windowMs);
  }

  async consume(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    return this.limiter.consume(key, max, windowMs);
  }

  async clear(key: string): Promise<void> {
    this.limiter.clear(key);
  }
}
