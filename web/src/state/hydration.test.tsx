import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StoreProvider, useStore } from "./store";
import type { StoragePort, PersistedState } from "../storage/types";

function Probe() {
  const { state } = useStore();
  return <div data-testid="probe">{state.status}:{state.teams.length}</div>;
}

const portWith = (load: () => Promise<PersistedState | null>): StoragePort => ({
  load, save: async () => {},
});

describe("StoreProvider hydration", () => {
  it("goes loading -> ready and adopts loaded teams", async () => {
    const port = portWith(async () => ({ cur: 0, teams: [] }));
    render(<StoreProvider port={port}><Probe /></StoreProvider>);
    expect(screen.getByTestId("probe").textContent).toBe("loading:0");
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("ready:0"));
  });

  it("goes loading -> error when load rejects", async () => {
    const port = portWith(async () => { throw new Error("bad blob"); });
    render(<StoreProvider port={port}><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("error:0"));
  });

  it("treats a null load as an empty-but-ready document", async () => {
    const port = portWith(async () => null);
    render(<StoreProvider port={port}><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("ready:0"));
  });
});
