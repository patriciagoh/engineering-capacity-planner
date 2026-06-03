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
});
