import type { Engineer, OverheadFactor, KtloFactor, Team, Window } from "./types";
import { LEVELS, ONBOARD } from "./constants";

export const weeksFor = (w: Window): number => (w === "month" ? 4.33 : 12);

export const engEff = (e: Engineer): number =>
  e.alloc * LEVELS[e.level] * ONBOARD[e.onboarding];

export const effFTE = (roster: Engineer[]): number =>
  roster.reduce((s, e) => s + engEff(e), 0);

export const productive = (overhead: OverheadFactor[]): number =>
  Math.max(0, 1 - overhead.reduce((s, f) => s + f.current, 0) / 100);

export const grossPM = (t: Team): number =>
  effFTE(t.roster) * (weeksFor(t.window) / 4) * productive(t.overhead);

export const ktloFrac = (ktlo: KtloFactor[]): number =>
  ktlo.reduce((s, f) => s + f.current, 0) / 100;

export const netPM = (t: Team): number => grossPM(t) * (1 - ktloFrac(t.ktlo));

export const demand = (t: Team): number =>
  t.projects.reduce((s, p) => s + (Number(p.est) || 0), 0);

export const fit = (t: Team): number => netPM(t) - demand(t);

export const headcount = (roster: Engineer[]): number =>
  roster.reduce((s, e) => s + e.alloc, 0);
