import assert from 'assert';
import { calculatePerformance, gradeForScore } from '../services/performance.service';

const missing = calculatePerformance({ ATTENDANCE: null, DRILL: null, FITNESS: null, TRAINING: null, CAMP_EVENT: null, CERT_ACHIEVEMENT: null, DISCIPLINE_LEADERSHIP: null });
assert.strictEqual(missing.score, null, 'missing data must not be treated as zero');
assert.strictEqual(missing.completeness, 0);

const attendanceOnly = calculatePerformance({ ATTENDANCE: 80, DRILL: null, FITNESS: null, TRAINING: null, CAMP_EVENT: null, CERT_ACHIEVEMENT: null, DISCIPLINE_LEADERSHIP: null });
assert.strictEqual(attendanceOnly.score, 80, 'score renormalizes over applicable, assessed weight');
assert.strictEqual(attendanceOnly.completeness, 20);
assert.strictEqual(attendanceOnly.categories.ATTENDANCE.score, 80);
assert.strictEqual(attendanceOnly.categories.DRILL.status, 'NOT_ASSESSED');

const balanced = calculatePerformance({ ATTENDANCE: 100, DRILL: 0, FITNESS: null, TRAINING: null, CAMP_EVENT: null, CERT_ACHIEVEMENT: null, DISCIPLINE_LEADERSHIP: null });
assert.strictEqual(balanced.score, 57.1, 'configured weights are correctly normalized across measured categories');
assert.strictEqual(gradeForScore(90), 'Outstanding');
assert.strictEqual(gradeForScore(89.9), 'Excellent');
console.log('Performance score calculation cases passed.');
