import assert from 'assert';
import { BoundedWindowLimiter } from '../services/boundedWindowLimiter';

const limiter = new BoundedWindowLimiter(2);
assert.deepStrictEqual(limiter.consume('one', 2, 100, 0), { limited: false, retryAfterMs: 0 });
limiter.record('one', 100, 1);
assert.deepStrictEqual(limiter.check('one', 2, 100, 2), { limited: true, retryAfterMs: 98 });
assert.deepStrictEqual(limiter.check('one', 2, 100, 101), { limited: false, retryAfterMs: 0 });
limiter.record('two', 100, 102);
limiter.record('three', 100, 103);
assert.strictEqual(limiter.size, 2);
assert.strictEqual(limiter.check('one', 2, 100, 104).limited, false);
limiter.clear('one');
assert.strictEqual(limiter.check('one', 2, 100, 105).limited, false);
console.log('Bounded sliding-window limiter tests passed.');
