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

export interface PersonLoad {
  name: string;
  assignedPM: number;
  personNet: number;
  pct: number;
  over: boolean;
}

export const personNet = (e: Engineer, t: Team): number =>
  engEff(e) * (weeksFor(t.window) / 4) * productive(t.overhead) * (1 - ktloFrac(t.ktlo));

export const personLoads = (t: Team): PersonLoad[] =>
  t.roster.map((e, i) => {
    const assignedPM = t.projects.reduce(
      (s, p) => s + (p.team.includes(i) ? p.est / p.team.length : 0),
      0,
    );
    const pNet = personNet(e, t);
    const pct = pNet > 0 ? (assignedPM / pNet) * 100 : 0;
    return { name: e.name, assignedPM, personNet: pNet, pct, over: pct > 100 };
  });

export type FitStatus = "ok" | "tight" | "over";

export interface TeamFit {
  name: string;
  supply: number;   // netPM
  demand: number;
  fit: number;
  status: FitStatus;
}

export const teamFit = (t: Team): TeamFit => {
  const supply = netPM(t);
  const d = demand(t);
  const f = supply - d;
  const status: FitStatus = f < 0 ? "over" : f < supply * 0.1 ? "tight" : "ok";
  return { name: t.name, supply, demand: d, fit: f, status };
};

export const rollup = (teams: Team[]): { teams: TeamFit[]; groupNet: number } => {
  const fits = teams.map(teamFit);
  return { teams: fits, groupNet: fits.reduce((s, x) => s + x.fit, 0) };
};

export interface PmVerdict {
  lands: boolean;
  spare: number;
  leftover: number; // when lands
  gap: number;      // when short
}

export const pmVerdict = (t: Team, est: number): PmVerdict => {
  const spare = fit(t);
  const lands = est <= spare;
  return { lands, spare, leftover: lands ? spare - est : 0, gap: lands ? 0 : est - spare };
};
