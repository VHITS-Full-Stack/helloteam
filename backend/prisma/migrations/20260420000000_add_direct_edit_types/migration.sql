-- AlterEnum: add PAY_EDIT and BILLING_EDIT to ClientRequestType
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL
ALTER TYPE "ClientRequestType" ADD VALUE IF NOT EXISTS 'PAY_EDIT';
ALTER TYPE "ClientRequestType" ADD VALUE IF NOT EXISTS 'BILLING_EDIT';
