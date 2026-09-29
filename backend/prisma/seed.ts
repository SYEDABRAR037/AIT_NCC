import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Ensure default unit cadet wings exist in database
  const platoons = ['Senior Division', 'Senior Wing'];
  for (const name of platoons) {
    await prisma.platoon.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `Official cadet wing for ${name}, 2 Maharashtra Bn NCC, AIT.`,
      },
    });
  }

  // Privileged accounts are supplied by the deployment environment, never hardcoded in source.
  const account = (prefix: string, role: 'ADMIN_ANO' | 'PLATOON_SENIOR' | 'SENIOR', year: string, branch: string, platoonName: string) => {
    const value = (field: string) => {
      const found = process.env[`${prefix}_${field}`]?.trim();
      if (!found) throw new Error(`Missing required environment variable ${prefix}_${field}.`);
      return found;
    };
    return {
      fullName: value('NAME'),
      regimentalNumber: value('REGIMENTAL_NUMBER'),
      collegeRollNumber: value('COLLEGE_ROLL_NUMBER'),
      email: value('EMAIL'),
      plainPassword: value('PASSWORD'),
      role,
      status: 'ACTIVE' as const,
      year,
      branch,
      platoonName,
    };
  };
  const testUsers = [
    account('NCC_SEED_ANO', 'ADMIN_ANO', 'FACULTY', 'Institutional Command', 'Senior Division'),
    account('NCC_SEED_PLATOON_SENIOR', 'PLATOON_SENIOR', 'FACULTY', 'Institutional Command', 'Senior Division'),
    account('NCC_SEED_SENIOR', 'SENIOR', 'FACULTY', 'Institutional Command', 'Senior Division'),
  ];

  for (const u of testUsers) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.plainPassword, salt);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        status: u.status,
        role: u.role,
        passwordHash,
      },
      create: {
        fullName: u.fullName,
        regimentalNumber: u.regimentalNumber,
        collegeRollNumber: u.collegeRollNumber,
        email: u.email,
        passwordHash,
        role: u.role,
        status: u.status,
        year: u.year,
        branch: u.branch,
        platoonName: u.platoonName,
      },
    });
  }

  console.log('Database initialized with institutional command hierarchy (Camps, Events, Notices clean for launch).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
