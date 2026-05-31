import { render, screen, waitFor } from "@testing-library/react";
import { vi, test, expect, beforeEach } from "vitest";
import { ManagerView } from "./ManagerView";
import * as api from "../api/client";

vi.mock("../api/client");

const org = {
  teams: [{ id: "msg", name: "Messaging Experience", productive_weeks: 12, group_id: "exp" }],
  engineers: [], deliverables: [
    { id: "sunco", title: "SunCo CPaaS", type: "deliverable", priority: 1, owner_ids: ["dia"],
      estimate: { fidelity: "person_months", expected: 2.5 } }],
  groups: [],
};
const plan = {
  team_id: "msg", team_name: "Messaging Experience", gross_pm: 5.3, net_pm: 1.6,
  demand: { low: 2, expected: 3, high: 4 },
  fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 },
    optimistic_delta: -0.4, expected_delta: -1.4, pessimistic_delta: -2.4,
    is_oversubscribed_expected: true },
  risks: [{ kind: "oversubscription", severity: "high", detail: "Over by 1.4 PM" }],
};
const roster = { team_id: "msg", team_name: "Messaging Experience",
  roster: [{ engineer_id: "dia", name: "Dia", level: "L3", onboarding_state: "none",
    availability: 1, effective_capacity: 0.71 }] };

beforeEach(() => {
  vi.mocked(api.getOrg).mockResolvedValue(org as never);
  vi.mocked(api.getTeamPlan).mockResolvedValue(plan as never);
  vi.mocked(api.getTeamRoster).mockResolvedValue(roster as never);
});

test("loads and renders the team plan, roster, deliverables, and risks", async () => {
  render(<ManagerView />);
  expect(await screen.findByText("Dia")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/1\.6 PM net/)).toBeInTheDocument());
  expect(screen.getByText("SunCo CPaaS")).toBeInTheDocument();
  expect(screen.getByText(/Over by 1.4 PM/)).toBeInTheDocument();
});
