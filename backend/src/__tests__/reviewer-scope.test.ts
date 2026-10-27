import assert from 'assert';
import { reviewerCanAccessCadet } from '../services/reviewerScope';

const scope = { cadetId: 'cadet-1', seniorAssignments: ['cadet-1'], cadetPlatoon: 'Alpha', authorizedPlatoons: ['Alpha'] };
assert.strictEqual(reviewerCanAccessCadet({ ...scope, role: 'SENIOR' }), true);
assert.strictEqual(reviewerCanAccessCadet({ ...scope, role: 'SENIOR', seniorAssignments: [] }), false);
assert.strictEqual(reviewerCanAccessCadet({ ...scope, role: 'PLATOON_SENIOR' }), true);
assert.strictEqual(reviewerCanAccessCadet({ ...scope, role: 'PLATOON_SENIOR', authorizedPlatoons: ['Bravo'] }), false);
assert.strictEqual(reviewerCanAccessCadet({ ...scope, role: 'CADET' }), false);
assert.strictEqual(reviewerCanAccessCadet({ ...scope, role: 'ADMIN_ANO', seniorAssignments: [], authorizedPlatoons: [] }), true);
console.log('Reviewer scope tests passed.');
