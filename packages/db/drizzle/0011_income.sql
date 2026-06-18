CREATE TABLE "income_persons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" varchar(100) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "income_persons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "incomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "person_id" uuid,
  "name" varchar(100) NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "frequency" "expense_frequency" NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "incomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "incomes_person_id_income_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."income_persons"("id") ON DELETE set null ON UPDATE no action
);
