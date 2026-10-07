-- Enforce "at most one active attachment per income/utility entry" at the
-- database level. The API already checked for an existing attachment before
-- inserting a new one, but that check-then-insert wasn't atomic, so two
-- concurrent upload requests could both pass the check and create two rows.
-- A partial unique index (only covering non-deleted rows) closes that race
-- and lets the route return a clean 409 on conflict instead of silently
-- ending up with duplicate attachments.
CREATE UNIQUE INDEX "income_attachments_income_id_active_unique" ON "income_attachments" ("income_id") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "utility_attachments_utility_id_active_unique" ON "utility_attachments" ("utility_id") WHERE "deleted_at" IS NULL;
