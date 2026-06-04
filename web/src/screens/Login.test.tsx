import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "./Login";
import { FakeAuthPort } from "../auth/fakeAuthPort";

describe("Login", () => {
  it("renders email + password and no sign-up/reset links", () => {
    render(<Login port={new FakeAuthPort()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot|reset password/i)).not.toBeInTheDocument();
  });

  it("submitting calls signIn with the entered credentials", async () => {
    const port = new FakeAuthPort();
    const spy = vi.spyOn(port, "signIn");
    render(<Login port={port} />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.co");
    await userEvent.type(screen.getByLabelText(/password/i), "pw123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith("a@b.co", "pw123"));
  });

  it("shows a generic error and re-enables the form on failure", async () => {
    const port = new FakeAuthPort();
    port.failWith = "Invalid email or password";
    render(<Login port={port} />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.co");
    await userEvent.type(screen.getByLabelText(/password/i), "bad");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email or password/i);
    expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled();
  });
});
