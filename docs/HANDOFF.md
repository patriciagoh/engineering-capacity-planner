# Productionization Handoff — Engineering Capacity Planner

**For:** the next Claude Code session (possibly a different account/machine) picking up this work.
**Date:** 2026-06-04.
**Branch state at handoff:** `main` @ `50db7d5` (Phases 0–2 merged). Working tree clean. 108 tests passing.

---

## 0. TL;DR — read this first

We are turning a vibe-coded React SPA (an engineering **capacity planner**) into a real, deployed, multi-user product, using the **`productionize-prototype`** skill's full playbook (Phases 0–5). **Phases 0, 1, 2 are done and merged.** **Phases 3, 4, 5 remain.** The next concrete task is **Phase 3 (CRUD)** so a logged-in user can actually create teams/projects.

**Method (follow it):** one phase = one branch = one PR. Each phase runs the loop:
`superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development` (fresh subagent per task + two-stage spec & code-quality review between tasks) → `superpowers:finishing-a-development-branch` (push, PR, merge). Keep `main` green and deployable. This is exactly how Phases 0–2 were done — match that rhythm.

The owner (Patricia) is fine with: pushing branches, opening PRs, and **merging PRs for her** when asked. She has a Supabase project set up (details in §5).

---

## 1. What the app is

- **`web/`** is the product: a **React 19 + TypeScript + Vite 5** single-page app. The engine computes engineering team capacity (supply vs demand in person-months) across three "lenses" (Manager / Director / PM).
- The capacity **math lives in a pure, tested TypeScript engine** (`web/src/engine/`). The store holds inputs; selectors derive everything live. **Only the engine computes capacity** — components format and draw.
- Design system: **matcha-oat-design-system** (a `github:` dependency), consumed via a Tailwind preset. **Token discipline is enforced**: components/screens may use ONLY token utility classes (no raw hex / font literals); a `lint:tokens` guardrail fails on violations.
- The repo root also has `docs/` (specs + plans + this file) and `.github/workflows/` (CI + GitHub Pages deploy of the demo).

### Key commands (run from `web/`)
```bash
npm install              # .npmrc sets ignore-scripts=true (supply-chain hardening)
npm run dev              # Vite dev server
npm test                 # vitest run — full suite
npm run typecheck        # tsc --noEmit -p tsconfig.app.json
npm run lint             # eslint
npm run lint:tokens      # guardrail: no raw hex/font in components/screens
npm run build            # tsc -b && vite build  (THE real build — see gotchas)
npm audit --omit=dev     # production deps must be 0 vulnerabilities
```
**Green gate before any commit that finishes a task:** `npm run typecheck && npm run lint && npm run lint:tokens && npm test`. Milestone steps also run `npm run build`.

---

## 2. Architecture established in Phases 0–2 (you must understand these seams)

The whole design is built around **injectable seams** with a **build flag** that keeps the public demo backend-free.

### The build flag: `VITE_BACKEND=local|supabase`
- **`local`** (default, the public GitHub Pages demo): seeded sample org, **no login**, **no persistence** (edits are ephemeral), and the bundle ships **zero** Supabase/auth SDK code.
- **`supabase`** (the real app): per-user cloud persistence + email/password login. The Supabase SDK is **dynamically imported**, so it only loads in this build.

### Storage seam (Phase 1) — `web/src/storage/`
- `StoragePort` = `{ load(): Promise<PersistedState|null>; save(state): Promise<void> }`. `PersistedState = { cur: number; teams: Team[] }`. The persisted document is `{ version: 1, cur, teams }` (the lens `view` is session-only, not persisted).
- `LocalPort` = seeded load + no-op save (the demo). `SupabasePort` = real, built on a thin `RowStore` sub-seam (`SupabaseRowStore`, the only network code, intentionally untested). `FakeRowStore` is the in-memory test double.
- `createStoragePort()` factory: returns `LocalPort` unless `VITE_BACKEND==="supabase"`, in which case a **deferred** port that `import("./supabasePort")` on first use.
- **`sanitize(raw)`** (pure, heavily tested): `null → null` (new user); recognized blob → normalize (clamp `cur`, coerce `alloc`/`est`/overhead/ktlo, backfill ids); **non-null unrecognized/malformed → THROW** (never silently overwrite — data-loss guard). `serialize(state)` wraps with `version`.
- The store (`web/src/state/store.tsx`) hydrates **async**: `status: "loading"|"ready"|"error"`, `HYDRATE`/`LOAD_ERROR` actions, a mount effect calling `port.load()`, and a **debounced (~600ms) autosave** effect with a non-blocking `saveError` flag. `App.tsx`'s `Shell` renders loading / load-error / **empty-state** ("No teams yet") / the app, **above** any `teams[cur]` deref.

### Auth seam (Phase 2) — `web/src/auth/`
- `AuthPort` = `{ getSession; signIn(email,pw); signOut; onAuthChange(cb)→unsubscribe }`, exposing our own `AuthSession = { userId; email: string|null }` (never Supabase's raw `Session`).
- `SupabaseAuthAdapter` over the **shared** `getClient()` (one client for data + auth). `createAuthPort()` = `null` in local, deferred dynamic-import in supabase.
- `AuthGate` (the gate **above** the data load): `checking` → `<Loading/>`, `unauthenticated` → `<Login/>`, `authenticated` → `<AuthProvider>{dataApp}</AuthProvider>`. `onAuthChange` is **authoritative** (drives login/logout/expiry) and a late `getSession` cannot clobber a newer event. `App` wraps the data app in `<AuthGate>` only when `createAuthPort()` is non-null (demo path unchanged).
- `Login` = branded form, **generic error** (no account enumeration), **no sign-up / no password-reset** (accounts are dashboard-managed). `TopBar` shows the signed-in email + Sign out via `useAuth()` (returns `null` outside a provider).

### Data model identity (Phase 1 refactor — important)
- `Engineer`, `Project`, `Team` all have stable `id: string` (`crypto.randomUUID()` via `web/src/engine/ids.ts`'s `newId()`).
- **`Project.team` is `string[]` of engineer ids** (NOT roster indices — the old index identity was removed; it corrupted assignments on remove/move). React keys on list rows use these ids. `cur` is still a numeric team index (clamped on load).

### Repo conventions / hard constraints (subagents must respect these)
- **tsconfig `erasableSyntaxOnly`**: NO `private x` constructor parameter-properties — declare the field and assign in the body.
- **`noUnusedParameters`/`noUnusedLocals`**: no underscore-arg lint ignore — for a deliberately-unused param write `void param;` (an unused *callback* arg before a used one is fine, e.g. `(_event, session) => …`).
- **Token discipline**: only design-system token utility classes in `components/`/`screens/`. `lint:tokens` rejects raw hex/fonts but does **NOT** catch a misspelled/nonexistent utility class (it just renders unstyled) — so verify class names against existing usage (e.g. error/danger color is `text-bad`; primary button is `bg-matcha-deep text-paper`).
- **Tests**: colocated (`foo.test.tsx`). Default Vitest env is DOM-capable; component tests need no env pragma. Wrap synchronous state-changing calls (e.g. a fake's `push()`) in `act(...)`. Use the `renderSeeded` helper (`web/src/test/renderSeeded.tsx`) to render a screen inside a hydrated store.
- **Bundle hygiene**: keep the Supabase SDK out of the demo bundle via the deferred dynamic imports. Verify with `npm run build` (demo) and `VITE_BACKEND=supabase npm run build` (SDK should be a separate lazy chunk, entry unchanged).

---

## 3. Working method (what worked, in detail)

For **every** phase:
1. `git checkout -b phase-N-<name>` off `main`.
2. **`superpowers:brainstorming`** — settle the design; the playbook prescribes most of it, so surface only the genuine decisions, then present the design and get approval. Write the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, commit, ask the owner to review.
3. **`superpowers:writing-plans`** — turn the approved spec into a TDD task plan with **full code in every step** (no placeholders), save to `docs/superpowers/plans/YYYY-MM-DD-<name>.md`, commit.
4. **`superpowers:subagent-driven-development`** — for each task: dispatch a fresh general-purpose subagent with the full task text + context (don't make it read the plan file); it does TDD (red→green), commits, self-reviews; then dispatch a **spec-compliance reviewer**, then a **code-quality reviewer** (read-only agents that independently re-run the gate and read the actual diff). Fix-loop on findings. Mandatory: do NOT skip reviews on anything touching auth/persistence/telemetry. After all tasks, a **final whole-phase review** over `main..HEAD`.
5. **`superpowers:finishing-a-development-branch`** — verify green, then push + `gh pr create` + (when the owner says so) `gh pr merge --merge --delete-branch`, then `git checkout main && git pull`.

Notes:
- Subagents see a **stale git snapshot** that says `main`; the working tree is actually on the phase branch. Their commits land correctly on the branch — ignore the "I branched off main" confusion in their reports.
- Commit-message convention ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. PR bodies end with the Claude Code generated-with line.
- The `productionize-prototype` skill itself (and the `superpowers:*` skills) should be available; invoke `/productionize-prototype` to reload the playbook, or just follow this doc + the per-phase skills.

---

## 4. What's DONE (Phases 0–2)

### Phase 0 — Orient & harden (PR #1, merged)
- **CSV formula-injection fix** in `web/src/export/exporters.ts` (string cells starting with `= + - @ \t \r` get a `'` prefix; numbers untouched). The one real security finding.
- Supply-chain: `web/.npmrc` `ignore-scripts=true` (verified clean install + build); runtime deps pinned **exact** (incl. the design-system pinned to a commit SHA); `npm audit --omit=dev` = 0.
- MIT `LICENSE`. Removed stale untracked Python `engine/`+`server/` dirs.

### Phase 1 — Supabase backend, one JSON doc per user (PR #2, merged)
- The stable-ID refactor + the entire storage seam, sanitizer, async hydration, shell states, debounced autosave, `VITE_BACKEND` flag, `supabase/schema.sql` (table + RLS), `.env.example`, env typings. (See §2.) `@supabase/supabase-js` pinned exact (`2.107.0`).
- Spec: `docs/superpowers/specs/2026-06-04-supabase-backend-phase-1-design.md`; plan: `docs/superpowers/plans/2026-06-04-supabase-backend-phase-1.md`.

### Phase 2 — Login, email+password, locked down (PR #3, merged)
- The entire auth seam, `AuthGate`, branded `Login`, App/TopBar wiring. (See §2.) Demo stays login-free.
- Spec: `docs/superpowers/specs/2026-06-04-login-phase-2-design.md`; plan: `docs/superpowers/plans/2026-06-04-login-phase-2.md`.
- **Live-verified**: the owner logged into the real Supabase-backed app successfully.

---

## 5. Environment / Supabase (already set up by the owner)

- A Supabase project exists. **Project URL:** `https://wybzujhvyybcysicrhme.supabase.co`.
- `supabase/schema.sql` has been **run** (the `app_data` table + RLS policies exist — verified live: anonymous requests correctly see zero rows).
- A login **user has been created** (dashboard, auto-confirmed) and login works.
- **`web/.env`** (gitignored — NOT in the repo) must exist for the supabase build. On this machine it already does. **On a fresh clone/machine, recreate it:**
  ```bash
  cd web && cp .env.example .env
  ```
  then set:
  ```
  VITE_BACKEND=supabase
  VITE_SUPABASE_URL=https://wybzujhvyybcysicrhme.supabase.co
  VITE_SUPABASE_ANON_KEY=<the sb_publishable_… key from Supabase dashboard ▸ Project Settings ▸ API>
  ```
  The publishable key is browser-safe (it ships in the bundle); grab it from the dashboard or the owner's existing `web/.env`. **Never** use the `service_role`/secret key in the frontend.
- To run the real app locally: `cd web && npm run dev`, open the printed URL → login screen → sign in.

---

## 6. What's LEFT — Phases 3, 4, 5

### Phase 3 — Make it usable (CRUD)  ← DO THIS NEXT
**Goal:** a logged-in user can create their first team and manage entities. The real app is currently empty with no way to add data.
- **Empty-state CTA:** the "No teams yet" `EmptyState` (`web/src/components/EmptyState.tsx`) needs a **"Create your first team"** action.
- **CRUD for teams, engineers, projects** via **routes + a shared form** (NOT modals — for focus & a11y). Need new reducer actions incl. **`ADD_TEAM` / `DELETE_TEAM`** (none exist yet) — design `DELETE_TEAM` together with the `cur` clamp so deleting the open team can't point `cur` out of range.
- Reducers stay pure; new entities mint ids via `newId()` (already the pattern).
- **Live dates in the real build:** the demo froze "now". The supabase build should use real dates so capacity doesn't go stale:
  - Fix the hardcoded subtitle `"sample data · Q3 capacity"` in `web/src/components/TopBar.tsx`.
  - **Derive the onboarding ramp from a real start date** rather than the frozen `Onboarding` enum (`"New Hire: Month 2"` etc. in `web/src/engine/types.ts`) — add an `Engineer.startDate` and compute the ramp multiplier from elapsed months, so it ages automatically. (`web/src/engine/constants.ts` holds the multipliers.)
- **Fix the Director before/after-move bug:** `web/src/screens/Director.tsx`'s `handleMove` reads `state` from a stale render closure, so the before/after fit panel can show the wrong person/teams. Compute after-fits from the reducer's next state (pure helper), don't reset the "who" select until the card is dismissed.
- **Exporters:** `toCSV`/`toJSON` omit project assignments and now export opaque engineer **ids**; resolve ids to names in both exporters.
- **Verify end-to-end** against the live backend: log in → **create** a team → **reload (persists)** → **edit** → **delete** → sign out.

### Phase 4 — Package & deploy (Vercel)
- **Configurable base path:** make Vite `base` env-driven, e.g. `base: process.env.VITE_BASE || "/engineering-capacity-planner/"` so the demo serves under the Pages subpath and the real app at root on Vercel.
- **Self-host fonts** via `@fontsource/*` packages (drop any Google Fonts `@import` — it leaks every visitor's IP). Use the non-`-variable` packages so family names match the design tokens.
- **README "Run your own"** section + a Deploy-to-Vercel button. `supabase/schema.sql` and `web/.env.example` already exist (ship them).
- **Deploy to Vercel** (human step): import the repo, set env vars (`VITE_BACKEND=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BASE=/`), deploy. Result: one repo → two live deployments (Pages demo + Vercel real app). Remember **Vite inlines `VITE_*` at build time** — changing env requires a fresh build/redeploy.

### Phase 5 — Observability (privacy-scrubbed, opt-in)
- **Sentry** in a single `observability` module, **DSN-gated** (`VITE_SENTRY_DSN`) and **dynamically imported** (off by default, absent from the demo bundle).
- **Privacy is the whole point:** `sendDefaultPii: false`, **`defaultIntegrations: false`** (note: `integrations: []` does NOT disable defaults), **drop all breadcrumbs** (`beforeBreadcrumb: () => null` — DOM breadcrumbs capture `aria-label` text, and this app's aria-labels contain **user names**, e.g. roster labels), **no Session Replay**, **never `setUser`**, and a `beforeSend` scrubber stripping request bodies / `extra` / `user`. Send only safe tags like `{ op }`.
- A React **ErrorBoundary** for render crashes (reports no data) — this is the one **deferred Phase-1 item** (we shipped a load-error *shell* but not an ErrorBoundary). Route load/save failures through a `captureError` with only an `{ op }` tag.
- **Cookieless perf:** gated `@vercel/speed-insights` + `@vercel/analytics` (`VITE_VERCEL_INSIGHTS=1`).
- **Uptime monitor** (human step): a free external monitor on both URLs.
- Update README privacy wording honestly: demo sends nothing; the real build can opt in; self-hosters inherit zero telemetry.

---

## 7. Deferred review findings still open (fold into the phases above)

These came out of Phase 0–2 reviews and were intentionally parked:
- **Phase 3:** `ADD_TEAM`/`DELETE_TEAM` actions (+ `cur` clamp); live dates / onboarding-from-startDate; Director stale-state before/after bug; exporters resolve ids→names + include assignments; the empty-state CTA.
- **Phase 5:** the React ErrorBoundary (above).
- **Minor/optional polish (skip unless convenient):** strengthen the `newId` uniqueness test; a `Login` double-submit guard (`if (pending) return;`); `aria-describedby` linking the Login error to inputs.

(Already FIXED in earlier phases — do not redo: stable ids, `Project.team: string[]`, id-based remove/move, the load-boundary sanitizer incl. malformed-nested throw, the `EDIT_ENGINEER` field type excludes `id`, the explicit upsert `onConflict: "owner"`, the AuthGate late-getSession race guard, the unhandled-rejection `.catch` on `onAuthChange`.)

---

## 8. Gotchas this stack actually bit us on

| Gotcha | Do this |
|---|---|
| `npm run typecheck` passes but `npm run build` (`tsc -b`) fails | Verify milestones with the real `npm run build`, not just typecheck. |
| Vite inlines `VITE_*` at **build time** | Changing env needs a fresh build/redeploy; a deployed bundle missing a value predates the env change. |
| Regenerating `package-lock.json` on macOS drops the Linux `@rollup/rollup-*` optionals → `npm ci` fails on CI/Vercel Linux | After any lock change, confirm ~25 `@rollup/rollup-*` entries incl. `linux-x64-gnu` remain in the lock before pushing. |
| `lint:tokens` won't catch a **misspelled** utility class (only raw hex/fonts) | Verify class names against existing component usage; a dead class renders unstyled. |
| Shipping the Supabase **service/secret** key to the browser | Frontend uses only the **publishable/anon** key. |
| DOM breadcrumbs / `setUser` leak names to Sentry | Phase 5: `defaultIntegrations:false`, drop breadcrumbs, never `setUser`, `beforeSend` scrub. |
| Synchronous state updates in tests warn about `act()` | Wrap them in `act(...)`. |
| Subagent reports "I branched off main" | Cosmetic — it misreads a stale snapshot; commits land on the real phase branch. Verify with `git log` if unsure. |

---

## 9. How to start, on the new machine/account

```bash
# 1. Get the repo + confirm green baseline
git clone <repo> && cd <repo>/web    # (or open the existing clone)
npm install
npm test                              # expect all green (108 at handoff)

# 2. (optional) run the real app — needs web/.env (see §5)
cp .env.example .env                  # then fill in VITE_* per §5
npm run dev

# 3. Continue the playbook
#    Invoke the productionize-prototype skill (or just tell Claude:
#    "continue this productionization — Phase 3 (CRUD) is next; read docs/HANDOFF.md").
#    Then: brainstorm → writing-plans → subagent-driven-development → finish, per §3.
```

The specs/plans for completed phases are in `docs/superpowers/{specs,plans}/` — read them for precedent on style, seam patterns, and test conventions before designing Phase 3. Keep `main` green; one phase per branch/PR. Good luck. 🚀
