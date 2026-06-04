import { describe, it, expect } from "vitest";
import { createStoragePort } from "./createStoragePort";
import { LocalPort } from "./localPort";

describe("createStoragePort", () => {
  it("returns a LocalPort when VITE_BACKEND is not 'supabase'", () => {
    // default test env has no VITE_BACKEND set
    expect(createStoragePort()).toBeInstanceOf(LocalPort);
  });
});
