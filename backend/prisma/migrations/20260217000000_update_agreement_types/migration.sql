-- Create new enum with desired values
CREATE TYPE "AgreementType_new" AS ENUM ('WEEKLY', 'BI_WEEKLY', 'MONTHLY');

-- Update clients table: cast old enum to new via text mapping
ALTER TABLE "clients"
  ALTER COLUMN "agreementType" TYPE "AgreementType_new"
  USING (
    CASE "agreementType"::text
      WHEN 'WEEKLY_ACH' THEN 'WEEKLY'
      WHEN 'MONTHLY_ACH' THEN 'MONTHLY'
      ELSE "agreementType"::text
    END
  )::"AgreementType_new";

-- Update client_agreements table
ALTER TABLE "client_agreements"
  ALTER COLUMN "agreementType" TYPE "AgreementType_new"
  USING (
    CASE "agreementType"::text
      WHEN 'WEEKLY_ACH' THEN 'WEEKLY'
      WHEN 'MONTHLY_ACH' THEN 'MONTHLY'
      ELSE "agreementType"::text
    END
  )::"AgreementType_new";

-- Drop old enum and rename new one
DROP TYPE "AgreementType";
ALTER TYPE "AgreementType_new" RENAME TO "AgreementType";

-- Remove SSN column from client_agreements
ALTER TABLE "client_agreements" DROP COLUMN IF EXISTS "signerSSN";
