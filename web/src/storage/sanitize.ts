import type { Team, Engineer, Alloc } from "../engine/types";
import type { PersistedState } from "./types";
import { DOC_VERSION } from "./types";
import { newId } from "../engine/ids";

export { DOC_VERSION } from "./types";

export function serialize(state: PersistedState): unknown {
  return { version: DOC_VERSION, cur: state.cur, teams: state.teams };
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, v));
};

const VALID_ALLOCS: Alloc[] = [1, 0.75, 0.5, 0.25];
const coerceAlloc = (a: unknown): Alloc => {
  const n = typeof a === "number" ? a : 1;
  return VALID_ALLOCS.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), 1 as Alloc);
};

const normEngineer = (e: Engineer): Engineer => ({
  ...e,
  id: e.id || newId(),
  alloc: coerceAlloc(e.alloc),
});

const normTeam = (t: Team): Team => ({
  ...t,
  id: t.id || newId(),
  roster: t.roster.map(normEngineer),
  projects: t.projects.map((p) => ({ ...p, id: p.id || newId(), est: clamp(p.est, 0, Number.MAX_SAFE_INTEGER, 0), team: [...p.team] })),
  overhead: t.overhead.map((f) => ({ ...f, current: clamp(f.current, 0, 100, 0), ideal: clamp(f.ideal, 0, 100, 0) })),
  ktlo: t.ktlo.map((f) => ({ ...f, current: clamp(f.current, 0, 100, 0), ideal: clamp(f.ideal, 0, 100, 0) })),
});

function isRecognized(raw: unknown): raw is { version: number; cur: unknown; teams: Team[] } {
  return (
    typeof raw === "object" && raw !== null &&
    (raw as { version?: unknown }).version === DOC_VERSION &&
    Array.isArray((raw as { teams?: unknown }).teams)
  );
}

export function sanitize(raw: unknown): PersistedState | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecognized(raw)) {
    throw new Error("Unrecognized stored document; refusing to load (would risk overwriting data).");
  }
  const teams = raw.teams.map(normTeam);
  const cur = teams.length === 0 ? 0 : clamp(raw.cur, 0, teams.length - 1, 0);
  return { cur, teams };
}
