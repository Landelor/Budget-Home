import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../app.js";
import { db, users, refreshTokens } from "@budgetapp/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

process.env["JWT_SECRET"] = "test-secret-for-auth-tests";
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL"] ??
  "postgres://budgetapp:budgetapp@localhost:5432/budgetapp";

const TEST_EMAIL = `auth-test-${Date.now()}@example.com`;
const TEST_PASSWORD = "password123";

let app: FastifyInstance;
let loginIpCounter = 0;

// Each login call gets a unique "IP" to avoid tripping the rate limiter
function freshLoginIp(): string {
  return `10.0.${Math.floor(++loginIpCounter / 256)}.${loginIpCounter % 256}`;
}

async function doLogin(email = TEST_EMAIL, password = TEST_PASSWORD) {
  return app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
    remoteAddress: freshLoginIp(),
  });
}

beforeAll(async () => {
  app = await buildApp();
  // Ensure the test user exists before any tests run
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await app.close();
});

afterEach(async () => {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, TEST_EMAIL))
    .limit(1);
  if (user) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
  }
});

describe("POST /auth/register", () => {
  it("returns 409 when email already exists", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 400 when password is too short", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "short@example.com", password: "abc" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(400);
  });

  it("creates a new user and returns 201", async () => {
    const unique = `register-new-${Date.now()}@example.com`;
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: unique, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ message: "Account created" });
    await db.delete(users).where(eq(users.email, unique));
  });
});

describe("POST /auth/login", () => {
  it("returns access and refresh tokens on valid credentials", async () => {
    const res = await doLogin();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });

  it("returns 401 on wrong password", async () => {
    const res = await doLogin(TEST_EMAIL, "wrongpassword");
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 on unknown email", async () => {
    const res = await doLogin("nobody@example.com", TEST_PASSWORD);
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /auth/refresh", () => {
  it("returns new tokens given a valid refresh token", async () => {
    const { refreshToken } = (await doLogin()).json();

    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it("returns 401 on an already-rotated refresh token", async () => {
    const { refreshToken } = (await doLogin()).json();

    await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 on an invalid token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: "not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("invalidates the refresh token and returns 204", async () => {
    const { refreshToken } = (await doLogin()).json();

    const logoutRes = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken },
    });
    expect(logoutRes.statusCode).toBe(204);

    const refreshRes = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(401);
  });
});
