import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { Role, AccountStatus } from '@prisma/client';
import { isSessionActive } from '../services/sessionPolicy';

export interface AuthRequest extends Request {
  authSessionId?: string;
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

    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as { userId: string; sid?: string };

    // Legacy tokens without a session id remain accepted during the compatibility
    // rollout; all newly issued tokens are checked against durable session state.
    if (decoded.sid) {
      const session = await prisma.authSession.findFirst({
        where: { id: decoded.sid, userId: decoded.userId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, userId: true, expiresAt: true, revokedAt: true },
      });
      if (!session || !isSessionActive(decoded, session, new Date())) {
        res.status(401).json({ success: false, message: 'Session is no longer valid. Please sign in again.' });
        return;
      }
      req.authSessionId = session.id;
    }

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
