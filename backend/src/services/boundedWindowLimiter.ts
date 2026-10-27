export interface RateLimitResult {
  limited: boolean;
  retryAfterMs: number;
}

/** Process-local sliding windows with bounded key storage. Use a shared store for multi-instance enforcement. */
export class BoundedWindowLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly maxKeys = 10_000) {}

  check(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
    const active = (this.buckets.get(key) || []).filter((time) => now - time < windowMs);
    this.refreshKey(key, active);
    if (active.length < max) return { limited: false, retryAfterMs: 0 };
    return { limited: true, retryAfterMs: Math.max(1, active[0] + windowMs - now) };
  }

  record(key: string, windowMs: number, now = Date.now()): void {
    const active = (this.buckets.get(key) || []).filter((time) => now - time < windowMs);
    active.push(now);
    this.refreshKey(key, active);
  }

  consume(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
    const result = this.check(key, max, windowMs, now);
    if (!result.limited) this.record(key, windowMs, now);
    return result;
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }

  get size(): number {
    return this.buckets.size;
  }

  private refreshKey(key: string, timestamps: number[]): void {
    this.buckets.delete(key);
    if (timestamps.length === 0) return;

    if (!this.buckets.has(key) && this.buckets.size >= this.maxKeys) {
      for (const [candidate, times] of this.buckets) {
        if (times.length === 0) this.buckets.delete(candidate);
      }
      if (this.buckets.size >= this.maxKeys) {
        const oldest = this.buckets.keys().next().value;
        if (oldest !== undefined) this.buckets.delete(oldest);
      }
    }

    this.buckets.set(key, timestamps);
  }
}
