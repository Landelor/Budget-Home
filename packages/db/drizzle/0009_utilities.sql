CREATE TYPE "public"."utility_type" AS ENUM('gas', 'power', 'water');

CREATE TABLE "utilities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" "utility_type" NOT NULL,
  "date" date NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "service_days" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "utilities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
