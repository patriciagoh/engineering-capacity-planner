import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthGate } from "./AuthGate";
import { FakeAuthPort } from "./fakeAuthPort";

const Protected = () => <div data-testid="protected">secret</div>;

describe("AuthGate", () => {
  it("shows Login when there is no session", async () => {
    render(<AuthGate port={new FakeAuthPort()}><Protected /></AuthGate>);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("renders children when a session already exists", async () => {
    const port = new FakeAuthPort({ userId: "u1", email: "a@b.co" });
    render(<AuthGate port={port}><Protected /></AuthGate>);
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("flips to the app when an auth change delivers a session", async () => {
    const port = new FakeAuthPort();
    render(<AuthGate port={port}><Protected /></AuthGate>);
    await screen.findByRole("button", { name: /sign in/i });
    act(() => port.push({ userId: "u1", email: "a@b.co" }));
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
  });

  it("returns to Login when the session is cleared (logout / expiry)", async () => {
    const port = new FakeAuthPort({ userId: "u1", email: "a@b.co" });
    render(<AuthGate port={port}><Protected /></AuthGate>);
    await screen.findByTestId("protected");
    act(() => port.push(null));
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("does not let a late getSession seed clobber an earlier auth-change event", async () => {
    let resolveGetSession: (s: { userId: string; email: string | null } | null) => void = () => {};
    let emit: (s: { userId: string; email: string | null } | null) => void = () => {};
    const port = {
      getSession: () => new Promise<{ userId: string; email: string | null } | null>((res) => { resolveGetSession = res; }),
      signIn: async () => ({ error: null }),
      signOut: async () => {},
      onAuthChange: (cb: (s: { userId: string; email: string | null } | null) => void) => { emit = cb; return () => {}; },
    };
    render(<AuthGate port={port}><Protected /></AuthGate>);
    // An authoritative event arrives BEFORE the initial getSession resolves:
    act(() => emit({ userId: "u1", email: "a@b.co" }));
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
    // The late getSession resolves with a STALE null snapshot — must NOT bounce to Login:
    await act(async () => { resolveGetSession(null); await Promise.resolve(); });
    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("unsubscribes from auth changes on unmount", async () => {
    const port = new FakeAuthPort();
    const unsub = vi.fn();
    vi.spyOn(port, "onAuthChange").mockReturnValue(unsub);
    const { unmount } = render(<AuthGate port={port}><Protected /></AuthGate>);
    await waitFor(() => expect(port.onAuthChange).toHaveBeenCalled());
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});
