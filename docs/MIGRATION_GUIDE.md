# Database Migration Guide - Payment & Premium Integration

## 🗄️ Migration Overview

This guide helps you apply the database changes for payment and premium features.

## 📋 Changes Made

### User Model
- Added `premiumTill` field (DateTime, nullable)
- Kept existing `premiumExpiresAt` for backward compatibility

### Payment Model
- Added `provider` field (String, default: "payme")
- Added `transactionId` field (String, nullable, unique)
- Changed `receiptFileId` to nullable
- Changed `duration` to nullable
- Added index on `transactionId`

### PaymentStatus Enum
- Added `SUCCESS` status
- Added `FAILED` status
- Kept existing `PENDING`, `APPROVED`, `REJECTED`

## 🚀 Apply Migration

### Option 1: Development (Recommended for First Time)
```bash
# Create and apply migration
npx prisma migrate dev --name add_payment_premium_integration

# This will:
# 1. Create migration files
# 2. Apply changes to database
# 3. Regenerate Prisma Client
```

### Option 2: Production
```bash
# Apply migration without creating new files
npx prisma migrate deploy

# Then regenerate client
npx prisma generate
```

### Option 3: Reset Database (⚠️ WARNING: Deletes all data!)
```bash
# Only use in development!
npx prisma migrate reset

# This will:
# 1. Drop database
# 2. Create database
# 3. Apply all migrations
# 4. Run seed (if configured)
```

## 🔍 Verify Migration

### Check Migration Status
```bash
npx prisma migrate status
```

### Expected Output:
```
Database schema is up to date!
```

### Check Database
```bash
# Open Prisma Studio
npx prisma studio

# Or connect to database directly
# PostgreSQL example:
psql -U your_user -d your_database -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Payment';"
```

## 🧪 Test Migration

### 1. Check Payment Table
```sql
-- View Payment table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Payment';

-- Should include:
-- provider (text)
-- transactionId (text, nullable)
-- receiptFileId (text, nullable)
-- duration (integer, nullable)
```

### 2. Check User Table
```sql
-- View User table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'User';

-- Should include:
-- premiumTill (timestamp, nullable)
-- premiumExpiresAt (timestamp, nullable)
```

### 3. Check PaymentStatus Enum
```sql
-- View enum values
SELECT enumlabel 
FROM pg_enum e 
JOIN pg_type t ON e.enumtypid = t.oid 
WHERE t.typname = 'PaymentStatus';

-- Should include:
-- PENDING
-- SUCCESS
-- FAILED
-- APPROVED
-- REJECTED
```

## 🔧 Manual Migration (If Needed)

If automatic migration fails, apply manually:

### Step 1: Add PaymentStatus Values
```sql
-- Add SUCCESS status
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'SUCCESS';

-- Add FAILED status
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';
```

### Step 2: Update User Table
```sql
-- Add premiumTill field
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "premiumTill" TIMESTAMP(3);
```

### Step 3: Update Payment Table
```sql
-- Add provider field
ALTER TABLE "Payment" 
ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'payme';

-- Add transactionId field
ALTER TABLE "Payment" 
ADD COLUMN IF NOT EXISTS "transactionId" TEXT UNIQUE;

-- Make receiptFileId nullable
ALTER TABLE "Payment" 
ALTER COLUMN "receiptFileId" DROP NOT NULL;

-- Make duration nullable
ALTER TABLE "Payment" 
ALTER COLUMN "duration" DROP NOT NULL;

-- Add index on transactionId
CREATE INDEX IF NOT EXISTS "Payment_transactionId_idx" 
ON "Payment"("transactionId");
```

### Step 4: Regenerate Prisma Client
```bash
npx prisma generate
```

## 🔄 Rollback Migration (If Needed)

### Development
```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back add_payment_premium_integration
```

### Production (Manual Rollback)
```sql
-- Remove new fields from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "premiumTill";

-- Remove new fields from Payment
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "provider";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "transactionId";
ALTER TABLE "Payment" ALTER COLUMN "receiptFileId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "duration" SET NOT NULL;

-- Drop index
DROP INDEX IF EXISTS "Payment_transactionId_idx";

-- Note: Cannot remove enum values easily in PostgreSQL
-- You would need to recreate the enum type
```

## 📊 Data Migration

### Copy premiumExpiresAt to premiumTill
```sql
-- Sync existing data
UPDATE "User" 
SET "premiumTill" = "premiumExpiresAt" 
WHERE "premiumExpiresAt" IS NOT NULL;
```

### Update Existing Payments
```sql
-- Set provider for existing payments
UPDATE "Payment" 
SET "provider" = 'manual' 
WHERE "provider" IS NULL;

-- Or set all to 'payme'
UPDATE "Payment" 
SET "provider" = 'payme' 
WHERE "provider" IS NULL;
```

## ⚠️ Common Issues

### Issue 1: Enum Value Already Exists
```
Error: Enum value 'SUCCESS' already exists
```
**Solution:** Enum values were added in a previous migration. Safe to ignore or use `IF NOT EXISTS`.

### Issue 2: Column Already Exists
```
Error: Column "premiumTill" already exists
```
**Solution:** Field was added previously. Check if migration was partially applied.

### Issue 3: Migration Lock
```
Error: Migration file is locked
```
**Solution:**
```bash
# Release lock
npx prisma migrate resolve --applied add_payment_premium_integration
```

### Issue 4: Schema Drift
```
Error: Database schema is not in sync
```
**Solution:**
```bash
# Check differences
npx prisma migrate diff

# Apply pending migrations
npx prisma migrate deploy
```

## ✅ Verification Checklist

After migration, verify:

- [ ] Migration applied successfully
- [ ] `PaymentStatus` has SUCCESS and FAILED values
- [ ] `User` table has `premiumTill` field
- [ ] `Payment` table has `provider` field
- [ ] `Payment` table has `transactionId` field (unique)
- [ ] `receiptFileId` is nullable
- [ ] `duration` is nullable
- [ ] Prisma Client regenerated
- [ ] Application starts without errors
- [ ] Can create payment via API
- [ ] Can check premium status

## 🧹 Cleanup

### Remove Old Migration Files (Optional)
```bash
# Only if you want to consolidate migrations
# ⚠️ Be careful - this changes migration history

# 1. Create a new baseline migration
npx prisma migrate diff --to-schema-datamodel prisma/schema.prisma --script > migration.sql

# 2. Apply it
psql -U user -d database -f migration.sql

# 3. Mark as applied
npx prisma migrate resolve --applied baseline
```

## 📝 Best Practices

1. **Always Backup**: Backup database before migration
2. **Test First**: Test migration in development
3. **Read Migration**: Review SQL before applying
4. **Verify Changes**: Check schema after migration
5. **Keep History**: Don't delete migration files
6. **Document Changes**: Update this guide if making changes

## 🆘 Emergency Rollback

If something goes wrong:

```bash
# 1. Stop application
npm stop

# 2. Restore database backup
# PostgreSQL example:
pg_restore -U user -d database backup.dump

# 3. Rollback migration
npx prisma migrate resolve --rolled-back add_payment_premium_integration

# 4. Fix issues
# 5. Try again
```

## 📞 Support

If migration fails:
1. Check error message
2. Review Common Issues section
3. Check database logs
4. Verify database connection
5. Try manual migration steps

## 🎓 Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Migration Troubleshooting](https://www.prisma.io/docs/guides/database/troubleshooting-orm)
- [Database Schema](../prisma/schema.prisma)

---

**Status**: ✅ Ready to Apply  
**Risk Level**: 🟢 Low (Adds new fields, backward compatible)  
**Backup Required**: ⚠️ Recommended  
**Estimated Time**: < 1 minute
