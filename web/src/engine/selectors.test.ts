import { describe, it, expect } from "vitest";
import { defaultOverhead, defaultKtlo } from "./constants";
import {
  weeksFor, effFTE, productive, grossPM, ktloFrac, netPM, demand, fit,
} from "./selectors";
import { personLoads } from "./selectors";
import type { Team } from "./types";

const aurora: Team = {
  name: "Aurora",
  window: "quarter",
  overhead: defaultOverhead(),
  ktlo: defaultKtlo(),
  roster: [
    { name: "Alex Rivera", tenure: "> 4 years", level: "L3", onboarding: "Mentor: Month 1", alloc: 1 },
    { name: "Sam Chen", tenure: "1–2 years", level: "L3", onboarding: "Mentor: Month 1", alloc: 1 },
    { name: "Jordan Lee", tenure: "> 4 years", level: "L3", onboarding: "Not Applicable", alloc: 1 },
    { name: "Priya Nair", tenure: "< 4 months", level: "L2", onboarding: "New Hire: Month 3", alloc: 1 },
    { name: "Diego Torres", tenure: "< 4 months", level: "Intern", onboarding: "New Hire: Month 1", alloc: 0.5 },
  ],
  projects: [
    { name: "Search revamp", est: 1.2, team: [0, 1] },
    { name: "Billing migration", est: 0.8, team: [2] },
    { name: "Onboarding tooling", est: 0.3, team: [3] },
  ],
};

describe("core selectors (Aurora fixture)", () => {
  it("weeksFor: 12 for quarter, 4.33 for month", () => {
    expect(weeksFor("quarter")).toBe(12);
    expect(weeksFor("month")).toBe(4.33);
  });
  it("effFTE sums alloc x level x onboarding", () => {
    expect(effFTE(aurora.roster)).toBeCloseTo(3.5375, 4);
  });
  it("productive is 1 - overhead fraction, floored at 0", () => {
    expect(productive(aurora.overhead)).toBeCloseTo(0.51, 5);
  });
  it("grossPM = effFTE x (weeks/4) x productive", () => {
    expect(grossPM(aurora)).toBeCloseTo(5.41238, 4);
  });
  it("ktloFrac sums reservations", () => {
    expect(ktloFrac(aurora.ktlo)).toBeCloseTo(0.5, 5);
  });
  it("netPM is the headline (~2.706)", () => {
    expect(netPM(aurora)).toBeCloseTo(2.706, 2);
  });
  it("demand sums project estimates", () => {
    expect(demand(aurora)).toBeCloseTo(2.3, 5);
  });
  it("fit = netPM - demand (~0.406 spare)", () => {
    expect(fit(aurora)).toBeCloseTo(0.406, 2);
  });
  it("productive floors at 0 when overhead exceeds 100", () => {
    const t = { ...aurora, overhead: aurora.overhead.map((f) => ({ ...f, current: 20 })) };
    expect(productive(t.overhead)).toBe(0);
    expect(grossPM(t)).toBe(0);
  });
});

describe("personLoads", () => {
  it("splits each project's estimate evenly across assigned members and flags >100%", () => {
    const loads = personLoads(aurora);
    expect(loads).toHaveLength(aurora.roster.length);
    // Alex (idx 0) is on Search revamp (1.2 over 2 = 0.6pm). Load = 0.6 / personNet * 100.
    expect(loads[0].assignedPM).toBeCloseTo(0.6, 5);
    expect(loads[0].pct).toBeGreaterThan(0);
    expect(loads[0]).toHaveProperty("over");
  });
  it("an engineer on nothing has 0 load", () => {
    const t = { ...aurora, projects: [] };
    expect(personLoads(t).every((l) => l.assignedPM === 0 && l.pct === 0)).toBe(true);
  });
  it("personNet of 0 yields pct 0 (no divide-by-zero)", () => {
    const t = { ...aurora, overhead: aurora.overhead.map((f) => ({ ...f, current: 50 })) };
    expect(personLoads(t).every((l) => Number.isFinite(l.pct))).toBe(true);
  });
});

import { rollup, pmVerdict } from "./selectors";

describe("rollup and pmVerdict", () => {
  const teams = [aurora, { ...aurora, name: "B", projects: [{ name: "X", est: 99, team: [0] }] }];

  it("rollup returns per-team fit and group net = sum of fits", () => {
    const r = rollup(teams);
    expect(r.teams).toHaveLength(2);
    expect(r.groupNet).toBeCloseTo(fit(teams[0]) + fit(teams[1]), 5);
    expect(r.teams[0].status).toBe("ok");      // Aurora spare
    expect(r.teams[1].status).toBe("over");     // B oversubscribed
  });

  it("pmVerdict: lands when est <= spare, with leftover", () => {
    const v = pmVerdict(aurora, 0.2);
    expect(v.lands).toBe(true);
    expect(v.leftover).toBeCloseTo(fit(aurora) - 0.2, 5);
  });

  it("pmVerdict: short by est - spare when it does not fit", () => {
    const v = pmVerdict(aurora, 5);
    expect(v.lands).toBe(false);
    expect(v.gap).toBeCloseTo(5 - fit(aurora), 5);
  });
});
