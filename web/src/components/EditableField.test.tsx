import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableField } from "./EditableField";

describe("EditableField", () => {
  it("commits on blur", async () => {
    const onCommit = vi.fn();
    render(<EditableField value="Aurora" onCommit={onCommit} ariaLabel="Team name" />);
    const field = screen.getByRole("textbox", { name: "Team name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Borealis");
    field.blur();
    expect(onCommit).toHaveBeenCalledWith("Borealis");
  });

  it("commits on Enter and does not insert a newline", async () => {
    const onCommit = vi.fn();
    render(<EditableField value="1.2" onCommit={onCommit} ariaLabel="Estimate" numeric />);
    const field = screen.getByRole("textbox", { name: "Estimate" });
    await userEvent.clear(field);
    await userEvent.type(field, "2.5{Enter}");
    expect(onCommit).toHaveBeenCalledWith("2.5");
  });
});
