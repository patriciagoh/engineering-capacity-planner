import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    port.push({ userId: "u1", email: "a@b.co" });
    expect(await screen.findByTestId("protected")).toBeInTheDocument();
  });

  it("returns to Login when the session is cleared (logout / expiry)", async () => {
    const port = new FakeAuthPort({ userId: "u1", email: "a@b.co" });
    render(<AuthGate port={port}><Protected /></AuthGate>);
    await screen.findByTestId("protected");
    port.push(null);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
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
