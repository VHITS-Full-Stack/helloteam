import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { hashPassword, comparePassword, generateToken, verifyMagicLinkToken } from '../utils/helpers';
import { AuthenticatedRequest } from '../types';
import { config } from '../config';
import { sendPasswordResetEmail } from '../services/email.service';
import { getPresignedUrl, getKeyFromUrl } from '../services/s3.service';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: true,
        client: {
          include: {
            agreement: true,
          },
        },
        admin: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    // Allow INACTIVE employees to log in for onboarding (they become ACTIVE after KYC approval)
    const isEmployeePendingOnboarding = user.role === 'EMPLOYEE' && user.status === 'INACTIVE' &&
      (user.employee?.onboardingStatus === 'PENDING_AGREEMENT' || (user.employee?.kycStatus && user.employee.kycStatus !== 'APPROVED'));

    if (user.status !== 'ACTIVE' && !isEmployeePendingOnboarding) {
      res.status(401).json({
        success: false,
        error: 'Your account is not active. Please contact support.',
      });
      return;
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    // For employees: Invalidate existing sessions (prevent parallel logins)
    if (user.role === 'EMPLOYEE') {
      await prisma.session.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create new session
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.session.timeoutMinutes);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        isActive: true,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during login',
    });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role, firstName, lastName, companyName, contactPerson } = req.body;

    if (!email || !password || !role) {
      res.status(400).json({
        success: false,
        error: 'Email, password, and role are required',
      });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        ...(role === 'EMPLOYEE' && {
          employee: {
            create: {
              firstName: firstName || '',
              lastName: lastName || '',
            },
          },
        }),
        ...(role === 'CLIENT' && {
          client: {
            create: {
              companyName: companyName || '',
              contactPerson: contactPerson || '',
            },
          },
        }),
        ...(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'].includes(role) && {
          admin: {
            create: {
              firstName: firstName || '',
              lastName: lastName || '',
            },
          },
        }),
      },
      include: {
        employee: true,
        client: true,
        admin: true,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during registration',
    });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        employee: true,
        client: {
          include: {
            agreement: true,
          },
        },
        admin: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    const { password: _, ...userWithoutPassword } = user;

    // Refresh presigned URL for employee profile photo
    if (userWithoutPassword.employee?.profilePhoto) {
      const key = getKeyFromUrl(userWithoutPassword.employee.profilePhoto);
      if (key) {
        const freshUrl = await getPresignedUrl(key);
        if (freshUrl) {
          userWithoutPassword.employee = {
            ...userWithoutPassword.employee,
            profilePhoto: freshUrl,
          };
        }
      }
    }

    // Refresh presigned URL for client logo
    if (userWithoutPassword.client?.logoUrl) {
      const key = getKeyFromUrl(userWithoutPassword.client.logoUrl);
      if (key) {
        const freshUrl = await getPresignedUrl(key);
        if (freshUrl) {
          userWithoutPassword.client = {
            ...userWithoutPassword.client,
            logoUrl: freshUrl,
          };
        }
      }
    }

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching profile',
    });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        await prisma.session.updateMany({
          where: { token, isActive: true },
          data: { isActive: false },
        });
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during logout',
    });
  }
};

// Request password reset
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: { select: { firstName: true } },
        client: { select: { contactPerson: true } },
        admin: { select: { firstName: true } },
      },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.',
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // Token valid for 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Send password reset email
    const userName = user.employee?.firstName || user.client?.contactPerson || user.admin?.firstName;
    await sendPasswordResetEmail(email, resetToken, userName || undefined);

    // In development, also return the token for easy testing
    if (config.env === 'development') {
      res.json({
        success: true,
        message: 'Password reset email sent (check console in development)',
        data: { resetToken }, // Only in development!
      });
    } else {
      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.',
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while processing your request',
    });
  }
};

// Reset password with token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long',
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
      return;
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all existing sessions
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while resetting your password',
    });
  }
};

// Change password (for authenticated users)
export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    const isValidPassword = await comparePassword(currentPassword, user.password);

    if (!isValidPassword) {
      res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
      });
      return;
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while changing your password',
    });
  }
};

// Update user profile (for authenticated users)
export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        employee: true,
        client: true,
        admin: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    const {
      // Employee fields
      firstName,
      lastName,
      countryCode,
      phone,
      address,
      emergencyContact,
      // Employee notification preferences
      notifications,
      // Client fields
      companyName,
      contactPerson,
      timezone,
    } = req.body;

    // Update based on user role
    if (user.role === 'EMPLOYEE' && user.employee) {
      const updateData: any = {};

      // Profile fields
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (countryCode !== undefined) updateData.countryCode = countryCode;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;

      // Notification preferences
      if (notifications) {
        if (notifications.scheduleChanges !== undefined) updateData.notifyScheduleChanges = notifications.scheduleChanges;
        if (notifications.shiftReminders !== undefined) updateData.notifyShiftReminders = notifications.shiftReminders;
        if (notifications.leaveApprovals !== undefined) updateData.notifyLeaveApprovals = notifications.leaveApprovals;
        if (notifications.pushMessages !== undefined) updateData.notifyPushMessages = notifications.pushMessages;
        if (notifications.weeklySummary !== undefined) updateData.notifyWeeklySummary = notifications.weeklySummary;
      }

      await prisma.employee.update({
        where: { id: user.employee.id },
        data: updateData,
      });
    } else if (user.role === 'CLIENT' && user.client) {
      await prisma.client.update({
        where: { id: user.client.id },
        data: {
          ...(companyName && { companyName }),
          ...(contactPerson && { contactPerson }),
          ...(countryCode !== undefined && { countryCode }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
          ...(timezone && { timezone }),
        },
      });
    } else if (['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'].includes(user.role) && user.admin) {
      await prisma.admin.update({
        where: { id: user.admin.id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(countryCode !== undefined && { countryCode }),
          ...(phone !== undefined && { phone }),
        },
      });
    }

    // Fetch updated user data
    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        employee: true,
        client: true,
        admin: true,
      },
    });

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        error: 'User not found after update',
      });
      return;
    }

    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while updating profile',
    });
  }
};

// Impersonate a user (admin only)
export const impersonateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const userId = req.params.userId as string;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: true,
        client: {
          include: {
            agreement: true,
          },
        },
        admin: true,
      },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Block impersonating SUPER_ADMIN users
    if (targetUser.role === 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Cannot impersonate Super Admin users',
      });
      return;
    }

    // Only SUPER_ADMIN can impersonate admin-role users
    const adminRoles = ['ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'];
    if (adminRoles.includes(targetUser.role) && req.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Only Super Admins can impersonate admin users',
      });
      return;
    }

    // Must be active
    if (targetUser.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: 'Cannot impersonate inactive or suspended users',
      });
      return;
    }

    // Generate token for the target user
    const token = generateToken({
      userId: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
    });

    // Create session for audit trail
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.session.timeoutMinutes);

    await prisma.session.create({
      data: {
        userId: targetUser.id,
        token,
        expiresAt,
        isActive: true,
      },
    });

    const { password: _, ...userWithoutPassword } = targetUser;

    res.json({
      success: true,
      message: `Now impersonating ${targetUser.email}`,
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    console.error('Impersonate user error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while impersonating user',
    });
  }
};

// Validate session (check if token is still valid)
export const validateSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !req.user) {
      res.status(401).json({
        success: false,
        error: 'Invalid session',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    const session = await prisma.session.findFirst({
      where: {
        token,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Session expired or invalid',
      });
      return;
    }

    // Extend session expiry
    const newExpiry = new Date();
    newExpiry.setMinutes(newExpiry.getMinutes() + config.session.timeoutMinutes);

    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: newExpiry },
    });

    res.json({
      success: true,
      message: 'Session is valid',
      data: {
        expiresAt: newExpiry,
      },
    });
  } catch (error) {
    console.error('Validate session error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while validating session',
    });
  }
};

/**
 * POST /auth/verify-token
 * Verify a URL token and return a session token (no login needed).
 */
export const verifyUrlToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, error: 'Token is required' });
      return;
    }

    let payload: { userId: string; purpose: string };
    try {
      payload = verifyMagicLinkToken(token);
    } catch {
      res.status(401).json({ success: false, error: 'This link has expired. Please log in manually.' });
      return;
    }

    if (payload.purpose !== 'kyc-reupload' && payload.purpose !== 'onboarding') {
      res.status(400).json({ success: false, error: 'Invalid link' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { employee: true, client: { include: { agreement: true } }, admin: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Allow INACTIVE employees for onboarding/kyc-reupload tokens (they become ACTIVE after KYC approval)
    if (user.status !== 'ACTIVE' && !['onboarding', 'kyc-reupload'].includes(payload.purpose)) {
      res.status(404).json({ success: false, error: 'User not found or inactive' });
      return;
    }

    // Delete old sessions for this user to avoid unique constraint on token
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    const sessionToken = generateToken({ userId: user.id, email: user.email, role: user.role });

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.session.timeoutMinutes);

    await prisma.session.create({
      data: { userId: user.id, token: sessionToken, expiresAt, isActive: true },
    });

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: { user: userWithoutPassword, token: sessionToken },
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify token' });
  }
};
