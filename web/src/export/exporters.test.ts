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
  it("toCSV neutralizes spreadsheet formula triggers in user text", () => {
    const t = {
      ...aurora,
      projects: [
        { name: '=HYPERLINK("https://evil.example")', est: 1, team: [] },
        { name: "+1+2", est: 1, team: [] },
        { name: "-cmd", est: 1, team: [] },
        { name: "@SUM(A1)", est: 1, team: [] },
      ],
    };
    const csv = toCSV(t);
    expect(csv).toContain('"\'=HYPERLINK(""https://evil.example"")"');
    expect(csv).toContain('"\'+1+2"');
    expect(csv).toContain('"\'-cmd"');
    expect(csv).toContain('"\'@SUM(A1)"');
  });
  it("toCSV does not mangle legitimate negative numeric cells", () => {
    const t = { ...aurora, projects: [{ name: "Refund", est: -3, team: [] }] };
    const csv = toCSV(t);
    expect(csv).toContain('"-3"');
    expect(csv).not.toContain('"\'-3"');
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
