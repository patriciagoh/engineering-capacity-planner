import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { StoreProvider, useStore } from "./store";
import type { StoragePort, PersistedState } from "../storage/types";
import { makeSeedTeams } from "../data/seed";

function Editor() {
  const { state, dispatch } = useStore();
  return (
    <button onClick={() => dispatch({ type: "ADD_PROJECT", team: state.cur })}>add</button>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("autosave", () => {
  it("debounces save() after edits once ready", async () => {
    const saved: PersistedState[] = [];
    const port: StoragePort = {
      load: async () => ({ cur: 0, teams: makeSeedTeams() }),
      save: async (s) => { saved.push(s); },
    };
    render(<StoreProvider port={port}><Editor /></StoreProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // resolve load -> HYDRATE
    await act(async () => { await vi.advanceTimersByTimeAsync(600); }); // flush any initial ready-save
    const before = saved.length;
    await act(async () => {
      document.querySelector("button")!.click();
      document.querySelector("button")!.click();
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(saved.length).toBe(before + 1); // two rapid edits coalesce into ONE save
    expect(saved[saved.length - 1].teams[0].projects.length).toBeGreaterThan(0);
  });
});
