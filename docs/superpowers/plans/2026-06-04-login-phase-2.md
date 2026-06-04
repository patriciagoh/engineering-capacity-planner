# Login (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the real (supabase) app behind email + password login with no public sign-up; the demo (local) build stays completely login-free.

**Architecture:** An `AuthPort` seam (mirrors the Phase 1 `StoragePort`) over the shared Supabase client, fronted by an `AuthGate` that sits ABOVE the Phase 1 data load — no session → Login; session → mount `StoreProvider` (which then loads cloud data). `onAuthChange` is authoritative for login/logout/expiry. A `createAuthPort()` factory returns `null` in the local build (no auth, no SDK) and a deferred, dynamic-imported adapter in the supabase build.

**Tech Stack:** React 19, TypeScript, Vite 5, Vitest 2 (+ happy-dom for component tests), `@supabase/supabase-js` auth.

**Spec:** `docs/superpowers/specs/2026-06-04-login-phase-2-design.md`

**Branch:** `phase-2-login` (already created off `main`).

**Repo conventions (carried from Phase 1):**
- Colocated tests; default Vitest env is happy-dom-capable (jsdom-style) — component tests work without an env pragma (Phase 1 established this). Pure tests are fine too.
- tsconfig has `erasableSyntaxOnly` (NO `private x` parameter-properties — use explicit field assignment) and `noUnusedParameters`/`noUnusedLocals` (NO underscore-ignore — for a deliberately-unused param write `void param;`).
- Token discipline: components/screens may use ONLY token utility classes (no raw hex / font literals); `lint:tokens` checks `src/components/**` + `src/screens/**`. Before using a color/utility class, confirm it already appears in existing components (e.g. `grep -rn "text-muted\|matcha-deep\|text-ink\|border-line" src`). For an error/danger color, reuse whatever the existing "over capacity" UI uses (inspect `src/components/FitBar.tsx` / `LoadBar.tsx`).
- The shared Supabase client is `src/storage/client.ts` → `getClient()` (lazy, dynamic-imports the SDK).
- Green gate: `npm run typecheck && npm run lint && npm run lint:tokens && npm test`. Build gate where noted: `npm run build`.
- `import.meta.env.VITE_BACKEND` is `undefined` in the test env → `createAuthPort()` returns `null` there.

---

## File Structure

New:
- `src/auth/types.ts` — `AuthSession`, `AuthPort`.
- `src/auth/fakeAuthPort.ts` — in-memory `AuthPort` for tests.
- `src/auth/supabaseAuthAdapter.ts` — `SupabaseAuthAdapter` + `createSupabaseAuthPort()` (the thin network binding).
- `src/auth/createAuthPort.ts` — factory: `null` in local, deferred dynamic-import in supabase.
- `src/auth/AuthContext.tsx` — `AuthProvider` + `useAuth()` (returns `{ session, signOut } | null`).
- `src/auth/AuthGate.tsx` — checking / unauthenticated / authenticated gate.
- `src/screens/Login.tsx` — branded login form.
- Tests: `fakeAuthPort.test.ts`, `createAuthPort.test.ts`, `AuthContext.test.tsx`, `AuthGate.test.tsx`, `Login.test.tsx`.

Changed:
- `src/App.tsx` — wrap the data app in `<AuthGate>` when `createAuthPort()` is non-null.
- `src/components/TopBar.tsx` — optional email + Sign out via `useAuth()`.
- `README.md` — short "Authentication" note (dashboard-managed accounts + password reset).

---

## Task 1: `AuthPort` types + `FakeAuthPort`

**Files:** Create `src/auth/types.ts`, `src/auth/fakeAuthPort.ts`, `src/auth/fakeAuthPort.test.ts`

- [ ] **Step 1: Define the seam types** — `src/auth/types.ts`:
```ts
export type AuthSession = { userId: string; email: string | null };

export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  // Subscribe to auth changes; returns an unsubscribe function.
  onAuthChange(cb: (session: AuthSession | null) => void): () => void;
}
```

- [ ] **Step 2: Write the failing test** — `src/auth/fakeAuthPort.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { FakeAuthPort } from "./fakeAuthPort";

describe("FakeAuthPort", () => {
  it("getSession returns the initial session (null by default)", async () => {
    expect(await new FakeAuthPort().getSession()).toBeNull();
    const seeded = new FakeAuthPort({ userId: "u1", email: "a@b.co" });
    expect(await seeded.getSession()).toEqual({ userId: "u1", email: "a@b.co" });
  });

  it("signIn succeeds, sets the session, and notifies listeners", async () => {
    const port = new FakeAuthPort();
    const seen: (unknown)[] = [];
    port.onAuthChange((s) => seen.push(s));
    const r = await port.signIn("a@b.co", "pw");
    expect(r).toEqual({ error: null });
    expect(await port.getSession()).toMatchObject({ email: "a@b.co" });
    expect(seen.at(-1)).toMatchObject({ email: "a@b.co" });
  });

  it("signIn fails with the configured message and does not set a session", async () => {
    const port = new FakeAuthPort();
    port.failWith = "Invalid email or password";
    const r = await port.signIn("a@b.co", "bad");
    expect(r).toEqual({ error: "Invalid email or password" });
    expect(await port.getSession()).toBeNull();
  });

  it("signOut clears the session and notifies", async () => {
    const port = new FakeAuthPort({ userId: "u1", email: "a@b.co" });
    const seen: (unknown)[] = [];
    port.onAuthChange((s) => seen.push(s));
    await port.signOut();
    expect(await port.getSession()).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it("push emits an external auth change; unsubscribe stops delivery", async () => {
    const port = new FakeAuthPort();
    const seen: (unknown)[] = [];
    const unsub = port.onAuthChange((s) => seen.push(s));
    port.push({ userId: "u2", email: "c@d.co" });
    expect(seen.at(-1)).toMatchObject({ email: "c@d.co" });
    unsub();
    port.push(null);
    expect(seen).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** — `npx vitest run src/auth/fakeAuthPort.test.ts`

- [ ] **Step 4: Implement** — `src/auth/fakeAuthPort.ts`:
```ts
import type { AuthPort, AuthSession } from "./types";

// In-memory AuthPort for tests. Configure `failWith` to make signIn fail.
export class FakeAuthPort implements AuthPort {
  private session: AuthSession | null;
  private listeners = new Set<(s: AuthSession | null) => void>();
  failWith: string | null = null;

  constructor(initial: AuthSession | null = null) {
    this.session = initial;
  }
  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }
  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    void password;
    if (this.failWith) return { error: this.failWith };
    this.session = { userId: "user-1", email };
    this.emit();
    return { error: null };
  }
  async signOut(): Promise<void> {
    this.session = null;
    this.emit();
  }
  onAuthChange(cb: (s: AuthSession | null) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }
  // test-only: simulate an external auth change (expiry / other tab)
  push(session: AuthSession | null): void {
    this.session = session;
    this.emit();
  }
  private emit(): void {
    this.listeners.forEach((l) => l(this.session));
  }
}
```

- [ ] **Step 5: Run it, expect PASS.**

- [ ] **Step 6: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(auth): AuthPort seam types + in-memory FakeAuthPort"
```

---

## Task 2: `SupabaseAuthAdapter` + `createAuthPort` factory

**Files:** Create `src/auth/supabaseAuthAdapter.ts`, `src/auth/createAuthPort.ts`, `src/auth/createAuthPort.test.ts`

- [ ] **Step 1: Failing test** — `src/auth/createAuthPort.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createAuthPort } from "./createAuthPort";

describe("createAuthPort", () => {
  it("returns null when VITE_BACKEND is not 'supabase' (demo build = no auth)", () => {
    expect(createAuthPort()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx vitest run src/auth/createAuthPort.test.ts`

- [ ] **Step 3: Implement the adapter** — `src/auth/supabaseAuthAdapter.ts`:
```ts
import type { AuthPort, AuthSession } from "./types";
import { getClient } from "../storage/client";

type RawUser = { id: string; email?: string | null } | undefined;
type RawSession = { user?: RawUser } | null;

function toSession(s: RawSession): AuthSession | null {
  if (!s?.user) return null;
  return { userId: s.user.id, email: s.user.email ?? null };
}

// Thin network binding over supabase.auth. Logic lives in AuthGate/AuthPort;
// this is not unit-tested (same convention as SupabaseRowStore).
class SupabaseAuthAdapter implements AuthPort {
  async getSession(): Promise<AuthSession | null> {
    const c = await getClient();
    const { data } = await c.auth.getSession();
    return toSession(data.session as RawSession);
  }
  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const c = await getClient();
    const { error } = await c.auth.signInWithPassword({ email, password });
    return { error: error ? "Invalid email or password" : null };
  }
  async signOut(): Promise<void> {
    const c = await getClient();
    await c.auth.signOut();
  }
  onAuthChange(cb: (s: AuthSession | null) => void): () => void {
    let unsub = () => {};
    let cancelled = false;
    getClient().then((c) => {
      if (cancelled) return;
      const { data } = c.auth.onAuthStateChange((_event, session) => cb(toSession(session as RawSession)));
      unsub = () => data.subscription.unsubscribe();
    });
    return () => { cancelled = true; unsub(); };
  }
}

export function createSupabaseAuthPort(): AuthPort {
  return new SupabaseAuthAdapter();
}
```

- [ ] **Step 4: Implement the factory** — `src/auth/createAuthPort.ts`:
```ts
import type { AuthPort } from "./types";

export function createAuthPort(): AuthPort | null {
  if (import.meta.env.VITE_BACKEND !== "supabase") return null; // demo build: no auth
  return makeDeferredAuthPort();
}

// Dynamic-imports the adapter (and thus the SDK) only when first used, so the
// demo bundle ships no Supabase auth code.
function makeDeferredAuthPort(): AuthPort {
  let portP: Promise<AuthPort> | null = null;
  const get = () => (portP ??= import("./supabaseAuthAdapter").then((m) => m.createSupabaseAuthPort()));
  return {
    getSession: () => get().then((p) => p.getSession()),
    signIn: (email, password) => get().then((p) => p.signIn(email, password)),
    signOut: () => get().then((p) => p.signOut()),
    onAuthChange: (cb) => {
      let unsub = () => {};
      let cancelled = false;
      get().then((p) => { if (!cancelled) unsub = p.onAuthChange(cb); });
      return () => { cancelled = true; unsub(); };
    },
  };
}
```

- [ ] **Step 5: Run it, expect PASS** — `npx vitest run src/auth/createAuthPort.test.ts`

- [ ] **Step 6: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(auth): SupabaseAuthAdapter + createAuthPort factory (deferred dynamic import)"
```

---

## Task 3: `AuthContext` (`AuthProvider` + `useAuth`)

**Files:** Create `src/auth/AuthContext.tsx`, `src/auth/AuthContext.test.tsx`

- [ ] **Step 1: Failing test** — `src/auth/AuthContext.test.tsx`:
```tsx
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
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement** — `src/auth/AuthContext.tsx`:
```tsx
/* eslint-disable react-refresh/only-export-components --
   Co-locates the context, provider, and hook; the rule only concerns HMR. */
import { createContext, useContext, type ReactNode } from "react";
import type { AuthSession } from "./types";

export interface AuthContextValue {
  session: AuthSession;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Returns null when rendered outside an AuthProvider (the demo build) — callers
// treat null as "no auth", so it deliberately does NOT throw.
export function useAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(auth): AuthContext (AuthProvider + useAuth)"
```

---

## Task 4: `Login` screen

**Files:** Create `src/screens/Login.tsx`, `src/screens/Login.test.tsx`

- [ ] **Step 1: Failing test** — `src/screens/Login.test.tsx`:
```tsx
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
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement** — `src/screens/Login.tsx`. IMPORTANT: use only token utility classes that already exist in the codebase. Before writing, run `grep -rn "matcha-deep\|text-paper\|bg-paper\|border-line\|text-ink\|text-muted\|rounded-pill\|rounded-xl\|shadow-\[" src/components src/screens` to confirm class names, and inspect `src/components/FitBar.tsx`/`LoadBar.tsx` for the existing danger/over color token; use that token for the error text (the draft uses `text-danger` as a placeholder — REPLACE it with the real token if `text-danger` isn't already used). Then:
```tsx
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
    const result = await port.signIn(email, password);
    setPending(false);
    if (result.error) setError(result.error);
    // On success, AuthGate's onAuthChange subscription flips the gate to the app.
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

        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

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
```
(Verify `bg-matcha-deep`/`text-paper`/`text-danger`/`border-line-2` exist; substitute the codebase's real tokens where they differ. `lint:tokens` rejects raw hex/fonts but NOT misspelled utility classes, so eyeball that the button/error actually render colored by checking the classes are used elsewhere.)

- [ ] **Step 4: Run it, expect PASS** — `npx vitest run src/screens/Login.test.tsx`

- [ ] **Step 5: Green gate (incl. tokens) + commit**
```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test
git add -A
git commit -m "feat(auth): branded Login screen (no sign-up / no reset)"
```

---

## Task 5: `AuthGate`

**Files:** Create `src/auth/AuthGate.tsx`, `src/auth/AuthGate.test.tsx`

- [ ] **Step 1: Failing test** — `src/auth/AuthGate.test.tsx`:
```tsx
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
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement** — `src/auth/AuthGate.tsx`:
```tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthPort, AuthSession } from "./types";
import { AuthProvider } from "./AuthContext";
import { Login } from "../screens/Login";
import { Loading } from "../components/Loading";

type Status = "checking" | "unauthenticated" | "authenticated";

export function AuthGate({ port, children }: { port: AuthPort; children: ReactNode }) {
  const portRef = useRef<AuthPort | null>(null);
  if (portRef.current === null) portRef.current = port;
  const [status, setStatus] = useState<Status>("checking");
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const p = portRef.current!;
    let cancelled = false;
    const apply = (s: AuthSession | null) => {
      if (cancelled) return;
      setSession(s);
      setStatus(s ? "authenticated" : "unauthenticated");
    };
    // onAuthChange is authoritative; getSession seeds the initial state.
    const unsub = p.onAuthChange(apply);
    p.getSession().then(apply).catch(() => { if (!cancelled) setStatus("unauthenticated"); });
    return () => { cancelled = true; unsub(); };
  }, []);

  if (status === "checking") return <Loading />;
  if (status === "unauthenticated" || !session) return <Login port={portRef.current!} />;
  return (
    <AuthProvider value={{ session, signOut: () => { void portRef.current!.signOut(); } }}>
      {children}
    </AuthProvider>
  );
}
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test
git add -A
git commit -m "feat(auth): AuthGate (checking/unauthenticated/authenticated, onAuthChange authoritative)"
```

---

## Task 6: Wire `App` + `TopBar`

**Files:** Modify `src/App.tsx`, `src/components/TopBar.tsx`, `src/components/topbar.test.tsx`

- [ ] **Step 1: Wire `App.tsx`** — add imports and conditionally wrap. Replace the `App` function (leave `Shell`/`ActiveView` exactly as they are):
```tsx
import { createAuthPort } from "./auth/createAuthPort";
import { AuthGate } from "./auth/AuthGate";
```
```tsx
export function App() {
  const authPort = createAuthPort();
  const dataApp = (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
  return authPort ? <AuthGate port={authPort}>{dataApp}</AuthGate> : dataApp;
}
```
(`createAuthPort()` returns `null` in the local/demo build → `App` renders the data app directly, unchanged. In the supabase build it returns the deferred port → `AuthGate` wraps the data load.)

- [ ] **Step 2: Add the failing TopBar test** — append to `src/components/topbar.test.tsx`. It renders TopBar inside a seeded store AND an `AuthProvider`, asserting email + Sign out appear and the button calls `signOut`. Use the existing `renderSeeded` helper wrapped with `AuthProvider`:
```tsx
import { AuthProvider } from "../auth/AuthContext";
// (vi is already imported in this file from the Phase 1 save-error test; if not, add it)

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
```
If `topbar.test.tsx` doesn't already import `renderSeeded`/`screen`, add the imports (`renderSeeded` from `../test/renderSeeded`, `screen` from `@testing-library/react`). Keep all existing topbar tests intact. (The existing tests render TopBar WITHOUT an AuthProvider, so they already cover the demo "no Sign out" case.)

- [ ] **Step 3: Run it, expect FAIL** — `npx vitest run src/components/topbar.test.tsx` (the new test fails: no email/Sign out yet).

- [ ] **Step 4: Implement TopBar change** — in `src/components/TopBar.tsx`, import `useAuth` and render the optional controls. Add the import:
```tsx
import { useAuth } from "../auth/AuthContext";
```
Inside the component, after `const { state, dispatch } = useStore();`:
```tsx
  const auth = useAuth();
```
Then in the right-hand controls `div` (the one containing the saveError span + `<ExportMenu />`), add the auth block so it reads:
```tsx
        <div className="flex items-center gap-3">
          {state.saveError && (
            <span role="status" className="text-xs text-muted">Couldn’t save — retrying on next edit</span>
          )}
          {auth && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{auth.session.email}</span>
              <button onClick={auth.signOut} className="text-xs text-ink underline">Sign out</button>
            </div>
          )}
          <ExportMenu />
        </div>
```
(Only token classes — `text-xs`, `text-muted`, `text-ink` are all already used in this file.)

- [ ] **Step 5: Run it, expect PASS** — `npx vitest run src/components/topbar.test.tsx`

- [ ] **Step 6: Full green gate + commit**
```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test
git add -A
git commit -m "feat(auth): wire AuthGate into App; TopBar email + Sign out"
```

---

## Task 7: Bundle hygiene, README auth note, full verification

**Files:** Modify `README.md`

- [ ] **Step 1: Demo bundle ships no auth SDK** — run:
```bash
rm -rf dist && npm run build
```
Confirm no Supabase SDK in the demo bundle. The string "supabase" appears as a dead `import()` specifier + the `VITE_BACKEND` literal, so check for the actual SDK instead:
```bash
grep -rl "GoTrueClient\|@supabase/auth-js\|gotrue" dist/assets || echo "OK: no Supabase auth SDK in demo bundle"
```
Expected: `OK: no Supabase auth SDK in demo bundle`. Note the entry JS size (should be within ~1–2 KB of the Phase 1 demo size; AuthGate/Login/AuthContext are small and statically reachable, but the SDK is not).

- [ ] **Step 2: Supabase build splits the SDK into a lazy chunk** — run:
```bash
VITE_BACKEND=supabase npm run build
for f in dist/assets/*.js; do printf "%8d  %s  " "$(wc -c < "$f")" "$(basename "$f")"; grep -q "GoTrueClient\|@supabase" "$f" && echo "[SDK]" || echo ""; done
```
Expected: the auth/data SDK lives in a separate chunk (the `[SDK]` one), NOT inside the main entry chunk (entry stays ≈ the demo size). Restore the default build afterward: `rm -rf dist && npm run build`.

- [ ] **Step 3: README auth note** — add a short section to `README.md` (the full "run your own" section is Phase 4; this is just the auth fact). Insert after the existing run/test/deploy material a concise block:
```markdown
## Authentication (supabase build)

The real app (`VITE_BACKEND=supabase`) is gated by email + password login. There is
**no public sign-up** — create your account in the Supabase dashboard
(Authentication ▸ Users ▸ Add user, with auto-confirm). Reset a forgotten password the
same way (Authentication ▸ Users ▸ the user ▸ reset/​recovery). The public demo
(`VITE_BACKEND=local`, the default) has no login.
```

- [ ] **Step 4: Full milestone gate**
```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test && npm run build
npm audit --omit=dev
```
Expected: all green; audit 0 (no new runtime dep was added this phase — auth uses the already-pinned `@supabase/supabase-js`).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "docs(auth): README authentication note; verify demo bundle ships no auth SDK"
```

---

## Human-in-the-loop (after the plan is green) — the deferred Phase 1 setup

Pause and hand the user exact steps:
1. Create a Supabase project (free tier); copy its Project URL + anon/publishable key.
2. SQL editor → run `supabase/schema.sql` (creates `app_data` + RLS).
3. Authentication ▸ Users ▸ **Add user** → email + password, **auto-confirm** (no SMTP).
4. `cp web/.env.example web/.env`; set `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL=…`, `VITE_SUPABASE_ANON_KEY=…`.
5. `cd web && npm run dev` → verify **log in → edit → reload (persists) → sign out → back to Login** end-to-end (the first real cloud round-trip).

---

## Self-Review (completed)

- **Spec coverage:** AuthPort seam (Task 1); SupabaseAuthAdapter + createAuthPort deferred factory, null in local (Task 2); AuthContext/useAuth non-throwing (Task 3); branded Login, generic error, no sign-up/reset (Task 4); AuthGate checking/unauth/auth with onAuthChange authoritative + unsubscribe (Task 5); App gate-above-data wiring + TopBar email/Sign out (Task 6); bundle hygiene + README note + full gate (Task 7); human Supabase steps (end). All spec sections map to tasks.
- **Placeholder scan:** none — full code in every step. The one explicit "verify/replace token class" instruction in Task 4 is a real guardrail, not a placeholder (draft classes given; verification required because `lint:tokens` can't catch a non-existent utility class).
- **Type consistency:** `AuthSession = { userId, email: string|null }` and `AuthPort` (getSession/signIn→`{error}`/signOut/onAuthChange→unsubscribe) are identical across FakeAuthPort, SupabaseAuthAdapter, createAuthPort, AuthGate, Login. `AuthContextValue = { session: AuthSession; signOut: () => void }` consistent across AuthContext, AuthGate, TopBar. `createAuthPort(): AuthPort | null` consistent in App.
