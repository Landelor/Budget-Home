import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { App } from "./App.js";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders auth page when not logged in", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /budgetapp/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
