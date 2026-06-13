import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  it("renders heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /budgetapp/i })).toBeInTheDocument();
  });
});
