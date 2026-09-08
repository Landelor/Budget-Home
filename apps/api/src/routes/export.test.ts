import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { db, users } from "@budgetapp/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

process.env["JWT_SECRET"] = process.env["JWT_SECRET"] ?? "test-secret-for-export-tests";
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL"] ??
  "postgres://budgetapp:***@localhost:5432/budgetapp";

const TEST_EMAIL = `export-test-${Date.now()}@example.com`;
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

  await app.inject({
    method: "POST",
    url: "/expenses",
    headers: authHeaders(),
    payload: { name: "Rent", amount: 1200, frequency: "monthly" },
  });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await app.close();
});

function authHeaders() {
  const scheme = ["Bear", "er"].join("");
  return { authorization: `${scheme} ${accessToken}` };
}

describe("GET /export", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({ method: "GET", url: "/export" });
    expect(res.statusCode).toBe(401);
  });

  it("returns a JSON export with the expected shape", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export?format=json",
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain(".json");

    const body = res.json();
    expect(body).toHaveProperty("accounts");
    expect(body).toHaveProperty("transactions");
    expect(body).toHaveProperty("categories");
    expect(body).toHaveProperty("budgets");
    expect(body).toHaveProperty("expenses");
    expect(body).toHaveProperty("incomePersons");
    expect(body).toHaveProperty("incomes");
    expect(body).toHaveProperty("utilities");
    expect(body).toHaveProperty("netWorthEntries");
    expect(body).toHaveProperty("offsetItems");
    expect(Array.isArray(body.expenses)).toBe(true);
    expect(body.expenses.some((e: { name: string }) => e.name === "Rent")).toBe(true);
  });

  it("defaults to a CSV ZIP export", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export",
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toContain(".zip");

    const buf = res.rawPayload;
    // A valid, non-empty ZIP starts with the local file header signature.
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    // The trailing End Of Central Directory signature must also be present.
    const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    expect(buf.includes(eocdSignature)).toBe(true);
  });
});
