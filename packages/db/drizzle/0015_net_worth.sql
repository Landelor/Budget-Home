CREATE TYPE "public"."net_worth_section" AS ENUM('asset', 'liability');
CREATE TYPE "public"."net_worth_type" AS ENUM('property', 'shares', 'bank_account', 'super', 'loan');

CREATE TABLE "net_worth_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "section" "net_worth_section" NOT NULL,
  "type" "net_worth_type" NOT NULL,
  "description" varchar(255) NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "month" date NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "net_worth_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
