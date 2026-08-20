-- Initial schema for the Advani Family Office internal dashboard.
--
-- Authored to match prisma/schema.prisma exactly. Verify with:
--   npx prisma migrate diff \
--     --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma \
--     --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code
-- An exit code of 0 means the migration and the schema agree.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('PRIVATE_EQUITY', 'PUBLIC_EQUITY', 'CRYPTO', 'FUND', 'DEBT', 'REAL_ESTATE', 'TOKENIZED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SPV', 'FUND', 'DIRECT');

-- CreateEnum
CREATE TYPE "InvestmentStatus" AS ENUM ('ACTIVE', 'EXITED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CAPITAL_CALL', 'PURCHASE', 'SALE', 'FEE', 'DIVIDEND', 'INTEREST');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SETTLED', 'VOID');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('DECLARED', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "FilingType" AS ENUM ('KYC', 'VAT', 'MRV', 'ANNUAL_RETURN', 'TAX');

-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "ticker" TEXT,
    "sector" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "vehicle" "VehicleType" NOT NULL DEFAULT 'SPV',
    "vehicle_name" TEXT NOT NULL,
    "committed_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "invested_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "cost_basis" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "current_valuation" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "ownership_pct" DECIMAL(9,4),
    "status" "InvestmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "invested_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuations" (
    "id" UUID NOT NULL,
    "investment_id" UUID NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(20,2) NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "investment_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fx_rate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'SETTLED',
    "reference" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributions" (
    "id" UUID NOT NULL,
    "investment_id" UUID NOT NULL,
    "declared_date" TIMESTAMP(3) NOT NULL,
    "payment_date" TIMESTAMP(3),
    "gross_amount" DECIMAL(20,2) NOT NULL,
    "withholding_tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "DistributionStatus" NOT NULL DEFAULT 'DECLARED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filings" (
    "id" UUID NOT NULL,
    "vehicle_name" TEXT NOT NULL,
    "type" "FilingType" NOT NULL,
    "jurisdiction" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "status" "FilingStatus" NOT NULL DEFAULT 'OPEN',
    "assignee_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "otp_codes_email_expires_at_idx" ON "otp_codes"("email", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "assets_type_idx" ON "assets"("type");

-- CreateIndex
CREATE INDEX "assets_name_idx" ON "assets"("name");

-- CreateIndex
CREATE INDEX "investments_asset_id_idx" ON "investments"("asset_id");

-- CreateIndex
CREATE INDEX "investments_status_idx" ON "investments"("status");

-- CreateIndex
CREATE INDEX "investments_invested_at_idx" ON "investments"("invested_at");

-- CreateIndex
CREATE INDEX "valuations_as_of_idx" ON "valuations"("as_of");

-- CreateIndex
CREATE UNIQUE INDEX "valuations_investment_id_as_of_key" ON "valuations"("investment_id", "as_of");

-- CreateIndex
CREATE INDEX "transactions_investment_id_idx" ON "transactions"("investment_id");

-- CreateIndex
CREATE INDEX "transactions_occurred_at_idx" ON "transactions"("occurred_at");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "distributions_investment_id_idx" ON "distributions"("investment_id");

-- CreateIndex
CREATE INDEX "distributions_status_idx" ON "distributions"("status");

-- CreateIndex
CREATE INDEX "distributions_declared_date_idx" ON "distributions"("declared_date");

-- CreateIndex
CREATE INDEX "filings_status_idx" ON "filings"("status");

-- CreateIndex
CREATE INDEX "filings_due_date_idx" ON "filings"("due_date");

-- CreateIndex
CREATE INDEX "filings_assignee_id_idx" ON "filings"("assignee_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resource_id_idx" ON "audit_logs"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_investment_id_fkey" FOREIGN KEY ("investment_id") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_investment_id_fkey" FOREIGN KEY ("investment_id") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributions" ADD CONSTRAINT "distributions_investment_id_fkey" FOREIGN KEY ("investment_id") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filings" ADD CONSTRAINT "filings_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
