import { describe, it, expect } from "vitest";
import { SupabasePort } from "./supabasePort";
import { FakeRowStore } from "./fakeRowStore";
import { serialize } from "./sanitize";
import { makeSeedTeams } from "../data/seed";

describe("SupabasePort", () => {
  it("load() returns null for a brand-new (empty) row store", async () => {
    expect(await new SupabasePort(new FakeRowStore(null)).load()).toBeNull();
  });

  it("save() then load() round-trips through the row store", async () => {
    const rows = new FakeRowStore(null);
    const port = new SupabasePort(rows);
    await port.save({ cur: 1, teams: makeSeedTeams() });
    const out = await port.load();
    expect(out!.cur).toBe(1);
    expect(out!.teams).toHaveLength(6);
    expect((rows.peek() as { version: number }).version).toBe(1);
  });

  it("load() throws on an unrecognized stored row", async () => {
    await expect(new SupabasePort(new FakeRowStore({ junk: true })).load()).rejects.toThrow();
  });

  it("load() reads a pre-seeded valid row", async () => {
    const rows = new FakeRowStore(serialize({ cur: 0, teams: [] }));
    expect(await new SupabasePort(rows).load()).toEqual({ cur: 0, teams: [] });
  });
});
