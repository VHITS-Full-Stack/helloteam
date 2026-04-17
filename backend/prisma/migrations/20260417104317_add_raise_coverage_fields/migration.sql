-- CreateEnum
CREATE TYPE "RaiseCoverageType" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateEnum
CREATE TYPE "RaiseInitiator" AS ENUM ('ADMIN', 'CLIENT');

-- AlterTable
ALTER TABLE "client_requests" ADD COLUMN     "clientCoveredAmount" DECIMAL(10,2),
ADD COLUMN     "coverageType" "RaiseCoverageType",
ADD COLUMN     "employeeRaiseAmount" DECIMAL(10,2),
ADD COLUMN     "raisedBy" "RaiseInitiator";
