import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedToggle } from "./SegmentedToggle";
import { FitBar } from "./FitBar";
import { LoadBar } from "./LoadBar";
import { StatRow } from "./StatRow";
import { vi } from "vitest";

describe("primitives", () => {
  it("SegmentedToggle marks the active option and fires onChange", async () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={[{ value: "month", label: "Monthly" }, { value: "quarter", label: "Quarterly" }]} value="quarter" onChange={onChange} ariaLabel="Window" />);
    const monthly = screen.getByRole("tab", { name: "Monthly" });
    expect(screen.getByRole("tab", { name: "Quarterly" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(monthly);
    expect(onChange).toHaveBeenCalledWith("month");
  });

  it("FitBar caps the used portion and exposes an accessible label", () => {
    render(<FitBar supply={2.7} demand={5} />);
    expect(screen.getByRole("img", { name: /oversubscribed|over/i })).toBeInTheDocument();
  });

  it("LoadBar flags overcommitment over 100%", () => {
    render(<LoadBar name="Alex" pct={120} over />);
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText(/120%/)).toBeInTheDocument();
  });

  it("StatRow renders a term and value", () => {
    render(<StatRow term="Net capacity" value="2.7 pm" />);
    expect(screen.getByText("Net capacity")).toBeInTheDocument();
    expect(screen.getByText("2.7 pm")).toBeInTheDocument();
  });
});
