import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { Role, AccountStatus } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    fullName: string;
    regimentalNumber: string;
    collegeRollNumber: string;
    email: string;
    role: Role;
    status: AccountStatus;
    platoonName: string;
    profilePhotoUrl?: string | null;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.ncc_token) {
      token = req.cookies.ncc_token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Institutional authentication token required. Please login.',
      });
      return;
    }

    const secret = process.env.JWT_SECRET || 'ncc_command_jwt_super_secure_key_2026_ait_pune';
    const decoded = jwt.verify(token, secret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        email: true,
        role: true,
        status: true,
        platoonName: true,
        profilePhotoUrl: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Cadet account not found or deactivated.',
      });
      return;
    }

    // Account Status Handling
    if (user.status === 'UNDER_REVIEW') {
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
        status: user.status,
        message: 'Your registration has been rejected. Please contact the NCC administration.',
      });
      return;
    }

    if (user.status === 'HOLD') {
      res.status(403).json({
        success: false,
        status: user.status,
        message: 'Your registration is on hold pending institutional review.',
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

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired institutional session token.',
    });
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access forbidden: Insufficient command role clearance.',
      });
      return;
    }

    next();
  };
};
