import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("exposes its definition to assistive tech and reveals on hover", async () => {
    render(<Tooltip label="KTLO" definition="Keep the lights on" />);
    const trigger = screen.getByText("KTLO");
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent("Keep the lights on");
    await userEvent.hover(trigger);
    expect(trigger).toHaveAttribute("aria-describedby");
  });
});
