import { describe, it, expect } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("returns a unique non-empty string each call", () => {
    const a = newId();
    const b = newId();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
