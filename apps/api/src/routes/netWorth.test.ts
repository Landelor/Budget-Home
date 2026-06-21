import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { db, users } from "@budgetapp/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

process.env["JWT_SECRET"] = process.env["JWT_SECRET"] ?? "test-secret-for-net-worth-tests";
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL"] ??
  "postgres://budgetapp:budgetapp@localhost:5432/budgetapp";

const TEST_EMAIL = `net-worth-test-${Date.now()}@example.com`;
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
  return { authorization: `Bearer ${accessToken}` };
}

describe("POST /net-worth/entries", () => {
  it("creates an asset entry and derives its section", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/net-worth/entries",
      headers: authHeaders(),
      payload: { type: "property", description: "Home", amount: 500000, month: "2026-06-01" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.section).toBe("asset");
    expect(body.amount).toBe("500000.00");
  });

  it("creates a liability entry and derives its section", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/net-worth/entries",
      headers: authHeaders(),
      payload: { type: "loan", description: "Mortgage", amount: 300000, month: "2026-06-01" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().section).toBe("liability");
  });

  it("returns 400 for an unknown type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/net-worth/entries",
      headers: authHeaders(),
      payload: { type: "crypto", description: "Bitcoin", amount: 1000, month: "2026-06-01" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 without a token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/net-worth/entries",
      payload: { type: "property", description: "Home", amount: 1000, month: "2026-06-01" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /net-worth/entries", () => {
  it("lists only the authenticated user's entries", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/net-worth/entries",
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });
});

describe("PATCH /net-worth/entries/:id", () => {
  it("updates an entry's amount and month", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/net-worth/entries",
      headers: authHeaders(),
      payload: { type: "shares", description: "ETFs", amount: 1000, month: "2026-06-01" },
    });
    const id = created.json().id;

    const res = await app.inject({
      method: "PATCH",
      url: `/net-worth/entries/${id}`,
      headers: authHeaders(),
      payload: { amount: 1500, month: "2026-07-01" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.amount).toBe("1500.00");
    expect(body.month).toBe("2026-07-01");
  });

  it("returns 404 for an entry that does not exist", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/net-worth/entries/00000000-0000-0000-0000-000000000000",
      headers: authHeaders(),
      payload: { amount: 10 },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /net-worth/entries/:id", () => {
  it("soft-deletes an entry", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/net-worth/entries",
      headers: authHeaders(),
      payload: { type: "bank_account", description: "Savings", amount: 200, month: "2026-06-01" },
    });
    const id = created.json().id;

    const del = await app.inject({
      method: "DELETE",
      url: `/net-worth/entries/${id}`,
      headers: authHeaders(),
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: "GET",
      url: "/net-worth/entries",
      headers: authHeaders(),
    });
    expect(list.json().some((e: { id: string }) => e.id === id)).toBe(false);
  });
});

describe("GET /net-worth/summary", () => {
  it("returns assets, liabilities and net position per month", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/net-worth/summary",
      headers: authHeaders(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    const june = body.find((row: { month: string }) => row.month === "2026-06-01");
    expect(june).toBeDefined();
    expect(parseFloat(june.netPosition)).toBeCloseTo(
      parseFloat(june.totalAssets) - parseFloat(june.totalLiabilities),
    );
  });
});
