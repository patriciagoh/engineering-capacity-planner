import { describe, it, expect } from "vitest";
import { createAuthPort } from "./createAuthPort";

describe("createAuthPort", () => {
  it("returns null when VITE_BACKEND is not 'supabase' (demo build = no auth)", () => {
    expect(createAuthPort()).toBeNull();
  });
});
