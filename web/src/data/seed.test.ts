import { describe, it, expect } from "vitest";
import { makeSeedTeams, CUR } from "./seed";
import { netPM, fit } from "../engine/selectors";

describe("seed org", () => {
  it("seeds six teams with Aurora open by default", () => {
    const teams = makeSeedTeams();
    expect(teams.map((t) => t.name)).toEqual(["Payments", "Growth", "Aurora", "Mobile", "Data", "Identity"]);
    expect(CUR).toBe(2);
    expect(teams[CUR].name).toBe("Aurora");
  });
  it("Aurora's net capacity matches the prototype headline (~2.7)", () => {
    expect(netPM(makeSeedTeams()[2])).toBeCloseTo(2.706, 2);
    expect(fit(makeSeedTeams()[2])).toBeCloseTo(0.406, 2);
  });
  it("makeSeedTeams returns fresh copies (no shared mutation)", () => {
    const a = makeSeedTeams();
    a[2].roster[0].name = "MUTATED";
    expect(makeSeedTeams()[2].roster[0].name).not.toBe("MUTATED");
  });
  it("assigns a unique id to every team, engineer, and project", () => {
    const teams = makeSeedTeams();
    const ids = [
      ...teams.map((t) => t.id),
      ...teams.flatMap((t) => t.roster.map((e) => e.id)),
      ...teams.flatMap((t) => t.projects.map((p) => p.id)),
    ];
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every project assignment references an engineer in its own team's roster", () => {
    for (const t of makeSeedTeams()) {
      const rosterIds = new Set(t.roster.map((e) => e.id));
      for (const p of t.projects) {
        for (const id of p.team) {
          expect(rosterIds.has(id)).toBe(true);
        }
      }
    }
  });
});
