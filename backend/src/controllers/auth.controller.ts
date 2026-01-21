import { Request, Response } from 'express';
import prisma from '../config/database';
import { hashPassword, comparePassword, generateToken } from '../utils/helpers';
import { AuthenticatedRequest } from '../types';

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
        client: true,
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

    if (user.status !== 'ACTIVE') {
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

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
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

    const { password: _, ...userWithoutPassword } = user;

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
