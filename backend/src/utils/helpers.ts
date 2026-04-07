import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '../types';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn as string,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
};

export const generateMagicLinkToken = (userId: string, purpose: string): string => {
  return jwt.sign({ userId, purpose }, config.jwt.secret);
};

export const verifyMagicLinkToken = (token: string): { userId: string; purpose: string } => {
  return jwt.verify(token, config.jwt.secret, { ignoreExpiration: true }) as { userId: string; purpose: string };
};

export const formatDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const calculateDurationMinutes = (start: Date, end: Date): number => {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
};

/**
 * Compute billing start/end times using the 7-minute grace rule.
 *
 * Clock In:
 *   - Early or ≤7 min late  → billing starts at scheduled start
 *   - >7 min late           → billing starts at actual clock-in (marked late)
 *
 * Clock Out:
 *   - On time, ≤7 min early → billing ends at scheduled end
 *   - >7 min early          → billing ends at actual clock-out
 *   - Past schedule         → billing ends at scheduled end (OT tracked separately)
 */
export const computeBillingTimes = (
  actualStart: Date,
  actualEnd: Date,
  scheduledStart: Date | null,
  scheduledEnd: Date | null,
): { billingStart: Date; billingEnd: Date; isLate: boolean } => {
  // If no schedule, billing = actual
  if (!scheduledStart || !scheduledEnd) {
    return { billingStart: actualStart, billingEnd: actualEnd, isLate: false };
  }

  const GRACE_MS = 7 * 60 * 1000; // 7 minutes in ms

  // --- Billing Start ---
  let billingStart: Date;
  let isLate = false;
  const lateMs = actualStart.getTime() - scheduledStart.getTime();

  if (lateMs <= GRACE_MS) {
    // Early, on time, or ≤7 min late → bill from schedule start
    billingStart = scheduledStart;
  } else {
    // >7 min late → bill from actual (late)
    billingStart = actualStart;
    isLate = true;
  }

  // --- Billing End ---
  let billingEnd: Date;
  const earlyMs = scheduledEnd.getTime() - actualEnd.getTime();

  if (earlyMs <= GRACE_MS) {
    // On time, ≤7 min early, or past schedule → bill to schedule end
    billingEnd = scheduledEnd;
  } else {
    // >7 min early → bill to actual clock-out
    billingEnd = actualEnd;
  }

  // Safety: if billing end is before billing start (e.g. extra-time session after shift),
  // fall back to actual times
  if (billingEnd.getTime() <= billingStart.getTime()) {
    return { billingStart: actualStart, billingEnd: actualEnd, isLate: false };
  }

  return { billingStart, billingEnd, isLate };
};
