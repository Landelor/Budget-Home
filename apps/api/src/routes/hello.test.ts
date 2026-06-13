import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("GET /", () => {
  it("returns 200 with api metadata", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message: "BudgetApp API" });
    await app.close();
  });
});
