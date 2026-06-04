import { describe, it, expect } from "vitest";
import { LocalPort } from "./localPort";
import { CUR } from "../data/seed";

describe("LocalPort", () => {
  it("load() returns the seeded state at the default team", async () => {
    const s = await new LocalPort().load();
    expect(s!.cur).toBe(CUR);
    expect(s!.teams).toHaveLength(6);
  });
  it("save() is a no-op that resolves", async () => {
    await expect(new LocalPort().save({ cur: 0, teams: [] })).resolves.toBeUndefined();
  });
});
