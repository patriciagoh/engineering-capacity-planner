// Selects the data-layer implementation. Default: the in-browser Pyodide engine
// (works for the static build and local `npm run dev`, no server needed).
// Set VITE_API_MODE=http to use the FastAPI HTTP client instead.
import * as engine from "./engine";
import * as http from "./client";

const impl = import.meta.env.VITE_API_MODE === "http" ? http : engine;

export const getOrg = impl.getOrg;
export const getTeamPlan = impl.getTeamPlan;
export const getTeamRoster = impl.getTeamRoster;
export const getGroupRollup = impl.getGroupRollup;
export const postScenario = impl.postScenario;
export const ready: () => Promise<boolean> =
  "ready" in impl ? (impl as typeof engine).ready : () => Promise.resolve(true);
