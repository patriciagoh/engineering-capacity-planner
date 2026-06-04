import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Director } from "./Director";
import { renderSeeded } from "../test/renderSeeded";

const renderDirector = () => renderSeeded(<Director />);

describe("Director", () => {
  it("renders a tile per team with the open badge on Aurora", async () => {
    await renderDirector();
    expect(screen.getByRole("button", { name: /Payments/ })).toBeInTheDocument();
    const aurora = screen.getByRole("button", { name: /Aurora/ });
    expect(within(aurora).getByText(/open/i)).toBeInTheDocument();
  });

  it("clicking a tile opens its detail panel", async () => {
    await renderDirector();
    await userEvent.click(screen.getByRole("button", { name: /Mobile/ }));
    expect(screen.getByRole("button", { name: /Open Mobile in Manager view/i })).toBeInTheDocument();
  });
});
