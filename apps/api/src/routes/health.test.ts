import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", version: expect.any(String) });
    await app.close();
  });
});
