import { afterEach, expect, test, vi } from "vitest";
import { getTeamPlan, getTeamRoster, postScenario } from "./client";

afterEach(() => { vi.restoreAllMocks(); });

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok, status, json: async () => body,
  } as Response);
}

test("getTeamPlan fetches and returns the plan", async () => {
  const plan = { team_id: "msg", team_name: "Msg", gross_pm: 5.3, net_pm: 1.6,
    demand: { low: 2, expected: 3, high: 4 },
    fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 },
      optimistic_delta: -0.4, expected_delta: -1.4, pessimistic_delta: -2.4,
      is_oversubscribed_expected: true }, risks: [] };
  vi.stubGlobal("fetch", mockFetch(plan));
  const out = await getTeamPlan("msg");
  expect(out.team_id).toBe("msg");
  expect(globalThis.fetch).toHaveBeenCalledWith("/teams/msg/plan");
});

test("getTeamRoster fetches roster rows", async () => {
  const body = { team_id: "msg", team_name: "Msg",
    roster: [{ engineer_id: "dia", name: "Dia", level: "L3",
      onboarding_state: "none", availability: 1, effective_capacity: 0.71 }] };
  vi.stubGlobal("fetch", mockFetch(body));
  const out = await getTeamRoster("msg");
  expect(out.roster[0].effective_capacity).toBe(0.71);
});

test("postScenario POSTs changes and returns plan+delta", async () => {
  const body = { plan: {}, baseline: {}, delta: { gross_pm: 0, net_pm: 1.6, expected_delta: 1.6 } };
  const f = mockFetch(body);
  vi.stubGlobal("fetch", f);
  const out = await postScenario("msg", [{ op: "set_reservation", team_id: "msg", name: "KTLO", fraction: 0.4 }]);
  expect(out.delta.net_pm).toBe(1.6);
  expect(f).toHaveBeenCalledWith("/teams/msg/scenario", expect.objectContaining({ method: "POST" }));
});

test("throws on non-ok response", async () => {
  vi.stubGlobal("fetch", mockFetch({ detail: "unknown team: ghost" }, false, 404));
  await expect(getTeamPlan("ghost")).rejects.toThrow(/unknown team/);
});
