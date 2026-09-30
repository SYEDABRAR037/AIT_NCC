import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { OtpPurpose } from '@prisma/client';
import { startLoginOtp } from './otpAuth.controller';
import { normalizePhoneNumber } from '../services/attendanceNotification.service';

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
      profilePhotoUrl,
      profilePhoto,
      photoSnapshot,
      faceDescriptor,
      qualityScore,
      mobileChallengeId,
      emailChallengeId,
    } = req.body;

    // 1. Required Field Validation
    if (!fullName || !regimentalNumber || !collegeRollNumber || !email || !phone || !password) {
      res.status(400).json({
        success: false,
        message: 'Missing mandatory registration fields: Full Name, Regimental No, Roll No, Email, Mobile, Password.',
      });
      return;
    }

    // 2. Mandatory Biometric Validation (Phase 13)
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
    const normalizedPhone = normalizePhoneNumber(String(phone));
    if (!normalizedPhone.isValid || !mobileChallengeId || !emailChallengeId) {
      res.status(400).json({ success: false, message: 'Valid mobile and email verification are required before submitting the application.' });
      return;
    }
    const now = new Date();
    const [mobileProof, emailProof] = await Promise.all([
      prisma.otpChallenge.findUnique({ where: { id: String(mobileChallengeId) } }),
      prisma.otpChallenge.findUnique({ where: { id: String(emailChallengeId) } }),
    ]);
    if (!mobileProof || mobileProof.purpose !== OtpPurpose.REGISTRATION_MOBILE || mobileProof.destination !== normalizedPhone.normalized || !mobileProof.verifiedAt || !mobileProof.proofExpiresAt || mobileProof.proofExpiresAt <= now || mobileProof.consumedAt || !emailProof || emailProof.purpose !== OtpPurpose.REGISTRATION_EMAIL || emailProof.destination !== trimmedEmail || !emailProof.verifiedAt || !emailProof.proofExpiresAt || emailProof.proofExpiresAt <= now || emailProof.consumedAt) {
      res.status(400).json({ success: false, message: 'Mobile and email verification are required before submitting the application.' });
      return;
    }

    // 3. Strict Duplicate Detection (Phase 11 & 14)
    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: trimmedEmail, mode: 'insensitive' } },
    });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        field: 'email',
        message: 'This email is already registered.',
      });
      return;
    }

    const existingRegimental = await prisma.user.findFirst({
      where: { regimentalNumber: { equals: trimmedRegimental, mode: 'insensitive' } },
    });
    if (existingRegimental) {
      res.status(409).json({
        success: false,
        field: 'regimentalNumber',
        message: 'This regimental number is already registered.',
      });
      return;
    }

    const existingRoll = await prisma.user.findFirst({
      where: { collegeRollNumber: { equals: trimmedRoll, mode: 'insensitive' } },
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

    // Profile photo & biometric snapshot normalization
    const finalProfilePhoto = profilePhotoUrl || profilePhoto || photoSnapshot || null;
    const finalBiometricSnapshot = photoSnapshot || profilePhoto || profilePhotoUrl || null;

    // 5. Atomic Registration Transaction (Phase 8 & 12)
    const [newUser] = await prisma.$transaction(async (tx) => {
      const mobileConsumed = await tx.otpChallenge.updateMany({ where: { id: mobileProof.id, purpose: OtpPurpose.REGISTRATION_MOBILE, verifiedAt: { not: null }, proofExpiresAt: { gt: now }, consumedAt: null }, data: { consumedAt: now } });
      const emailConsumed = await tx.otpChallenge.updateMany({ where: { id: emailProof.id, purpose: OtpPurpose.REGISTRATION_EMAIL, verifiedAt: { not: null }, proofExpiresAt: { gt: now }, consumedAt: null }, data: { consumedAt: now } });
      if (mobileConsumed.count !== 1 || emailConsumed.count !== 1) throw new Error('VERIFICATION_PROOF_INVALID');
      const user = await tx.user.create({
        data: {
          fullName: fullName.trim(),
          regimentalNumber: trimmedRegimental,
          collegeRollNumber: trimmedRoll,
          email: trimmedEmail,
          phone: normalizedPhone.normalized,
          mobileVerified: true,
          emailVerified: true,
          year: year || 'FE (1st Year)',
          branch: branch || 'Computer Engineering',
          platoonName: platoon || 'Senior Division',
          enrollmentDetails: enrollmentDetails ? enrollmentDetails.trim() : null,
          dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
          profilePhotoUrl: finalProfilePhoto,
          passwordHash,
          role: 'CADET', // Strictly CADET for public enrollment
          status: 'UNDER_REVIEW', // Account enters multi-tier review queue
        },
      });

      await tx.biometricTemplate.create({
        data: {
          cadetId: user.id,
          descriptor: JSON.stringify(faceDescriptor),
          photoSnapshot: finalBiometricSnapshot,
          qualityScore: typeof qualityScore === 'number' ? qualityScore : 0.98,
          registeredBy: 'SELF_ENROLLMENT (Cadet Registration)',
        },
      });

      return [user];
    });

    console.log(`[REGISTRATION] New cadet registered: ${newUser.fullName} (${newUser.regimentalNumber}). ProfilePhoto: ${!!newUser.profilePhotoUrl}, Biometrics: Yes`);

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Your application is under institutional review.',
      userId: newUser.id,
      status: newUser.status,
      biometricEnrolled: true,
      profilePhotoSaved: Boolean(newUser.profilePhotoUrl),
    });
  } catch (error: any) {
    if (error?.message === 'VERIFICATION_PROOF_INVALID') {
      res.status(400).json({ success: false, message: 'Mobile and email verification are required before submitting the application.' });
      return;
    }
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

    if (user.role === 'CADET') {
      if (user.regimentalNumber.toLowerCase() !== cleanIdentifier.toLowerCase()) {
        res.status(401).json({ success: false, message: 'Use your regimental number to sign in.' });
        return;
      }
      if (user.status !== 'ACTIVE') {
        const statusMessage = user.status === 'UNDER_REVIEW' || user.status === 'ANO_REVIEW'
          ? 'Your registration is currently under review.'
          : user.status === 'REJECTED' ? 'Your registration has been rejected. Please contact the NCC administration.'
            : user.status === 'HOLD' || user.status === 'RETURNED' ? 'Your registration is on hold or needs correction.'
              : 'Your cadet account is not active.';
        res.status(403).json({ success: false, status: user.status, message: statusMessage });
        return;
      }
      await startLoginOtp(req, user, res);
      return;
    }

    // Check Account Status Rules
    if (user.status === 'UNDER_REVIEW' || user.status === 'ANO_REVIEW') {
      res.status(403).json({
        success: false,
        status: user.status,
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
    const secret = process.env.JWT_SECRET!;
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
