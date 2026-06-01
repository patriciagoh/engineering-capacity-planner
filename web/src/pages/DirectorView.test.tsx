import { render, screen } from "@testing-library/react";
import { vi, test, expect, beforeEach } from "vitest";
import { DirectorView } from "./DirectorView";
import * as api from "../api";

vi.mock("../api");

const org = {
  teams: [], engineers: [], deliverables: [],
  groups: [{ id: "eng", name: "Engineering", parent_id: null },
           { id: "exp", name: "Product", parent_id: "eng" }],
};
const rollup = {
  group_id: "eng", group_name: "Engineering", total_gross_pm: 9.6, total_net_pm: 3.5,
  total_demand: { low: 4, expected: 6, high: 8 },
  fit: { net_pm: 3.5, demand: { low: 4, expected: 6, high: 8 },
    optimistic_delta: -0.5, expected_delta: -2.5, pessimistic_delta: -4.5,
    is_oversubscribed_expected: true },
  team_plans: [
    { team_id: "msg", team_name: "Checkout", gross_pm: 5.3, net_pm: 1.6,
      demand: { low: 2, expected: 3, high: 4 },
      fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 }, optimistic_delta: -0.4,
        expected_delta: -1.4, pessimistic_delta: -2.4, is_oversubscribed_expected: true }, risks: [] },
    { team_id: "email", team_name: "Notifications", gross_pm: 4.3, net_pm: 1.9,
      demand: { low: 2, expected: 3, high: 4 },
      fit: { net_pm: 1.9, demand: { low: 2, expected: 3, high: 4 }, optimistic_delta: -0.1,
        expected_delta: -1.1, pessimistic_delta: -2.1, is_oversubscribed_expected: true }, risks: [] },
  ],
};

beforeEach(() => {
  vi.mocked(api.getOrg).mockResolvedValue(org as never);
  vi.mocked(api.getGroupRollup).mockResolvedValue(rollup as never);
});

test("renders a per-team roll-up grid with totals", async () => {
  render(<DirectorView />);
  expect(await screen.findByText("Checkout")).toBeInTheDocument();
  expect(screen.getByText("Notifications")).toBeInTheDocument();
  expect(screen.getByText(/3\.5 PM net/)).toBeInTheDocument(); // group total
});
