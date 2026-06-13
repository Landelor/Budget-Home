ALTER TABLE "accounts" ADD COLUMN "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "deleted_at" timestamp;
