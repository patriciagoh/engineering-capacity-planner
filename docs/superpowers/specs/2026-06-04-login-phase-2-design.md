# Phase 2 — Login (email + password, locked down)

**Date:** 2026-06-04
**Status:** Approved
**Phase:** 2 of the productionize-prototype playbook (login)
**Branch:** `phase-2-login`

## Goal

Gate the real app behind email + password authentication, with **no public
sign-up surface**. The auth gate sits *above* the Phase 1 data load: the cloud
data document only loads after a session exists. The public demo (local build)
stays completely login-free.

## Decisions (settled in brainstorming)

1. **Generic login error** — "Invalid email or password" (no account enumeration).
2. **Session persists across reloads** (Supabase default `persistSession`); the user
   stays logged in until they sign out or the session expires.
3. **Login screen is branded** to match the matcha-oat design system.
4. **TopBar shows the signed-in email + a Sign out control** (supabase build only).
5. **No in-app sign-up and no in-app password reset.** The deployer creates the
   account in the Supabase dashboard; password reset is done from the dashboard
   (documented in the README). No SMTP, no email confirmation, no public registration.

## Architecture (mirrors the Phase 1 storage seam)

### AuthPort seam

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

- The port exposes our own minimal `AuthSession`, never Supabase's raw `Session`
  type (keeps consumers decoupled from the SDK).
- **`SupabaseAuthAdapter`** implements `AuthPort` over the existing shared
  `getClient().auth` (one client for data + auth). `signIn` maps a Supabase auth
  error to the generic message; `onAuthChange` wraps `supabase.auth.onAuthStateChange`
  and maps each event's session to `AuthSession | null`.
- **`createAuthPort(): AuthPort | null`** factory mirrors `createStoragePort`:
  - `VITE_BACKEND === "supabase"` → returns a deferred `AuthPort` that
    dynamic-imports the adapter module (keeps the SDK out of the demo bundle).
  - otherwise → returns `null` (local/demo build: no auth at all).

### The gate

```
supabase build:
  <AuthGate port={authPort}>
    ├─ checking         → <Loading/>  (reuses the Phase 1 loader during initial getSession)
    ├─ unauthenticated  → <Login port={authPort}/>     (NO data load)
    └─ authenticated    → <AuthProvider value={{ session, signOut }}>
                            <StoreProvider><Shell/></StoreProvider>   (Phase 1 data load runs here)
                          </AuthProvider>

local build:
  <StoreProvider><Shell/></StoreProvider>     (unchanged — no gate, no auth context)
```

- `App` decides: `const authPort = createAuthPort();` — if non-null, wrap the data
  app in `<AuthGate>`; else render the data app directly (today's behavior).
- **`AuthGate`** owns auth state: `"checking" | "unauthenticated" | "authenticated"`.
  - On mount: `getSession()` → set authenticated/unauthenticated; subscribe via
    `onAuthChange` and unsubscribe on unmount.
  - **`onAuthChange` is authoritative**: a sign-in event → authenticated; a sign-out
    or expiry event (`session === null`) → unauthenticated (back to Login). This makes
    logout, multi-tab sign-out, and session expiry all converge on the same path.
  - When authenticated, mounting `<StoreProvider>` triggers the Phase 1 data load
    (`SupabaseRowStore.getRow()` now finds the logged-in user). On logout the
    `StoreProvider` unmounts, discarding in-memory data.

### Login screen + sign-out

- **`Login`**: a branded card (serif heading, paper/token classes) with email +
  password inputs, a submit button with a pending/loading state, a generic inline
  error on failure, the note "Accounts are created by your administrator.", and **no**
  sign-up or password-reset links. Submitting calls `port.signIn`; on success the
  `onAuthChange` subscription flips the gate to authenticated (Login does not itself
  navigate — the gate is authoritative).
- **`AuthProvider` / `useAuth`**: a small context exposing `{ session, signOut }`,
  available only when authenticated in the supabase build (absent in the demo).
- **`TopBar`** reads the optional auth context: when present, render the signed-in
  email and a "Sign out" button calling `signOut`. In the demo (no provider) it renders
  exactly as today.

## Error handling

- `signIn` failure → `{ error: "Invalid email or password" }` (generic; the adapter
  collapses Supabase's specific errors). Network/unexpected errors surface the same
  generic message; the input is re-enabled for retry.
- Initial `getSession()` rejection → treat as unauthenticated (show Login), never crash.
- The gate never renders the data app without a session; the data layer never loads
  without a session.

## Testing

- **`FakeAuthPort`** (in-memory): drives all gate/Login tests without the network.
- **AuthGate** (happy-dom): checking → unauthenticated (no session); checking →
  authenticated (existing session); sign-in event flips to app; `onAuthChange(null)`
  (sign-out/expiry) flips back to Login; unsubscribe called on unmount.
- **Login** (happy-dom): submitting calls `signIn` with the entered creds; failure
  renders the generic error and re-enables the form; no sign-up/reset links present.
- **TopBar**: shows email + Sign out when an auth context is provided; unchanged when
  not (demo).
- **Demo stays login-free**: with `VITE_BACKEND` unset, `createAuthPort()` is null and
  `App` renders no `AuthGate` / no `Login`.
- **Adapter** (`SupabaseAuthAdapter`) is the thin network binding — not unit-tested
  (its logic is the mapping, exercised indirectly; same convention as `SupabaseRowStore`).
- Full green gate + a build check that the demo bundle still ships no Supabase/auth code.

## Files

New:
- `src/auth/types.ts` — `AuthSession`, `AuthPort`.
- `src/auth/createAuthPort.ts` — factory (local → null; supabase → deferred dynamic import).
- `src/auth/supabaseAuthAdapter.ts` — `SupabaseAuthAdapter` + `createSupabaseAuthPort()`.
- `src/auth/AuthGate.tsx` — gate component (checking/unauthenticated/authenticated).
- `src/auth/AuthContext.tsx` — `AuthProvider` + `useAuth` (`{ session, signOut }`).
- `src/auth/fakeAuthPort.ts` — in-memory test port.
- `src/screens/Login.tsx` — branded login form.
- Tests: `AuthGate.test.tsx`, `Login.test.tsx`, plus additions to `topbar.test.tsx`.

Changed:
- `src/App.tsx` — conditionally wrap the data app in `<AuthGate>` when `createAuthPort()` is non-null.
- `src/components/TopBar.tsx` — optional email + Sign out from `useAuth`.

## Human-in-the-loop (the deferred Phase 1 setup, now due)

I will pause and hand over exact steps:
1. Create a Supabase project (free tier).
2. SQL editor → run `supabase/schema.sql` (creates `app_data` + RLS).
3. Authentication ▸ Users ▸ **Add user** → email + password, **auto-confirm** (no SMTP,
   no public signup).
4. Copy `VITE_SUPABASE_URL` + the **anon/publishable** key into `web/.env`
   (from `.env.example`), set `VITE_BACKEND=supabase`.
5. `npm run dev` (or a fresh build) → verify **log in → edit → reload (persists) →
   sign out → back to login** end-to-end. This is the first real cloud round-trip.

Document dashboard password reset in the README (full README "run your own" section is Phase 4).

## Out of scope (later phases)

- Team/engineer CRUD, the empty-state "create first team" CTA, live dates (Phase 3).
- Configurable base path, self-hosted fonts, full README, Vercel deploy (Phase 4).
- Sentry / telemetry, React error boundary for render crashes (Phase 5).
