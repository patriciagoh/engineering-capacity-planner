import { render, screen } from "@testing-library/react";
import { RisksList } from "./RisksList";
import type { Risk } from "../api/types";

test("renders risks with severity and detail", () => {
  const risks: Risk[] = [{ kind: "oversubscription", severity: "high", detail: "Over by 1.4 PM" }];
  render(<RisksList risks={risks} />);
  expect(screen.getByText(/Over by 1.4 PM/)).toBeInTheDocument();
  expect(screen.getByText(/high/i)).toBeInTheDocument();
});

test("renders an all-clear when no risks", () => {
  render(<RisksList risks={[]} />);
  expect(screen.getByText(/no risks/i)).toBeInTheDocument();
});
