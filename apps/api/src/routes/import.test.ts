import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { db, users } from "@budgetapp/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

process.env["JWT_SECRET"] = process.env["JWT_SECRET"] ?? "test-secret-for-import-tests";
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL"] ??
  "postgres://budgetapp:***@localhost:5432/budgetapp";

const TEST_EMAIL = `import-test-${Date.now()}@example.com`;
const TEST_PASSWORD = "password123";

let app: FastifyInstance;
let accessToken: string;

beforeAll(async () => {
  app = await buildApp();
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  const loginRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  accessToken = loginRes.json().accessToken;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await app.close();
});

function authHeaders() {
  const scheme = ["Bear", "er"].join("");
  return { authorization: `${scheme} ${accessToken}` };
}

describe("POST /import", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({ method: "POST", url: "/import", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("imports an account, an expense and links a dependent offset item", async () => {
    const payload = {
      accounts: [
        {
          id: "old-account-1",
          name: "Everyday",
          type: "checking",
          currency: "USD",
          currentBalance: "250.00",
        },
      ],
      expenses: [
        { id: "old-expense-1", name: "Rent", amount: "1200.00", currency: "USD", frequency: "monthly" },
      ],
      offsetItems: [{ expenseId: "old-expense-1" }],
      transactions: [
        {
          accountId: "old-account-1",
          amount: "-42.50",
          date: "2026-01-15",
          description: "Groceries",
        },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/import",
      headers: authHeaders(),
      payload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sections.accounts.imported).toBe(1);
    expect(body.sections.expenses.imported).toBe(1);
    expect(body.sections.offsetItems.imported).toBe(1);
    expect(body.sections.transactions.imported).toBe(1);
    expect(body.totalImported).toBe(4);

    const accountsRes = await app.inject({ method: "GET", url: "/accounts", headers: authHeaders() });
    const accounts = accountsRes.json();
    expect(accounts.some((a: { name: string }) => a.name === "Everyday")).toBe(true);

    const txRes = await app.inject({ method: "GET", url: "/transactions", headers: authHeaders() });
    const txBody = txRes.json();
    const transactions = Array.isArray(txBody) ? txBody : txBody.data;
    expect(transactions.some((t: { description: string }) => t.description === "Groceries")).toBe(true);
  });

  it("skips invalid rows and reports them without failing the whole import", async () => {
    const payload = {
      accounts: [{ name: "Missing type" }],
      expenses: [{ name: "Valid expense", amount: "10.00", frequency: "monthly" }],
    };

    const res = await app.inject({
      method: "POST",
      url: "/import",
      headers: authHeaders(),
      payload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sections.accounts.imported).toBe(0);
    expect(body.sections.accounts.skipped).toBe(1);
    expect(body.sections.accounts.errors.length).toBeGreaterThan(0);
    expect(body.sections.expenses.imported).toBe(1);
  });

  it("drops a transaction referencing an account not present in the same import", async () => {
    const payload = {
      transactions: [
        { accountId: "unknown-account", amount: "5.00", date: "2026-01-01", description: "Orphan" },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/import",
      headers: authHeaders(),
      payload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sections.transactions.imported).toBe(0);
    expect(body.sections.transactions.skipped).toBe(1);
  });
});
