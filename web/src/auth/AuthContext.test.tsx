import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const auth = useAuth();
  return <div data-testid="probe">{auth ? auth.session.email : "none"}</div>;
}

describe("useAuth", () => {
  it("returns null when there is no provider (demo build)", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("none");
  });
  it("returns the provided value inside AuthProvider", () => {
    render(
      <AuthProvider value={{ session: { userId: "u1", email: "a@b.co" }, signOut: () => {} }}>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("a@b.co");
  });
});
