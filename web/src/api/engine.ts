import type { GroupRollup, Org, ScenarioResult, TeamPlan, TeamRoster, Change } from "./types";

declare global {
  // provided by the Pyodide CDN script in index.html
  function loadPyodide(config?: { indexURL?: string }): Promise<any>;
}

const BASE = import.meta.env.BASE_URL ?? "/";
const WHEEL = `${BASE}capacity_engine-0.1.0-py3-none-any.whl`;

let bootPromise: Promise<any> | null = null;

function boot(): Promise<any> {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const pyodide = await loadPyodide();
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install(new URL(WHEEL, location.href).href);
    const presenterSrc = await (await fetch(`${BASE}presenter.py`)).text();
    await pyodide.runPythonAsync(presenterSrc);
    const orgJson = await (await fetch(`${BASE}sample_org.json`)).text();
    pyodide.globals.get("load_org")(orgJson);
    return pyodide;
  })();
  return bootPromise;
}

async function call<T>(fn: string, ...args: unknown[]): Promise<T> {
  const pyodide = await boot();
  const result = pyodide.globals.get(fn)(...args);
  return JSON.parse(typeof result === "string" ? result : result.toString()) as T;
}

export const getOrg = () => call<Org>("get_org");
export const getTeamPlan = (teamId: string) => call<TeamPlan>("get_team_plan", teamId);
export const getTeamRoster = (teamId: string) => call<TeamRoster>("get_team_roster", teamId);
export const getGroupRollup = (groupId: string) => call<GroupRollup>("get_group_rollup", groupId);
export const postScenario = (teamId: string, changes: Change[]) =>
  call<ScenarioResult>("post_scenario", teamId, JSON.stringify(changes));

/** Resolves once the engine is booted — for the loading state. */
export const ready = () => boot().then(() => true);
