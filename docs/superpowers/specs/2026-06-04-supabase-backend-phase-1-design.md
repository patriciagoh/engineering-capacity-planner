# Phase 1 — Supabase backend (one JSON doc per user)

**Date:** 2026-06-04
**Status:** Approved
**Phase:** 1 of the productionize-prototype playbook (backend)
**Branch:** `phase-1-backend`

## Goal

Give the Engineering Capacity Planner real cloud persistence: **one JSON document
per user**, private via Row Level Security. Today the app persists nothing — state
is born from `makeSeedTeams()` and dies on reload. This phase introduces the
persistence seam, the Supabase adapter behind it, a load-boundary sanitizer, and a
build flag that keeps the public demo backend-free.

## Decisions (settled in brainstorming)

1. **Persisted document = `teams` + `cur`** (not `view`). The roster/projects/settings
   plus the last-opened team round-trip; the lens (`view`) is session-only and defaults
   to Manager.
2. **New user = empty + graceful empty-state.** A fresh account starts with zero teams
   (no fictional data). Phase 1 ensures zero-teams renders cleanly ("No teams yet"); the
   create-first-team CTA arrives in Phase 3.
3. **Autosave**, ~600 ms debounced. Edits update local state instantly; a debounced
   effect pushes the whole document. Last-write-wins per user.

### Rejected alternative
Normalized relational tables (separate team/engineer/project tables). Buys nothing
without cross-user sharing and costs significant schema + migration work. The single
JSON blob is a near drop-in behind a whole-blob seam; normalize later only if sharing
becomes a requirement.

## Sequencing note

RLS keys every row to `auth.uid()`, but **login arrives in Phase 2**. Phase 1 therefore
delivers the *plumbing* — seam, adapter, sanitizer, schema, `.env.example` — all
unit-tested against a fake `RowStore`, plus the demo (local) build fully working. The
real end-to-end Supabase round-trip is verified immediately after Phase 2 adds a session.
This matches the playbook's backend-then-login order. The load boundary built here is
exactly where Phase 2's auth gate slots in (above the data load).

## Components

### 1. Stable-ID refactor (lands first, before anything serializes)

Index-as-identity is the biggest productionization hazard and must be removed before we
ever serialize state.

- Add `id: string` (`crypto.randomUUID()`) to `Engineer`, `Project`, `Team`.
- Change `Project.team: number[]` → `string[]` (engineer **ids**, not roster positions).
- Update consumers:
  - `data/seed.ts` — assign ids in the seed factory.
  - `state/store.tsx` — `ADD_ENGINEER`/`ADD_PROJECT` mint ids; `TOGGLE_ASSIGNMENT`,
    `REMOVE_ENGINEER`, `MOVE_ENGINEER` operate by id; **delete `reindexAfterRemoval`**
    (no longer needed). `NEW_ENGINEER` template gets an id minted per add, not as a
    module constant.
  - `engine/selectors.ts` — `personLoads` and any assignment logic resolve engineer ids
    against the roster instead of indexing by position.
  - React keys: `key={i}` → `key={id}` in Manager/Pills/Director.
- Outcome: eliminates the index-identity corruption class and the `MOVE_ENGINEER`
  silent-assignment-loss bug; reorder becomes identity-safe.

`cur` remains a numeric team index for now (clamped on load); team-level CRUD and any
team reordering land in Phase 3, at which point a team lookup can switch to id if needed.

### 2. Persisted document shape

```jsonc
{
  "version": 1,
  "cur": 2,
  "teams": [ /* Team[] including ids */ ]
}
```

`version` distinguishes a recognized blob from an unrecognized one. `view` is not
persisted.

### 3. The seam — two layers

```ts
// Whole-blob port — what the store talks to.
interface StoragePort {
  load(): Promise<PersistedState | null>; // null = brand-new user, no row yet
  save(state: PersistedState): Promise<void>;
}

// Thin sub-seam under SupabasePort, so bootstrap/sanitize logic is testable
// against a fake without touching the network.
interface RowStore {
  getRow(): Promise<unknown | null>; // raw jsonb for the current user, or null
  putRow(data: unknown): Promise<void>; // upsert
}

type PersistedState = { cur: number; teams: Team[] };
```

- **`LocalPort`** (demo / `VITE_BACKEND=local`): `load()` returns the seeded state;
  `save()` is a no-op. Preserves today's seeded, ephemeral, login-free demo and ships
  **zero** Supabase code.
- **`SupabasePort`** (`VITE_BACKEND=supabase`): `load()` = `sanitize(await rowStore.getRow())`;
  `save(state)` = `rowStore.putRow(serialize(state))`. Built on a `RowStore`.
- **`SupabaseRowStore`**: a paper-thin binding over `supabase.from('app_data')` — select
  the caller's row on `getRow`, upsert on `putRow`. Minimal logic, not heavily unit-tested
  (the logic lives in the sanitizer and `SupabasePort`, tested against `FakeRowStore`).

### 4. Load-boundary sanitizer (pure function, heavily tested)

`sanitize(raw: unknown): PersistedState | null`

- `raw == null` → return `null` → store initializes **empty** (`{ cur: 0, teams: [] }`).
- Recognized blob (has `version` and a `teams` array) → normalize and return:
  - clamp `cur` to `[0, teams.length - 1]` (or `0` when empty);
  - coerce/clamp numerics: `est ≥ 0`; `alloc ∈ {1, 0.75, 0.5, 0.25}`; overhead/ktlo
    `current`/`ideal` clamped to `0–100`;
  - backfill missing ids defensively (`crypto.randomUUID()`).
- Non-null but **unrecognized** shape → **throw** a load error. Never silently overwrite a
  blob we don't understand (data-loss guard).
- Empty `teams` is **valid** (decision 2A); the sanitizer does not force a phantom team.

### 5. Async hydration + new UI states

The store becomes async. `StoreProvider`:

1. starts in **loading**;
2. calls `port.load()` in an effect;
3. on success dispatches `HYDRATE` (loaded state, or empty for a new user) → **ready**;
4. on throw/network failure → **error**.

Three small UI states (kept as focused components):

- **Loading** — skeleton/spinner while the document loads.
- **Load-error** — does *not* enter the app and does *not* overwrite the stored row;
  offers retry.
- **Empty state** — "No teams yet" when `teams` is empty (the create button is Phase 3),
  so zero teams renders without crashing.

### 6. Autosave

A debounced (~600 ms) effect subscribes to state changes and calls `port.save(persisted)`.
UX is unchanged (edits are still instant locally). Last-write-wins per user (single row).
A save failure surfaces as a small, non-blocking "couldn't save" indicator; the failure is
routed through the Phase 5 telemetry hook later.

### 7. Build flag & bundle hygiene

- `VITE_BACKEND` = `local` (default) | `supabase`, read via `import.meta.env`.
- `createStoragePort()` factory: when `supabase`, **dynamic-import** the adapter module
  (which dynamic-imports `@supabase/supabase-js`); otherwise return `LocalPort`.
- The Supabase branch must be statically unreachable in the local build so Rollup drops
  the chunk. **Verify with the real `npm run build`** (`tsc -b && vite build`) that the
  demo bundle emits **no** Supabase chunk and is byte-comparable in size to today's.
- `@supabase/supabase-js` added as an exact-pinned runtime dependency (Phase 0 supply-chain
  convention).

### 8. Supabase client

`src/storage/client.ts` — lazily constructs one shared client from
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the **anon/publishable** key only; the
service key never reaches the browser). Shared by data (this phase) and auth (Phase 2).

### 9. Schema (`supabase/schema.sql`)

```sql
create table if not exists public.app_data (
  owner      uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

create policy "app_data: owner can select" on public.app_data
  for select using (auth.uid() = owner);
create policy "app_data: owner can insert" on public.app_data
  for insert with check (auth.uid() = owner);
create policy "app_data: owner can update" on public.app_data
  for update using (auth.uid() = owner) with check (auth.uid() = owner);
```

`updated_at` is set client-side on upsert (or via a trigger — client-side keeps the schema
minimal). No delete policy (a user's row is removed via `on delete cascade` when the auth
user is deleted).

## Human-in-the-loop steps

I will produce `supabase/schema.sql` and `.env.example`, then **pause** and hand over:

1. Create a Supabase project (free tier).
2. Run `supabase/schema.sql` in the SQL editor (creates `app_data` + RLS).
3. Copy `VITE_SUPABASE_URL` and the **anon** key into `.env`.

Adding the login *user* and the first real round-trip are Phase 2.

## Files

New:
- `src/storage/port.ts` — `StoragePort`, `RowStore`, `PersistedState`, `createStoragePort()`, `LocalPort`.
- `src/storage/sanitize.ts` — pure sanitizer + (de)serialize helpers.
- `src/storage/supabasePort.ts` — `SupabasePort` + `SupabaseRowStore` (dynamic SDK import).
- `src/storage/client.ts` — lazy shared Supabase client.
- UI: loading / load-error / empty-state components (or focused additions to `App.tsx`).
- `supabase/schema.sql`, `.env.example`.

Changed:
- `src/engine/types.ts` (ids, `Project.team: string[]`).
- `src/data/seed.ts` (assign ids).
- `src/state/store.tsx` (id-based actions, async hydration, `HYDRATE`, load states).
- `src/engine/selectors.ts` (id-aware lookups).
- Test suite migrated to string ids; new storage/sanitizer/hydration/empty-state tests.

## Testing

- **Sanitizer** (node env): `null → empty`; recognized → normalized (clamp `cur`, coerce
  numerics, backfill ids); unrecognized non-null → **throws**.
- **`SupabasePort`** against `FakeRowStore`: load (null→empty, valid→state, invalid→throw),
  save (serialize + `putRow`), round-trip.
- **ID refactor**: update `store.test`, `seed.test`, `selectors.test`, exporter tests for
  string ids / `Project.team: string[]`; verify assignments survive remove/move/reorder.
- **Hydration** (happy-dom): loading → ready → error transitions with a fake async port.
- **Empty state**: renders without crashing when `teams === []`.
- **Local build unchanged**: demo still seeded and login-free.
- **Bundle hygiene**: `npm run build` with `VITE_BACKEND=local` emits no Supabase chunk.

## Out of scope (later phases)

- Login / auth gate (Phase 2).
- Create/edit/delete teams, the empty-state CTA, live dates, Director before/after fix
  (Phase 3).
- Vercel deploy, configurable base, self-hosted fonts (Phase 4).
- Sentry / telemetry for save failures (Phase 5).
