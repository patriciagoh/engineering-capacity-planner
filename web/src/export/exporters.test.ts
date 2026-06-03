import { describe, it, expect } from "vitest";
import { makeSeedTeams } from "../data/seed";
import { toCSV, toJSON } from "./exporters";

const aurora = makeSeedTeams()[2];

describe("exporters", () => {
  it("toCSV includes roster, projects, and a summary section", () => {
    const csv = toCSV(aurora);
    expect(csv).toContain("Aurora");
    expect(csv).toContain("Alex Rivera");
    expect(csv).toContain("Search revamp");
    expect(csv).toContain("Net capacity");
  });
  it("toCSV escapes embedded quotes", () => {
    const t = { ...aurora, projects: [{ name: 'A "quoted" name', est: 1, team: [] }] };
    expect(toCSV(t)).toContain('"A ""quoted"" name"');
  });
  it("toJSON is the loss-less save shape and round-trips", () => {
    const json = toJSON(aurora);
    const parsed = JSON.parse(json);
    expect(parsed.team).toBe("Aurora");
    expect(parsed.window).toBe("quarter");
    expect(parsed.roster).toHaveLength(5);
    expect(parsed.results.netPM).toBeCloseTo(2.706, 2);
  });
});
