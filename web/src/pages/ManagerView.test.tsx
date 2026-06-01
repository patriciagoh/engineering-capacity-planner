import { render, screen, waitFor } from "@testing-library/react";
import { vi, test, expect, beforeEach } from "vitest";
import { ManagerView } from "./ManagerView";
import * as api from "../api";

vi.mock("../api");

const org = {
  teams: [
    { id: "msg", name: "Checkout", productive_weeks: 12, group_id: "exp" },
    { id: "email", name: "Notifications", productive_weeks: 12, group_id: "exp" },
  ],
  engineers: [
    { id: "maya", name: "Maya", level: "L3", onboarding_state: "none",
      assignments: [{ team_id: "msg", availability: 1 }] },
    { id: "sara", name: "Sara", level: "L3", onboarding_state: "none",
      assignments: [{ team_id: "email", availability: 1 }] },
  ],
  deliverables: [
    { id: "sunco", title: "Checkout Redesign", type: "deliverable", priority: 1, owner_ids: ["maya"],
      estimate: { fidelity: "person_months", expected: 2.5 } },
    { id: "ingress", title: "Webhook Intake", type: "deliverable", priority: 1, owner_ids: ["sara"],
      estimate: { fidelity: "person_months", expected: 1.5 } },
  ],
  groups: [],
};
const plan = {
  team_id: "msg", team_name: "Checkout", gross_pm: 5.3, net_pm: 1.6,
  demand: { low: 2, expected: 3, high: 4 },
  fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 },
    optimistic_delta: -0.4, expected_delta: -1.4, pessimistic_delta: -2.4,
    is_oversubscribed_expected: true },
  risks: [{ kind: "oversubscription", severity: "high", detail: "Over by 1.4 PM" }],
};
const roster = { team_id: "msg", team_name: "Checkout",
  roster: [{ engineer_id: "maya", name: "Maya", level: "L3", onboarding_state: "none",
    availability: 1, effective_capacity: 0.71 }] };

beforeEach(() => {
  vi.mocked(api.getOrg).mockResolvedValue(org as never);
  vi.mocked(api.getTeamPlan).mockResolvedValue(plan as never);
  vi.mocked(api.getTeamRoster).mockResolvedValue(roster as never);
});

test("loads and renders the team plan, roster, deliverables, and risks", async () => {
  render(<ManagerView />);
  expect(await screen.findByText("Maya")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/1\.6 PM net/)).toBeInTheDocument());
  expect(screen.getByText("Checkout Redesign")).toBeInTheDocument();
  expect(screen.getByText(/Over by 1.4 PM/)).toBeInTheDocument();
});

test("scopes the deliverables list to the selected team", async () => {
  render(<ManagerView />);
  // msg is the default team; only msg-owned deliverables should show
  expect(await screen.findByText("Checkout Redesign")).toBeInTheDocument();
  expect(screen.queryByText("Webhook Intake")).not.toBeInTheDocument(); // Notifications's, not Checkout's
});
