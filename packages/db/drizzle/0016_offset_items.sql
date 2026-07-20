ALTER TABLE "users" ADD COLUMN "fire_extinguisher_pct" integer NOT NULL DEFAULT 10;
ALTER TABLE "users" ADD COLUMN "smile_pct" integer NOT NULL DEFAULT 10;

CREATE TABLE "offset_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "expense_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "offset_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "offset_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action
);
