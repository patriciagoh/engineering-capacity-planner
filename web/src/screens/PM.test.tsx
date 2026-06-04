import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PM } from "./PM";
import { renderSeeded } from "../test/renderSeeded";

const renderPM = () => renderSeeded(<PM />);

describe("PM", () => {
  it("says it lands when the estimate fits the team's spare", async () => {
    await renderPM();
    const est = screen.getByLabelText(/estimate/i);
    await userEvent.clear(est);
    await userEvent.type(est, "0.2"); // Aurora spare ~0.4
    expect(screen.getByText(/lands on/i)).toBeInTheDocument();
  });

  it("says it is short and lists three levers when it does not fit", async () => {
    await renderPM();
    const est = screen.getByLabelText(/estimate/i);
    await userEvent.clear(est);
    await userEvent.type(est, "5");
    expect(screen.getByText(/short by/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
