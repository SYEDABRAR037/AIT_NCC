import { prisma } from '../src/db';

// Helper to generate a normalized 128-dimensional unit vector from a seed string
function generateSeededDescriptor(seedStr: string): number[] {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }

  const raw: number[] = [];
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    // Deterministic pseudo-random based on seed & index
    const x = Math.sin(hash * (i + 1) * 9301 + 49297) * 233280;
    const val = (x - Math.floor(x)) * 2 - 1; // Range [-1, 1]
    raw.push(val);
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq) || 1;
  return raw.map((v) => Math.round((v / norm) * 10000) / 10000);
}

async function seedBiometrics() {
  console.log('Seeding initial biometric templates for active cadets...');

  const cadets = await prisma.user.findMany({
    where: {
      role: 'CADET',
      status: { in: ['APPROVED', 'ACTIVE'] },
    },
  });

  console.log(`Found ${cadets.length} active/approved cadets in database.`);

  for (const cadet of cadets) {
    const descriptor = generateSeededDescriptor(cadet.regimentalNumber || cadet.id);

    await prisma.biometricTemplate.upsert({
      where: { cadetId: cadet.id },
      create: {
        cadetId: cadet.id,
        descriptor: JSON.stringify(descriptor),
        qualityScore: 0.96,
        registeredBy: 'SYSTEM_ENROLLMENT (Lt. Col. R.K. Sharma)',
      },
      update: {
        descriptor: JSON.stringify(descriptor),
        qualityScore: 0.96,
      },
    });

    console.log(`✓ Biometric template enrolled for: ${cadet.fullName} (${cadet.regimentalNumber}) [${cadet.platoonName}]`);
  }

  console.log('Biometric templates seeded successfully.');
}

seedBiometrics()
  .catch((err) => console.error('Error seeding biometrics:', err))
  .finally(() => prisma.$disconnect());
