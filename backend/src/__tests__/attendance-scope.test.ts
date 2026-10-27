import assert from 'assert';
import { attendanceCadetInScope } from '../services/attendanceScope';
import { assignedDrillPlatoonNames, drillInstructorCanAccessTarget } from '../services/drillInstructorScope';

assert.strictEqual(attendanceCadetInScope(['cadet-a'], 'cadet-a'), true);
assert.strictEqual(attendanceCadetInScope(['cadet-a'], 'cadet-b'), false);
assert.strictEqual(attendanceCadetInScope([], 'cadet-a'), false);
assert.strictEqual(attendanceCadetInScope(null, 'cadet-a'), true);
const assigned = assignedDrillPlatoonNames([{ platoon: { name: 'Alpha' } }, { platoon: { name: 'Alpha' } }]);
assert.deepStrictEqual(assigned, ['Alpha']);
assert.strictEqual(drillInstructorCanAccessTarget(assigned, 'Alpha'), true);
assert.strictEqual(drillInstructorCanAccessTarget(assigned, 'Bravo'), false);
assert.strictEqual(drillInstructorCanAccessTarget([], 'Alpha'), false);
assert.strictEqual(attendanceCadetInScope([], 'cadet-a'), false, 'A DI without assignment has no cadet scope.');
console.log('Attendance scope tests passed.');
