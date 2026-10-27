import assert from 'assert';
import { ProcessLocalRateLimitStore, RateLimitStore } from '../services/rateLimitStore';

const run = async (): Promise<void> => {
  const store: RateLimitStore = new ProcessLocalRateLimitStore(2);
  assert.deepStrictEqual(await store.consume('synthetic', 2, 60_000), { limited: false, retryAfterMs: 0 });
  assert.deepStrictEqual(await store.consume('synthetic', 2, 60_000), { limited: false, retryAfterMs: 0 });
  assert.strictEqual((await store.consume('synthetic', 2, 60_000)).limited, true);
  await store.clear('synthetic');
  assert.strictEqual((await store.consume('synthetic', 2, 60_000)).limited, false);
  await store.clear('concurrent');
  const concurrent = await Promise.all(Array.from({ length: 12 }, () => store.consume('concurrent', 3, 60_000)));
  assert.strictEqual(concurrent.filter((result) => !result.limited).length, 3);
  assert.strictEqual(concurrent.filter((result) => result.limited).length, 9);
};

run().then(
  () => console.log('Rate-limit store contract tests passed.'),
  (error) => {
    console.error('Rate-limit store contract tests failed.');
    process.exitCode = 1;
    void error;
  },
);
