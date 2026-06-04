import { describe, it, expect, vi } from "vitest";
import { screen, render, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreProvider, useStore } from "../state/store";
import type { StoragePort } from "../storage/types";
import { makeSeedTeams } from "../data/seed";
import { ViewSwitcher } from "./ViewSwitcher";
import { TopBar } from "./TopBar";
import { renderSeeded } from "../test/renderSeeded";
import { AuthProvider } from "../auth/AuthContext";

function ViewProbe() {
  const { state } = useStore();
  return <span data-testid="view">{state.view}</span>;
}

describe("ViewSwitcher", () => {
  it("switches the active view via the store", async () => {
    await renderSeeded(<><ViewSwitcher /><ViewProbe /></>);
    expect(screen.getByTestId("view")).toHaveTextContent("manager");
    await userEvent.click(screen.getByRole("button", { name: /director/i }));
    expect(screen.getByTestId("view")).toHaveTextContent("director");
  });
});

describe("TopBar save-error indicator", () => {
  it("shows a non-blocking save-error indicator when a save fails", async () => {
    vi.useFakeTimers();
    try {
      const port: StoragePort = {
        load: async () => ({ cur: 0, teams: makeSeedTeams() }),
        save: async () => { throw new Error("network"); },
      };
      function Harness() {
        const { state, dispatch } = useStore();
        if (state.status !== "ready") return null;
        return (
          <>
            <TopBar />
            <button onClick={() => dispatch({ type: "ADD_PROJECT", team: state.cur })}>edit</button>
          </>
        );
      }
      const { getByText, queryByText } = render(<StoreProvider port={port}><Harness /></StoreProvider>);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // hydrate
      await act(async () => { await vi.advanceTimersByTimeAsync(600); }); // flush initial save attempt(s)
      await act(async () => {
        getByText("edit").click();
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(queryByText(/couldn’t save/i)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

it("shows the signed-in email and a working Sign out when authenticated", async () => {
  const signOut = vi.fn();
  await renderSeeded(
    <AuthProvider value={{ session: { userId: "u1", email: "me@example.com" }, signOut }}>
      <TopBar />
    </AuthProvider>,
  );
  expect(screen.getByText("me@example.com")).toBeInTheDocument();
  const btn = screen.getByRole("button", { name: /sign out/i });
  btn.click();
  expect(signOut).toHaveBeenCalled();
});
