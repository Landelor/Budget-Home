CREATE TYPE "public"."expense_frequency" AS ENUM('fortnightly', 'monthly', 'yearly');

CREATE TABLE "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" varchar(100) NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "frequency" "expense_frequency" NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
