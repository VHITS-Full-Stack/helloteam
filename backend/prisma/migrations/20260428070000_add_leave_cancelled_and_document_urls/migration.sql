-- Add CANCELLED variant to LeaveStatus enum
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Add documentUrls column to leave_requests
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "documentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
