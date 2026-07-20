import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { db, users } from "@budgetapp/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

process.env["JWT_SECRET"] = process.env["JWT_SECRET"] ?? "test-secret-for-offset-items-tests";
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL"] ??
  "postgres://budgetapp:budgetapp@localhost:5432/budgetapp";

const TEST_EMAIL = `offset-items-test-${Date.now()}@example.com`;
const TEST_PASSWORD = "password123";

let app: FastifyInstance;
let accessToken: string;
let expenseId: string;

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

  const expenseRes = await app.inject({
    method: "POST",
    url: "/expenses",
    headers: authHeaders(),
    payload: { name: "Rent", amount: 1200, frequency: "monthly" },
  });
  expenseId = expenseRes.json().id;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await app.close();
});

function authHeaders() {
  return { authorization: `Bearer ${accessToken}` };
}

describe("offset items persistence", () => {
  it("saves an offset item and returns it from a new session", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/offset-items",
      headers: authHeaders(),
      payload: { expenseId },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.expenseId).toBe(expenseId);

    // Simulate a brand-new session (new app/browser) reading the same account.
    const freshApp = await buildApp();
    const listRes = await freshApp.inject({
      method: "GET",
      url: "/offset-items",
      headers: authHeaders(),
    });
    expect(listRes.statusCode).toBe(200);
    const items = listRes.json();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(created.id);
    expect(items[0].expenseId).toBe(expenseId);
    await freshApp.close();
  });

  it("removes an offset item via soft delete", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/offset-items",
      headers: authHeaders(),
      payload: { expenseId },
    });
    const id = createRes.json().id;

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/offset-items/${id}`,
      headers: authHeaders(),
    });
    expect(deleteRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: "GET",
      url: "/offset-items",
      headers: authHeaders(),
    });
    const items = listRes.json();
    expect(items.find((i: { id: string }) => i.id === id)).toBeUndefined();
  });
});

describe("settings percentage persistence", () => {
  it("saves fireExtinguisherPct and smilePct and returns them from a new session", async () => {
    const patchRes = await app.inject({
      method: "PATCH",
      url: "/settings",
      headers: authHeaders(),
      payload: { fireExtinguisherPct: 25, smilePct: 40 },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().fireExtinguisherPct).toBe(25);
    expect(patchRes.json().smilePct).toBe(40);

    const freshApp = await buildApp();
    const getRes = await freshApp.inject({
      method: "GET",
      url: "/settings",
      headers: authHeaders(),
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().fireExtinguisherPct).toBe(25);
    expect(getRes.json().smilePct).toBe(40);
    await freshApp.close();
  });
});
