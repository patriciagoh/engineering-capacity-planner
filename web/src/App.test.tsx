import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

describe("App", () => {
  it("switches between the three views from the top bar", async () => {
    render(<App />);
    expect(screen.getByText("2.7")).toBeInTheDocument(); // Manager default
    await userEvent.click(screen.getByRole("button", { name: /VP Director/i }));
    expect(screen.getByText(/Every team's fit at a glance/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /PM/i }));
    expect(screen.getByText(/Will my project land/i)).toBeInTheDocument();
  });
});
