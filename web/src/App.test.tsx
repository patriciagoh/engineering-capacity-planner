import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StoreProvider } from "./state/store";
import { Shell } from "./App";
import type { StoragePort } from "./storage/types";
import { makeSeedTeams } from "./data/seed";

const port = (load: StoragePort["load"]): StoragePort => ({ load, save: async () => {} });

describe("App shell states", () => {
  it("shows loading then the app for a seeded ready state", async () => {
    render(<StoreProvider port={port(async () => ({ cur: 2, teams: makeSeedTeams() }))}><Shell /></StoreProvider>);
    expect(screen.getByTestId("app-loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Aurora")).toBeInTheDocument());
  });

  it("shows the empty state when ready with zero teams", async () => {
    render(<StoreProvider port={port(async () => null)}><Shell /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId("app-empty")).toBeInTheDocument());
    expect(screen.getByText(/no teams yet/i)).toBeInTheDocument();
  });

  it("shows the load-error state when load fails", async () => {
    render(<StoreProvider port={port(async () => { throw new Error("x"); })}><Shell /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId("app-error")).toBeInTheDocument());
  });
});
