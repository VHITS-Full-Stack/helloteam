import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

/**
 * Middleware that blocks CLIENT users with PENDING_AGREEMENT status
 * from accessing portal API routes. Returns 403 with a special code
 * so the frontend can redirect to the onboarding page.
 */
export const requireOnboardingComplete = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Gate CLIENT users
    if (req.user.role === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { userId: req.user.userId },
        select: { onboardingStatus: true },
      });

      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }

      if (client.onboardingStatus === 'PENDING_AGREEMENT') {
        res.status(403).json({
          success: false,
          error: 'Please complete onboarding by signing your service agreement.',
          code: 'ONBOARDING_INCOMPLETE',
        });
        return;
      }

      next();
      return;
    }

    // Gate EMPLOYEE users
    if (req.user.role === 'EMPLOYEE') {
      const employee = await prisma.employee.findUnique({
        where: { userId: req.user.userId },
        select: { onboardingStatus: true },
      });

      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found' });
        return;
      }

      if (employee.onboardingStatus === 'PENDING_AGREEMENT') {
        res.status(403).json({
          success: false,
          error: 'Please complete your employee onboarding.',
          code: 'ONBOARDING_INCOMPLETE',
        });
        return;
      }

      next();
      return;
    }

    next();
  } catch (error) {
    console.error('Onboarding middleware error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
