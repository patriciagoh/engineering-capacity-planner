import type { GroupRollup, Org, ScenarioResult, TeamPlan, TeamRoster, Change } from "./types";

declare global {
  // provided by the Pyodide CDN script in index.html
  function loadPyodide(config?: { indexURL?: string }): Promise<any>;
}

const BASE = import.meta.env.BASE_URL ?? "/";
// Absolute URLs (resolved against the current page) so assets load correctly
// even under a GitHub Pages project subpath.
const asset = (name: string) => new URL(`${BASE}${name}`, location.href).href;
const WHEEL = "capacity_engine-0.1.0-py3-none-any.whl";

let bootPromise: Promise<any> | null = null;

async function fetchText(name: string): Promise<string> {
  const res = await fetch(asset(name));
  if (!res.ok) throw new Error(`failed to load ${name}: HTTP ${res.status}`);
  return res.text();
}

function boot(): Promise<any> {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const pyodide = await loadPyodide();
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install(asset(WHEEL));
    await pyodide.runPythonAsync(await fetchText("presenter.py"));
    pyodide.globals.get("load_org")(await fetchText("sample_org.json"));
    return pyodide;
  })().catch((err) => {
    // Don't leave a permanently-rejected promise — let a later call (e.g. after
    // a transient CDN/network failure) retry the boot from scratch.
    bootPromise = null;
    throw err;
  });
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
