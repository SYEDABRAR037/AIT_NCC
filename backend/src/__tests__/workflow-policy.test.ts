import assert from 'assert';
import {
  canManageInquiryStatusAtStage,
  canReviewLeaveAtStage,
  canTransitionCampParticipantStatus,
  canTransitionInquiryStatusAtStage,
} from '../services/workflowPolicy';

const tests: Array<[string, () => void]> = [
  ['senior may review only submitted or senior-stage leave', () => {
    assert.strictEqual(canReviewLeaveAtStage('SENIOR', 'SUBMITTED'), true);
    assert.strictEqual(canReviewLeaveAtStage('SENIOR', 'SENIOR_REVIEW'), true);
    assert.strictEqual(canReviewLeaveAtStage('SENIOR', 'PLATOON_SENIOR_REVIEW'), false);
  }],
  ['platoon senior and ANO may act only at their existing stages', () => {
    assert.strictEqual(canReviewLeaveAtStage('PLATOON_SENIOR', 'PLATOON_SENIOR_REVIEW'), true);
    assert.strictEqual(canReviewLeaveAtStage('ADMIN_ANO', 'ANO_REVIEW'), true);
    assert.strictEqual(canReviewLeaveAtStage('DRILL_INSTRUCTOR', 'ANO_REVIEW'), false);
  }],
  ['inquiry status updates require current reviewer stage and forbid self-review', () => {
    assert.strictEqual(canManageInquiryStatusAtStage('SENIOR', 'SENIOR', 's1', 'c1'), true);
    assert.strictEqual(canManageInquiryStatusAtStage('SENIOR', 'PLATOON_SENIOR', 's1', 'c1'), false);
    assert.strictEqual(canManageInquiryStatusAtStage('PLATOON_SENIOR', 'PLATOON_SENIOR', 'p1', 'c1'), true);
    assert.strictEqual(canManageInquiryStatusAtStage('DRILL_INSTRUCTOR', 'ADMIN_ANO', 'd1', 'c1'), false);
    assert.strictEqual(canManageInquiryStatusAtStage('ADMIN_ANO', null, 'a1', 'a1'), false);
  }],
  ['inquiry status endpoint forbids internal status injection, invalid forwarding and terminal reopen', () => {
    assert.strictEqual(canTransitionInquiryStatusAtStage('SENIOR', 'SENIOR', 'FORWARDED', 's1', 'c1'), true);
    assert.strictEqual(canTransitionInquiryStatusAtStage('SENIOR', 'SENIOR', 'CLOSED', 's1', 'c1'), true);
    assert.strictEqual(canTransitionInquiryStatusAtStage('SENIOR', 'SENIOR', 'REPLIED', 's1', 'c1'), false);
    assert.strictEqual(canTransitionInquiryStatusAtStage('ADMIN_ANO', 'ADMIN_ANO', 'FORWARDED', 'a1', 'c1'), false);
    assert.strictEqual(canTransitionInquiryStatusAtStage('ADMIN_ANO', null, 'FORWARDED', 'a1', 'c1'), false);
    assert.strictEqual(canTransitionInquiryStatusAtStage('ADMIN_ANO', null, 'CLOSED', 'a1', 'c1'), true);
  }],
  ['camp status updates require authorized role and preceding selection stage', () => {
    assert.strictEqual(canTransitionCampParticipantStatus('SENIOR', 'APPLIED', 'RECOMMENDED'), true);
    assert.strictEqual(canTransitionCampParticipantStatus('SENIOR', 'APPLIED', 'COMPLETED'), false);
    assert.strictEqual(canTransitionCampParticipantStatus('PLATOON_SENIOR', 'RECOMMENDED', 'SELECTED'), true);
    assert.strictEqual(canTransitionCampParticipantStatus('PLATOON_SENIOR', 'APPLIED', 'SELECTED'), false);
    assert.strictEqual(canTransitionCampParticipantStatus('ADMIN_ANO', 'SELECTED', 'CONFIRMED'), true);
    assert.strictEqual(canTransitionCampParticipantStatus('ADMIN_ANO', 'APPLIED', 'COMPLETED'), false);
    assert.strictEqual(canTransitionCampParticipantStatus('DRILL_INSTRUCTOR', 'APPLIED', 'RECOMMENDED'), false);
  }],
];

for (const [name, run] of tests) {
  run();
  process.stdout.write(`[PASS] ${name}\n`);
}
process.stdout.write(`${tests.length} workflow policy tests passed.\n`);
