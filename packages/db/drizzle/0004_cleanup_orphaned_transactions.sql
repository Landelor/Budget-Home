-- Soft-delete transactions that belong to already-deleted accounts.
-- These orphans were created before the cascade-delete was added in BUD-29.
UPDATE "transactions"
SET "deleted_at" = NOW()
WHERE "deleted_at" IS NULL
  AND "account_id" IN (
    SELECT "id" FROM "accounts" WHERE "deleted_at" IS NOT NULL
  );
