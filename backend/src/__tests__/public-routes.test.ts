import './test-isolation-guard';
import assert from 'assert';
import { prisma } from '../db';
import {
  getPublicStats,
  getPublicNotices,
  getPublicEvents,
  getPublicAchievements,
  getPublicCamps,
} from '../controllers/public.controller';
import {
  listPublicGallery,
  listPublicRankHolders,
} from '../controllers/media.controller';

// Minimal mock Express Request & Response helpers
function createMockContext() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
    sendStatus(code: number) {
      this.statusCode = code;
      return this;
    },
  };

  const req: any = {
    params: {},
    query: {},
    body: {},
  };

  return { req, res };
}

async function runPublicRoutesTestSuite() {
  console.log('===============================================================');
  console.log('  NCC PUBLIC ROUTES & COMPLETION VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function record(testName: string, success: boolean, details?: string) {
    if (success) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  // Preserve original Prisma methods
  const origUserCount = prisma.user.count;
  const origUserFindMany = prisma.user.findMany;
  const origPlatoonCount = prisma.platoon.count;
  const origEventCount = prisma.event.count;
  const origEventFindMany = prisma.event.findMany;
  const origCampCount = prisma.camp.count;
  const origCampFindMany = prisma.camp.findMany;
  const origAchievementCount = prisma.achievement.count;
  const origAchievementFindMany = prisma.achievement.findMany;
  const origNoticeFindMany = prisma.notice.findMany;
  const origGalleryPhotoFindMany = prisma.galleryPhoto.findMany;
  const origRankHolderFindMany = prisma.rankHolder.findMany;

  try {
    // ------------------------------------------------------------------------
    // Test 1: getPublicStats calculates real DB stats including battalions & companies
    // ------------------------------------------------------------------------
    try {
      (prisma.user as any).count = async () => 54;
      (prisma.platoon as any).count = async () => 2;
      (prisma.event as any).count = async () => 3;
      (prisma.camp as any).count = async () => 4;
      (prisma.achievement as any).count = async () => 5;
      (prisma.user as any).findMany = async (args: any) => {
        if (args?.select?.battalion) {
          return [{ battalion: '2 Maharashtra Battalion NCC, Pune' }];
        }
        if (args?.select?.company) {
          return [{ company: 'Bravo Company' }];
        }
        return [];
      };

      const { req, res } = createMockContext();
      await getPublicStats(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.stats?.totalApprovedCadets, 54);
      assert.strictEqual(res.body?.stats?.platoonsCount, 2);
      assert.strictEqual(res.body?.stats?.battalionsCount, 1);
      assert.strictEqual(res.body?.stats?.companiesCount, 1);
      assert.strictEqual(res.body?.stats?.upcomingEventsCount, 3);
      assert.strictEqual(res.body?.stats?.campsCount, 4);
      assert.strictEqual(res.body?.stats?.activitiesCount, 5);

      record('Public Test 1: getPublicStats returns full metrics with battalions & companies', true);
    } catch (err: any) {
      record('Public Test 1: getPublicStats calculation', false, err.message);
    }

    // ------------------------------------------------------------------------
    // Test 2: getPublicNotices returns public notices correctly
    // ------------------------------------------------------------------------
    try {
      const mockNotices = [
        { id: 'notif-1', title: 'CATC Camp Parade Order', category: 'CAMP', isPublic: true, createdAt: new Date() },
      ];
      (prisma.notice as any).findMany = async () => mockNotices;

      const { req, res } = createMockContext();
      await getPublicNotices(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.notices?.length, 1);
      assert.strictEqual(res.body?.notices[0]?.title, 'CATC Camp Parade Order');

      record('Public Test 2: getPublicNotices filters and delivers public notices', true);
    } catch (err: any) {
      record('Public Test 2: getPublicNotices', false, err.message);
    }

    // ------------------------------------------------------------------------
    // Test 3: getPublicEvents returns public events
    // ------------------------------------------------------------------------
    try {
      const mockEvents = [
        { id: 'ev-1', title: 'Annual Rifle Firing', eventDate: new Date(), isPublic: true, location: 'Range A' },
      ];
      (prisma.event as any).findMany = async () => mockEvents;

      const { req, res } = createMockContext();
      await getPublicEvents(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.events?.length, 1);
      assert.strictEqual(res.body?.events[0]?.title, 'Annual Rifle Firing');

      record('Public Test 3: getPublicEvents retrieves public events list', true);
    } catch (err: any) {
      record('Public Test 3: getPublicEvents', false, err.message);
    }

    // ------------------------------------------------------------------------
    // Test 4: getPublicAchievements returns verified achievements
    // ------------------------------------------------------------------------
    try {
      const mockAchievements = [
        { id: 'ach-1', title: 'Best Cadet Trophy', category: 'Battalion', dateAwarded: new Date(), isPublic: true },
      ];
      (prisma.achievement as any).findMany = async () => mockAchievements;

      const { req, res } = createMockContext();
      await getPublicAchievements(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.achievements?.length, 1);

      record('Public Test 4: getPublicAchievements retrieves verified laurels', true);
    } catch (err: any) {
      record('Public Test 4: getPublicAchievements', false, err.message);
    }

    // ------------------------------------------------------------------------
    // Test 5: getPublicCamps returns scheduled camps list
    // ------------------------------------------------------------------------
    try {
      const mockCamps = [
        { id: 'camp-1', name: 'CATC 2026', campType: 'CATC', location: 'Pune', startDate: new Date(), endDate: new Date(), capacity: 50 },
      ];
      (prisma.camp as any).findMany = async () => mockCamps;

      const { req, res } = createMockContext();
      await getPublicCamps(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.camps?.length, 1);
      assert.strictEqual(res.body?.camps[0]?.name, 'CATC 2026');

      record('Public Test 5: getPublicCamps retrieves camp schedules', true);
    } catch (err: any) {
      record('Public Test 5: getPublicCamps', false, err.message);
    }

    // ------------------------------------------------------------------------
    // Test 6: listPublicGallery returns published photos with proper image URLs
    // ------------------------------------------------------------------------
    try {
      const mockPhotos = [
        { id: 'photo-1', title: 'Republic Day Drill', category: 'Parade', altText: 'Cadets marching' },
      ];
      (prisma.galleryPhoto as any).findMany = async () => mockPhotos;

      const { req, res } = createMockContext();
      await listPublicGallery(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.photos?.length, 1);
      assert.strictEqual(res.body?.photos[0]?.imageUrl, '/api/public/gallery/photo-1/image');

      record('Public Test 6: listPublicGallery formats photos with safe public image URLs', true);
    } catch (err: any) {
      record('Public Test 6: listPublicGallery', false, err.message);
    }

    // ------------------------------------------------------------------------
    // Test 7: listPublicRankHolders returns active rank holders with proper URLs
    // ------------------------------------------------------------------------
    try {
      const mockHolders = [
        { id: 'holder-1', rank: 'SUO', name: 'Cadet Leader' },
      ];
      (prisma.rankHolder as any).findMany = async () => mockHolders;

      const { req, res } = createMockContext();
      await listPublicRankHolders(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.holders?.length, 1);
      assert.strictEqual(res.body?.holders[0]?.imageUrl, '/api/public/rank-holders/holder-1/image');

      record('Public Test 7: listPublicRankHolders delivers verified leadership appointments', true);
    } catch (err: any) {
      record('Public Test 7: listPublicRankHolders', false, err.message);
    }
  } finally {
    // Teardown: restore Prisma methods
    (prisma.user as any).count = origUserCount;
    (prisma.user as any).findMany = origUserFindMany;
    (prisma.platoon as any).count = origPlatoonCount;
    (prisma.event as any).count = origEventCount;
    (prisma.event as any).findMany = origEventFindMany;
    (prisma.camp as any).count = origCampCount;
    (prisma.camp as any).findMany = origCampFindMany;
    (prisma.achievement as any).count = origAchievementCount;
    (prisma.achievement as any).findMany = origAchievementFindMany;
    (prisma.notice as any).findMany = origNoticeFindMany;
    (prisma.galleryPhoto as any).findMany = origGalleryPhotoFindMany;
    (prisma.rankHolder as any).findMany = origRankHolderFindMany;
  }

  console.log('\n===============================================================');
  console.log(`  PUBLIC TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPublicRoutesTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
