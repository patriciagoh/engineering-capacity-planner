import { afterEach, beforeEach, expect, test, vi } from "vitest";

const calls: Record<string, unknown[]> = {};
function fakePyodide() {
  const globals = {
    get: (name: string) => (...args: unknown[]) => {
      calls[name] = args;
      if (name === "get_team_plan") return JSON.stringify({ team_id: args[0], team_name: "Checkout", gross_pm: 5.3, net_pm: 1.6, demand: { low: 1, expected: 2, high: 3 }, fit: { net_pm: 1.6, demand: { low: 1, expected: 2, high: 3 }, optimistic_delta: 0, expected_delta: -0.4, pessimistic_delta: -1, is_oversubscribed_expected: true }, risks: [] });
      if (name === "load_org") return undefined;
      return "{}";
    },
  };
  return {
    loadPackage: vi.fn().mockResolvedValue(undefined),
    pyimport: vi.fn().mockReturnValue({ install: vi.fn().mockResolvedValue(undefined) }),
    runPythonAsync: vi.fn().mockResolvedValue(undefined),
    runPython: vi.fn(),
    globals,
  };
}

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  (globalThis as any).loadPyodide = vi.fn().mockResolvedValue(fakePyodide());
  (globalThis as any).fetch = vi.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      text: async () =>
        String(url).includes("engine-manifest")
          ? JSON.stringify({ wheel: "capacity_engine-0.1.0-py3-none-any.whl" })
          : "PYCODE_OR_JSON",
    } as Response));
});
afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

test("getTeamPlan boots pyodide, installs the wheel, and returns a parsed plan", async () => {
  const { getTeamPlan } = await import("./engine");
  const plan = await getTeamPlan("msg");
  expect((globalThis as any).loadPyodide).toHaveBeenCalled();
  expect(plan.team_id).toBe("msg");
  expect(calls["get_team_plan"]).toEqual(["msg"]);
});

test("postScenario passes team id and a JSON changes string", async () => {
  const { postScenario } = await import("./engine");
  await postScenario("msg", [{ op: "set_reservation", team_id: "msg", name: "KTLO", fraction: 0.4 }]);
  expect(calls["post_scenario"]?.[0]).toBe("msg");
  expect(typeof calls["post_scenario"]?.[1]).toBe("string");
});
