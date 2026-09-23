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

  // Seed Institutional Accounts for All Roles & Statuses
  const testUsers = [
    {
      fullName: 'Lt. Col. Sanjeev Sharma (ANO)',
      regimentalNumber: 'ANO/MH/2026/01',
      collegeRollNumber: 'ANO001',
      email: 'ano.admin@aitpune.edu.in',
      plainPassword: 'AdminCommand@2026',
      role: 'ADMIN_ANO' as const,
      status: 'ACTIVE' as const,
      year: 'FACULTY',
      branch: 'Institutional Command',
      platoonName: 'Senior Division',
    },
    {
      fullName: 'SUO Vikramaditya Rathore',
      regimentalNumber: 'MH23SDA100101',
      collegeRollNumber: '23101',
      email: 'platoon.senior@aitpune.edu.in',
      plainPassword: 'PlatoonLead@2026',
      role: 'PLATOON_SENIOR' as const,
      status: 'ACTIVE' as const,
      year: 'TE (3rd Year)',
      branch: 'Computer Engineering',
      platoonName: 'Senior Division',
    },
    {
      fullName: 'SGT Ananya Deshmukh',
      regimentalNumber: 'MH23SDA100202',
      collegeRollNumber: '23102',
      email: 'senior.cadet@aitpune.edu.in',
      plainPassword: 'SeniorCadet@2026',
      role: 'SENIOR' as const,
      status: 'ACTIVE' as const,
      year: 'TE (3rd Year)',
      branch: 'Information Technology',
      platoonName: 'Senior Wing',
    },
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
