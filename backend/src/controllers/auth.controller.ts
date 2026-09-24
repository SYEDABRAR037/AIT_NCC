import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      regimentalNumber,
      collegeRollNumber,
      email,
      phone,
      year,
      branch,
      platoon,
      enrollmentDetails,
      dateOfJoining,
      password,
    } = req.body;

    // 1. Required Field Validation
    if (!fullName || !regimentalNumber || !collegeRollNumber || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Missing mandatory registration fields: Full Name, Regimental No, Roll No, Email, Password.',
      });
      return;
    }

    // 2. Mandatory Biometric Validation (Phase 13)
    const { faceDescriptor, photoSnapshot, qualityScore } = req.body;
    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length < 128) {
      res.status(400).json({
        success: false,
        field: 'faceDescriptor',
        message: 'Please complete biometric face registration before submitting your application.',
      });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedRegimental = regimentalNumber.trim().toUpperCase();
    const trimmedRoll = collegeRollNumber.trim().toUpperCase();

    // 3. Strict Duplicate Detection (Phase 11 & 14)
    const existingEmail = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        field: 'email',
        message: 'This email is already registered.',
      });
      return;
    }

    const existingRegimental = await prisma.user.findUnique({
      where: { regimentalNumber: trimmedRegimental },
    });
    if (existingRegimental) {
      res.status(409).json({
        success: false,
        field: 'regimentalNumber',
        message: 'This regimental number is already registered.',
      });
      return;
    }

    const existingRoll = await prisma.user.findUnique({
      where: { collegeRollNumber: trimmedRoll },
    });
    if (existingRoll) {
      res.status(409).json({
        success: false,
        field: 'collegeRollNumber',
        message: 'This college roll number is already registered.',
      });
      return;
    }

    // 4. Password Hashing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Atomic Registration Transaction (Phase 12)
    const [newUser] = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: fullName.trim(),
          regimentalNumber: trimmedRegimental,
          collegeRollNumber: trimmedRoll,
          email: trimmedEmail,
          phone: phone ? phone.trim() : null,
          year: year || 'FE (1st Year)',
          branch: branch || 'Computer Engineering',
          platoonName: platoon || 'Senior Division',
          enrollmentDetails: enrollmentDetails ? enrollmentDetails.trim() : null,
          dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
          passwordHash,
          role: 'CADET', // Strictly CADET for public enrollment
          status: 'UNDER_REVIEW', // Account enters multi-tier review queue
        },
      });

      await tx.biometricTemplate.create({
        data: {
          cadetId: user.id,
          descriptor: JSON.stringify(faceDescriptor),
          photoSnapshot: photoSnapshot || null,
          qualityScore: typeof qualityScore === 'number' ? qualityScore : 0.98,
          registeredBy: 'SELF_ENROLLMENT (Cadet Registration)',
        },
      });

      return [user];
    });

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Your application is under institutional review.',
      userId: newUser.id,
      status: newUser.status,
      biometricEnrolled: true,
    });
  } catch (error: any) {
    console.error('Registration error:', error);

    // Specific Prisma Unique Constraint Error mapping
    if (error?.code === 'P2002') {
      const target = error.meta?.target;
      if (Array.isArray(target)) {
        if (target.includes('email')) {
          res.status(409).json({ success: false, field: 'email', message: 'This email is already registered.' });
          return;
        }
        if (target.includes('regimentalNumber')) {
          res.status(409).json({ success: false, field: 'regimentalNumber', message: 'This regimental number is already registered.' });
          return;
        }
        if (target.includes('collegeRollNumber')) {
          res.status(409).json({ success: false, field: 'collegeRollNumber', message: 'This college roll number is already registered.' });
          return;
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Registration could not be completed due to a server error. Please try again later.',
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const identifier = req.body.identifier || req.body.email;
    const password = req.body.password;

    if (!identifier || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide regimental number or email, and password.',
      });
      return;
    }

    const cleanIdentifier = identifier.trim();

    // Query user by email, regimental number, or roll number with case-insensitivity (Phase 7)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { regimentalNumber: { equals: cleanIdentifier, mode: 'insensitive' } },
          { collegeRollNumber: { equals: cleanIdentifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid institutional credentials.',
      });
      return;
    }

    // Verify Password Hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid institutional credentials.',
      });
      return;
    }

    // Check Account Status Rules
    if (user.status === 'UNDER_REVIEW') {
      res.status(403).json({
        success: false,
        status: 'UNDER_REVIEW',
        message: 'Your registration is currently under review.',
      });
      return;
    }

    if (user.status === 'REJECTED') {
      res.status(403).json({
        success: false,
        status: 'REJECTED',
        message: 'Your registration has been rejected. Please contact the NCC administration.',
      });
      return;
    }

    if (user.status === 'HOLD' || user.status === 'RETURNED') {
      res.status(403).json({
        success: false,
        status: user.status,
        message: 'Your registration has been returned or placed on hold pending institutional review.',
      });
      return;
    }

    if (user.status === 'INACTIVE' || user.status === 'PASSED_OUT') {
      res.status(403).json({
        success: false,
        status: user.status,
        message: 'Your cadet account is inactive or passed out.',
      });
      return;
    }

    // Generate Session JWT Token for ACTIVE or APPROVED users
    const secret = process.env.JWT_SECRET || 'ncc_command_jwt_super_secure_key_2026_ait_pune';
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        status: user.status,
      },
      secret,
      { expiresIn: '7d' }
    );

    // Set secure cookie
    res.cookie('ncc_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Authentication successful. Command clearance granted.',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        regimentalNumber: user.regimentalNumber,
        collegeRollNumber: user.collegeRollNumber,
        email: user.email,
        phone: user.phone,
        year: user.year,
        branch: user.branch,
        platoonName: user.platoonName,
        role: user.role,
        status: user.status,
        profilePhotoUrl: user.profilePhotoUrl,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Institutional authentication error.',
    });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('ncc_token');
  res.json({
    success: true,
    message: 'Institutional session terminated. Logged out successfully.',
  });
};
