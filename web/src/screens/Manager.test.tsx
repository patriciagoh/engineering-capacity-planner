import { describe, it, expect } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Manager } from "./Manager";
import { renderSeeded } from "../test/renderSeeded";

const renderManager = () => renderSeeded(<Manager />);

describe("Manager", () => {
  it("shows Aurora's net capacity headline (2.7)", async () => {
    await renderManager();
    expect(screen.getByText("2.7")).toBeInTheDocument();
  });

  it("recomputes the net-capacity headline when a KTLO slider changes", async () => {
    await renderManager();
    expect(screen.getByText("2.7")).toBeInTheDocument();
    const support = screen.getByLabelText(/Support tickets reserved/i);
    // Raise support-tickets reservation 15% -> 30%: KTLO rises 50% -> 65%, so net
    // capacity falls from 2.7 to 1.9 pm (an unambiguous headline). Drive the range
    // input directly. (3.5 would collide with the Effective FTE stat, also 3.5.)
    fireEvent.change(support, { target: { value: "30" } });
    expect(screen.queryByText("2.7")).toBeNull();
    expect(screen.getByText("1.9")).toBeInTheDocument();
  });

  it("adds an engineer when '+ Add engineer' is clicked", async () => {
    await renderManager();
    const before = screen.getAllByLabelText(/Engineer name/i).length;
    await userEvent.click(screen.getByRole("button", { name: /add engineer/i }));
    expect(screen.getAllByLabelText(/Engineer name/i).length).toBe(before + 1);
  });

  it("toggling a project assignment chip updates assignment state", async () => {
    await renderManager();
    const projects = screen.getByRole("region", { name: /projects/i });
    const chip = within(projects).getAllByRole("button", { pressed: false })[0];
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });
});
