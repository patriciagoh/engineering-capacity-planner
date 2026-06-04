import { describe, it, expect } from "vitest";
import { FakeAuthPort } from "./fakeAuthPort";

describe("FakeAuthPort", () => {
  it("getSession returns the initial session (null by default)", async () => {
    expect(await new FakeAuthPort().getSession()).toBeNull();
    const seeded = new FakeAuthPort({ userId: "u1", email: "a@b.co" });
    expect(await seeded.getSession()).toEqual({ userId: "u1", email: "a@b.co" });
  });

  it("signIn succeeds, sets the session, and notifies listeners", async () => {
    const port = new FakeAuthPort();
    const seen: (unknown)[] = [];
    port.onAuthChange((s) => seen.push(s));
    const r = await port.signIn("a@b.co", "pw");
    expect(r).toEqual({ error: null });
    expect(await port.getSession()).toMatchObject({ email: "a@b.co" });
    expect(seen.at(-1)).toMatchObject({ email: "a@b.co" });
  });

  it("signIn fails with the configured message and does not set a session", async () => {
    const port = new FakeAuthPort();
    port.failWith = "Invalid email or password";
    const r = await port.signIn("a@b.co", "bad");
    expect(r).toEqual({ error: "Invalid email or password" });
    expect(await port.getSession()).toBeNull();
  });

  it("signOut clears the session and notifies", async () => {
    const port = new FakeAuthPort({ userId: "u1", email: "a@b.co" });
    const seen: (unknown)[] = [];
    port.onAuthChange((s) => seen.push(s));
    await port.signOut();
    expect(await port.getSession()).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it("push emits an external auth change; unsubscribe stops delivery", async () => {
    const port = new FakeAuthPort();
    const seen: (unknown)[] = [];
    const unsub = port.onAuthChange((s) => seen.push(s));
    port.push({ userId: "u2", email: "c@d.co" });
    expect(seen.at(-1)).toMatchObject({ email: "c@d.co" });
    unsub();
    port.push(null);
    expect(seen).toHaveLength(1);
  });
});
