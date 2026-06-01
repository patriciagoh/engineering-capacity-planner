import { render, screen } from "@testing-library/react";
import { FitBar } from "./FitBar";
import type { TeamPlan } from "../api/types";

const plan: TeamPlan = {
  team_id: "msg", team_name: "Checkout", gross_pm: 5.3, net_pm: 1.6,
  demand: { low: 2, expected: 3, high: 4 },
  fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 },
    optimistic_delta: -0.4, expected_delta: -1.4, pessimistic_delta: -2.4,
    is_oversubscribed_expected: true },
  risks: [],
};

test("shows net/demand/fit tiles and an oversubscribed label", () => {
  render(<FitBar plan={plan} />);
  expect(screen.getByText(/1\.6 PM net/)).toBeInTheDocument();
  expect(screen.getByText(/4\.5 PM demand|3\.0 PM demand/)).toBeInTheDocument();
  expect(screen.getByText(/oversubscribed/i)).toBeInTheDocument();
  expect(screen.getByText("Fit")).toBeInTheDocument(); // tile label
});

test("shows headroom when not oversubscribed", () => {
  const ok: TeamPlan = { ...plan, net_pm: 6,
    fit: { ...plan.fit, net_pm: 6, expected_delta: 3, is_oversubscribed_expected: false } };
  render(<FitBar plan={ok} />);
  expect(screen.getByText(/headroom/i)).toBeInTheDocument();
});
