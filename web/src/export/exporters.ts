import type { Team } from "../engine/types";
import { effFTE, engEff, grossPM, ktloFrac, netPM, demand, fit } from "../engine/selectors";

const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
const round = (n: number, d = 2) => Number(n.toFixed(d));

export function results(t: Team) {
  return {
    effFTE: round(effFTE(t.roster)),
    grossPM: round(grossPM(t)),
    ktloPct: Math.round(ktloFrac(t.ktlo) * 100),
    netPM: round(netPM(t)),
    demand: round(demand(t)),
    fit: round(fit(t)),
  };
}

export function toCSV(t: Team): string {
  const L: string[] = [];
  L.push(`${t.name} — capacity export`, "");
  L.push(["Engineer", "Tenure", "Level", "Onboarding", "Alloc", "Eff FTE"].map(q).join(","));
  t.roster.forEach((e) =>
    L.push([e.name, e.tenure, e.level, e.onboarding, e.alloc, round(engEff(e))].map(q).join(",")),
  );
  L.push("", ["Project", "Estimate (pm)"].map(q).join(","));
  t.projects.forEach((p) => L.push([p.name, p.est].map(q).join(",")));
  L.push("", ["Summary", "Value"].map(q).join(","));
  const r = results(t);
  ([
    ["Effective FTE", r.effFTE], ["Person-months available", r.grossPM],
    ["Reserved KTLO %", r.ktloPct], ["Net capacity (pm)", r.netPM],
    ["Committed to projects (pm)", r.demand], ["Spare (pm)", r.fit],
  ] as [string, number][]).forEach(([k, v]) => L.push([k, v].map(q).join(",")));
  return L.join("\n");
}

export function toJSON(t: Team): string {
  return JSON.stringify(
    {
      team: t.name, window: t.window,
      roster: t.roster.map((e) => ({ ...e, effFTE: round(engEff(e), 3) })),
      overhead: t.overhead, ktlo: t.ktlo, projects: t.projects, results: results(t),
    },
    null, 2,
  );
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const printPlan = () => window.print();
