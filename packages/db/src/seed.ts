/**
 * Local dev seed — populates one test user, two accounts, system categories,
 * sample transactions, and a budget.
 *
 * Run: DATABASE_URL=postgres://... npm run db:seed --workspace=packages/db
 *
 * WARNING: password_hash here is SHA-256("password123") — suitable for local
 * dev only.  Real auth must use bcrypt or argon2.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { createHash } from "crypto";
import * as schema from "./schema.js";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql, { schema });

async function seed() {
  console.log("Seeding database…");

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const [user] = await db
    .insert(schema.users)
    .values({
      email: "dev@budgetapp.test",
      passwordHash: createHash("sha256").update("password123").digest("hex"),
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log("User already exists, skipping seed.");
    await sql.end();
    return;
  }

  console.log(`  Created user: ${user.email} (id=${user.id})`);

  // ── 2. System-default categories (userId = null) ───────────────────────────
  const [food, transport, housing, income, entertainment, health, shopping] =
    await db
      .insert(schema.categories)
      .values([
        { name: "Food & Dining", color: "#F59E0B", icon: "utensils" },
        { name: "Transport", color: "#3B82F6", icon: "car" },
        { name: "Housing", color: "#8B5CF6", icon: "home" },
        { name: "Income", color: "#10B981", icon: "trending-up" },
        { name: "Entertainment", color: "#EC4899", icon: "film" },
        { name: "Health", color: "#EF4444", icon: "heart" },
        { name: "Shopping", color: "#F97316", icon: "shopping-bag" },
      ])
      .returning();

  console.log("  Created system categories");

  // ── 3. Sub-categories (parented to system categories) ─────────────────────
  if (food && transport) {
    await db.insert(schema.categories).values([
      {
        name: "Groceries",
        color: "#D97706",
        icon: "shopping-cart",
        parentCategoryId: food.id,
      },
      {
        name: "Restaurants",
        color: "#FBBF24",
        icon: "coffee",
        parentCategoryId: food.id,
      },
      {
        name: "Public Transit",
        color: "#60A5FA",
        icon: "bus",
        parentCategoryId: transport.id,
      },
    ]);
    console.log("  Created sub-categories");
  }

  // ── 4. Accounts ────────────────────────────────────────────────────────────
  const [checking, savings] = await db
    .insert(schema.accounts)
    .values([
      {
        userId: user.id,
        name: "Main Checking",
        type: "checking",
        currency: "USD",
        currentBalance: "3450.00",
      },
      {
        userId: user.id,
        name: "Emergency Fund",
        type: "savings",
        currency: "USD",
        currentBalance: "12000.00",
      },
    ])
    .returning();

  console.log("  Created accounts");

  // ── 5. Transactions ────────────────────────────────────────────────────────
  if (checking && savings && income && food && transport && housing) {
    await db.insert(schema.transactions).values([
      {
        accountId: checking.id,
        userId: user.id,
        amount: "3500.00",
        date: "2026-06-01",
        description: "Salary",
        categoryId: income.id,
        isRecurring: true,
      },
      {
        accountId: checking.id,
        userId: user.id,
        amount: "-1200.00",
        date: "2026-06-02",
        description: "Rent payment",
        categoryId: housing.id,
        isRecurring: true,
      },
      {
        accountId: checking.id,
        userId: user.id,
        amount: "-85.40",
        date: "2026-06-05",
        description: "Weekly groceries",
        categoryId: food.id,
      },
      {
        accountId: checking.id,
        userId: user.id,
        amount: "-42.00",
        date: "2026-06-07",
        description: "Monthly transit pass",
        categoryId: transport.id,
        isRecurring: true,
      },
      {
        accountId: checking.id,
        userId: user.id,
        amount: "-28.50",
        date: "2026-06-10",
        description: "Dinner with friends",
        categoryId: food.id,
      },
      {
        accountId: savings.id,
        userId: user.id,
        amount: "500.00",
        date: "2026-06-01",
        description: "Monthly savings transfer",
        isRecurring: true,
      },
    ]);

    console.log("  Created transactions");
  }

  // ── 6. Budgets ─────────────────────────────────────────────────────────────
  if (food && transport && housing) {
    await db.insert(schema.budgets).values([
      {
        userId: user.id,
        categoryId: food.id,
        period: "monthly",
        limitAmount: "400.00",
        startDate: "2026-06-01",
      },
      {
        userId: user.id,
        categoryId: transport.id,
        period: "monthly",
        limitAmount: "150.00",
        startDate: "2026-06-01",
      },
      {
        userId: user.id,
        categoryId: housing.id,
        period: "monthly",
        limitAmount: "1300.00",
        startDate: "2026-06-01",
      },
    ]);

    console.log("  Created budgets");
  }

  console.log("Done — seed complete.");
  await sql.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
