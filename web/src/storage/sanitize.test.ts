import { describe, it, expect } from "vitest";
import { sanitize, serialize, DOC_VERSION } from "./sanitize";
import { makeSeedTeams } from "../data/seed";

describe("serialize", () => {
  it("wraps state with the doc version", () => {
    const doc = serialize({ cur: 1, teams: makeSeedTeams() });
    expect(doc).toMatchObject({ version: DOC_VERSION, cur: 1 });
    expect(Array.isArray((doc as { teams: unknown[] }).teams)).toBe(true);
  });
});

describe("sanitize", () => {
  it("returns null for a null row (brand-new user)", () => {
    expect(sanitize(null)).toBeNull();
  });

  it("round-trips a serialized document", () => {
    const state = { cur: 2, teams: makeSeedTeams() };
    const result = sanitize(serialize(state));
    expect(result!.cur).toBe(2);
    expect(result!.teams).toHaveLength(6);
  });

  it("clamps cur into range and to 0 when teams is empty", () => {
    expect(sanitize({ version: 1, cur: 99, teams: makeSeedTeams() })!.cur).toBe(5);
    expect(sanitize({ version: 1, cur: -3, teams: makeSeedTeams() })!.cur).toBe(0);
    expect(sanitize({ version: 1, cur: 4, teams: [] })!.cur).toBe(0);
  });

  it("accepts an empty teams array", () => {
    expect(sanitize({ version: 1, cur: 0, teams: [] })).toEqual({ cur: 0, teams: [] });
  });

  it("coerces/clamps invalid numeric fields", () => {
    const t = makeSeedTeams()[0];
    const dirty = {
      version: 1, cur: 0,
      teams: [{
        ...t,
        roster: [{ ...t.roster[0], alloc: 3 }],            // invalid alloc -> nearest valid (1)
        projects: [{ ...t.projects[0], est: -5, team: [] }], // negative est -> 0
        overhead: [{ key: "x", desc: "x", current: 250, ideal: -10 }], // clamp 0..100
      }],
    };
    const out = sanitize(dirty)!;
    expect(out.teams[0].roster[0].alloc).toBe(1);
    expect(out.teams[0].projects[0].est).toBe(0);
    expect(out.teams[0].overhead[0].current).toBe(100);
    expect(out.teams[0].overhead[0].ideal).toBe(0);
  });

  it("backfills a missing engineer id", () => {
    const t = makeSeedTeams()[0];
    const noId = { ...t, roster: [{ ...t.roster[0], id: undefined as unknown as string }] };
    const out = sanitize({ version: 1, cur: 0, teams: [noId] })!;
    expect(typeof out.teams[0].roster[0].id).toBe("string");
    expect(out.teams[0].roster[0].id.length).toBeGreaterThan(0);
  });

  it("throws on a non-null but unrecognized blob (never silently overwrite)", () => {
    expect(() => sanitize({ hello: "world" })).toThrow();
    expect(() => sanitize({ version: 2, cur: 0, teams: [] })).toThrow();
    expect(() => sanitize("garbage")).toThrow();
    expect(() => sanitize(42)).toThrow();
  });
});
