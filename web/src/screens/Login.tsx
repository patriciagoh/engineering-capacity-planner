import { useState, type FormEvent } from "react";
import type { AuthPort } from "../auth/types";

export function Login({ port }: { port: AuthPort }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await port.signIn(email, password);
      if (result.error) setError(result.error);
      // On success, AuthGate's onAuthChange subscription flips the gate to the app.
    } catch {
      setError("Invalid email or password");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-[420px] px-6 py-16">
      <form onSubmit={onSubmit} className="bg-paper border border-line rounded-xl p-6 shadow-[var(--shadow-hairline)]">
        <h1 className="font-serif text-2xl text-ink">Capacity Planner</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your team’s plan.</p>

        <label htmlFor="login-email" className="block mt-5 font-mono text-xs text-muted">Email</label>
        <input
          id="login-email" type="email" autoComplete="username" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full border border-line-2 rounded-lg px-3 py-2 bg-paper text-ink"
        />

        <label htmlFor="login-password" className="block mt-4 font-mono text-xs text-muted">Password</label>
        <input
          id="login-password" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full border border-line-2 rounded-lg px-3 py-2 bg-paper text-ink"
        />

        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}

        <button
          type="submit" disabled={pending}
          className="mt-5 w-full rounded-pill bg-matcha-deep text-paper px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-xs text-muted">Accounts are created by your administrator.</p>
      </form>
    </div>
  );
}
