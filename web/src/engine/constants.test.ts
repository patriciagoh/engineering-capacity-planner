import { describe, it, expect } from "vitest";
import { LEVELS, ONBOARD, TENURE, defaultOverhead, defaultKtlo } from "./constants";

describe("constants", () => {
  it("level multipliers match the locked contract", () => {
    expect(LEVELS).toEqual({ Intern: 0.7, L2: 1.0, L3: 1.0, Staff: 0.85, Principal: 0.7 });
  });
  it("onboarding multipliers match the locked contract", () => {
    expect(ONBOARD["New Hire: Month 1"]).toBe(0.25);
    expect(ONBOARD["Mentor: Month 3"]).toBe(0.95);
    expect(ONBOARD["Not Applicable"]).toBe(1.0);
  });
  it("tenure has five informational bands", () => {
    expect(TENURE).toHaveLength(5);
  });
  it("default overhead sums to 49%", () => {
    expect(defaultOverhead().reduce((s, f) => s + f.current, 0)).toBe(49);
  });
  it("default KTLO sums to 50% with five buckets", () => {
    const k = defaultKtlo();
    expect(k).toHaveLength(5);
    expect(k.reduce((s, f) => s + f.current, 0)).toBe(50);
  });
});
