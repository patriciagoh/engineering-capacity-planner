# Supabase Backend (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the capacity planner real per-user cloud persistence (one JSON document per user, private via RLS) behind an injectable storage seam, with the public demo shipping zero backend code.

**Architecture:** First remove array-index identity (stable `crypto.randomUUID()` ids on Engineer/Project/Team; `Project.team` becomes `string[]`) so nothing serializes positional identity. Then introduce a `StoragePort` whole-blob seam with a `LocalPort` (seeded, no-op save — today's demo) and a `SupabasePort` built on a thin `RowStore` sub-seam, fronted by a pure, heavily-tested load-boundary sanitizer. The store hydrates asynchronously (loading/ready/error) and autosaves debounced. A `VITE_BACKEND` flag dynamic-imports the Supabase adapter only in the real build.

**Tech Stack:** React 19, TypeScript, Vite 5, Vitest 2 (+ happy-dom for component tests), `@supabase/supabase-js`, Supabase Postgres + RLS.

**Spec:** `docs/superpowers/specs/2026-06-04-supabase-backend-phase-1-design.md`

**Branch:** `phase-1-backend` (already created off `main`).

**Conventions for this codebase:**
- Tests are colocated (`foo.ts` + `foo.test.ts`). Default Vitest env is `node`; UI tests that need a DOM start with the pragma `// @vitest-environment happy-dom`.
- Run a single test file: `npx vitest run src/path/file.test.ts`. Full suite: `npm test`.
- The green gate before any commit that finishes a task touching app code: `npm run typecheck && npm run lint && npm run lint:tokens && npm test`. The build gate (`npm run build`) runs at the milestone steps that call for it (the `tsc -b` build can fail where `typecheck` passes).
- `id` values in tests must be asserted by **shape/uniqueness**, never exact value (they are random).

---

## File Structure

New files:
- `src/engine/ids.ts` — `newId()` wrapper over `crypto.randomUUID()` (one place to stub if needed).
- `src/storage/types.ts` — `PersistedState`, `StoragePort`, `RowStore` interfaces.
- `src/storage/sanitize.ts` — pure `sanitize()` + `serialize()` (the load/save boundary logic).
- `src/storage/localPort.ts` — `LocalPort` (seeded load, no-op save).
- `src/storage/createStoragePort.ts` — factory selecting Local vs (dynamic) Supabase by `VITE_BACKEND`.
- `src/storage/supabasePort.ts` — `SupabasePort` + `SupabaseRowStore` (dynamic SDK import).
- `src/storage/client.ts` — lazy shared Supabase client.
- `src/storage/fakeRowStore.ts` — in-memory `RowStore` for tests (and its consumers).
- `src/components/Loading.tsx`, `src/components/LoadError.tsx`, `src/components/EmptyState.tsx` — the three new shell states.
- `supabase/schema.sql`, `.env.example`.

Modified:
- `src/engine/types.ts` — add `id` to Engineer/Project/Team; `Project.team: string[]`.
- `src/data/seed.ts` — assign ids; projects reference engineer ids.
- `src/engine/selectors.ts` — `personLoads` id-based; `PersonLoad` gains `id`.
- `src/state/store.tsx` — id-based actions; async hydration; `HYDRATE`/status; debounced autosave; injectable `port`.
- `src/components/Pills.tsx` — id-based items/selection.
- `src/screens/Manager.tsx`, `src/screens/Director.tsx` — id-based assignment/move wiring; stable keys.
- `src/App.tsx` — render loading/error/empty/ready.
- Tests across `state/`, `data/`, `engine/`, `export/` updated for ids.
- `package.json` — add pinned `@supabase/supabase-js`.

---

# Group A — Stable-ID refactor

## Task 1: `newId()` helper + ids on the type model (additive, non-breaking)

**Files:**
- Create: `src/engine/ids.ts`
- Create: `src/engine/ids.test.ts`
- Modify: `src/engine/types.ts`

- [ ] **Step 1: Write the failing test**

`src/engine/ids.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("returns a unique non-empty string each call", () => {
    const a = newId();
    const b = newId();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run it, expect fail**

Run: `npx vitest run src/engine/ids.test.ts`
Expected: FAIL — cannot resolve `./ids`.

- [ ] **Step 3: Implement**

`src/engine/ids.ts`:
```ts
// Single wrapper over the platform UUID so id generation has one call site.
export const newId = (): string => crypto.randomUUID();
```

- [ ] **Step 4: Run it, expect pass**

Run: `npx vitest run src/engine/ids.test.ts` → PASS.

- [ ] **Step 5: Add `id` fields to the model (Project.team stays number[] for now)**

In `src/engine/types.ts`, add an `id: string` field to each interface. Do **not** change `Project.team` yet (kept as `number[]` so this step compiles):
```ts
export interface Engineer {
  id: string;
  name: string;
  tenure: Tenure;
  level: Level;
  onboarding: Onboarding;
  alloc: Alloc;
}
```
```ts
export interface Project {
  id: string;
  name: string;
  est: number;       // person-months
  team: number[];    // indices into the team roster  (changes to string[] in Task 2)
}
```
```ts
export interface Team {
  id: string;
  name: string;
  roster: Engineer[];
  overhead: OverheadFactor[];
  ktlo: KtloFactor[];
  projects: Project[];
  window: Window;
}
```

- [ ] **Step 6: Typecheck — expect failures pointing only at object literals missing `id`**

Run: `npm run typecheck`
Expected: errors in `src/data/seed.ts`, `src/state/store.tsx` (NEW_ENGINEER, ADD_PROJECT), and any test literals — these are fixed in Step 7 and Task-level commits below. (This step just confirms the type change took.)

- [ ] **Step 7: Assign ids in the seed**

Rewrite `src/data/seed.ts` so the `e()` helper mints an id and projects still use indices (Task 2 flips them). Each team also gets an id:
```ts
import type { Team, Engineer, Project } from "../engine/types";
import { defaultOverhead, defaultKtlo } from "../engine/constants";
import { newId } from "../engine/ids";

export const CUR = 2; // Aurora open by default

const e = (
  name: string, tenure: Engineer["tenure"], level: Engineer["level"],
  onboarding: Engineer["onboarding"], alloc: Engineer["alloc"],
): Engineer => ({ id: newId(), name, tenure, level, onboarding, alloc });

const p = (name: string, est: number, team: number[]): Project => ({ id: newId(), name, est, team });

const team = (
  name: string, roster: Engineer[], projects: Project[],
): Team => ({
  id: newId(), name, window: "quarter",
  overhead: defaultOverhead(), ktlo: defaultKtlo(), roster, projects,
});

export const makeSeedTeams = (): Team[] => [
  team("Payments",
    [ e("Ana Idris", "> 4 years", "Staff", "Not Applicable", 1),
      e("Bo Rana", "2–4 years", "L3", "Not Applicable", 1),
      e("Cy Okafor", "1–2 years", "L3", "Not Applicable", 1),
      e("Dot Vance", "< 4 months", "L2", "New Hire: Month 2", 1) ],
    [ p("Card vault", 1.4, [0, 1]), p("Payout API", 1.0, [2]) ]),
  team("Growth",
    [ e("Devi Shah", "> 4 years", "L3", "Not Applicable", 1),
      e("Ed Lim", "2–4 years", "L3", "Not Applicable", 1) ],
    [ p("Referral loop", 0.9, [0]), p("Onboarding funnel", 0.5, [1]) ]),
  team("Aurora",
    [ e("Alex Rivera", "> 4 years", "L3", "Mentor: Month 1", 1),
      e("Sam Chen", "1–2 years", "L3", "Mentor: Month 1", 1),
      e("Jordan Lee", "> 4 years", "L3", "Not Applicable", 1),
      e("Priya Nair", "< 4 months", "L2", "New Hire: Month 3", 1),
      e("Diego Torres", "< 4 months", "Intern", "New Hire: Month 1", 0.5) ],
    [ p("Search revamp", 1.2, [0, 1]), p("Billing migration", 0.8, [2]), p("Onboarding tooling", 0.3, [3]) ]),
  team("Mobile",
    [ e("Fia Berg", "2–4 years", "L3", "Not Applicable", 1),
      e("Gabe Ross", "1–2 years", "L2", "Not Applicable", 1) ],
    [ p("App rewrite", 2.0, [0, 1]) ]),
  team("Data",
    [ e("Hana Cole", "> 4 years", "Staff", "Not Applicable", 1),
      e("Ivo Pak", "2–4 years", "L3", "Not Applicable", 1),
      e("Jed Moss", "1–2 years", "L3", "Not Applicable", 1) ],
    [ p("Warehouse v2", 1.4, [0, 1]) ]),
  team("Identity",
    [ e("Kit Snow", "2–4 years", "L3", "Not Applicable", 1),
      e("Lin Yu", "< 4 months", "L2", "New Hire: Month 2", 1) ],
    [ p("SSO revamp", 1.3, [0]) ]),
];
```

- [ ] **Step 8: Mint ids in the reducer's literal sources**

In `src/state/store.tsx`, import `newId` and change `NEW_ENGINEER` from a shared constant to a factory (a shared constant would reuse one id), and give new projects an id:
```ts
import { newId } from "../engine/ids";
```
Replace the `NEW_ENGINEER` constant and its use in `ADD_ENGINEER`:
```ts
const newEngineer = (): Engineer => ({
  id: newId(), name: "New engineer", tenure: "< 4 months", level: "L3", onboarding: "Not Applicable", alloc: 1,
});
```
```ts
    case "ADD_ENGINEER":
      return mapTeam(state, action.team, (t) => ({ ...t, roster: [...t.roster, newEngineer()] }));
```
In `ADD_PROJECT`:
```ts
    case "ADD_PROJECT":
      return mapTeam(state, action.team, (t) => ({ ...t, projects: [...t.projects, { id: newId(), name: "New project", est: 0.5, team: [] }] }));
```

- [ ] **Step 9: Add a seed uniqueness test**

Append to `src/data/seed.test.ts`:
```ts
it("assigns a unique id to every team, engineer, and project", () => {
  const teams = makeSeedTeams();
  const ids = [
    ...teams.map((t) => t.id),
    ...teams.flatMap((t) => t.roster.map((e) => e.id)),
    ...teams.flatMap((t) => t.projects.map((p) => p.id)),
  ];
  expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
});
```

- [ ] **Step 10: Fix any remaining literal-without-id typecheck errors in tests**

Run `npm run typecheck`. For EACH remaining error of the form "property 'id' is missing" on an inline `Engineer`/`Project`/`Team` literal in a `*.test.ts(x)` file, add `id: "..."` with a readable fixed string (tests may use fixed ids since they assert behavior, not seed randomness). Known sites to expect:
- `src/export/exporters.test.ts` — the `projects: [{ name, est, team: [] }]` literals → add `id: "p1"` etc.

Example transformation in `exporters.test.ts`:
```ts
// before: { name: 'A "quoted" name', est: 1, team: [] }
{ id: "p1", name: 'A "quoted" name', est: 1, team: [] }
```

- [ ] **Step 11: Green gate**

Run: `npm run typecheck && npm run lint && npm run lint:tokens && npm test`
Expected: all pass (Project.team is still `number[]`, so assignment logic is unchanged).

- [ ] **Step 12: Commit**
```bash
git add -A
git commit -m "refactor(ids): add stable crypto.randomUUID ids to teams/engineers/projects"
```

---

## Task 2: Flip `Project.team` to engineer ids (`string[]`)

**Files:**
- Modify: `src/engine/types.ts`, `src/data/seed.ts`, `src/engine/selectors.ts`, `src/state/store.tsx`, `src/components/Pills.tsx`, `src/screens/Manager.tsx`
- Tests: `src/engine/selectors.test.ts`, `src/state/store.test.tsx`, `src/components/primitives.test.tsx` (Pills)

- [ ] **Step 1: Write/adjust the failing test for id-based personLoads**

In `src/engine/selectors.test.ts`, replace the existing `personLoads` assignment test (the one constructing a team with `team: [0, ...]`) with an id-based version. Add:
```ts
import { newId } from "./ids";

it("personLoads splits a project estimate across assigned engineer ids", () => {
  const a = { id: "ea", name: "A", tenure: "> 4 years", level: "L3", onboarding: "Not Applicable", alloc: 1 } as const;
  const b = { id: "eb", name: "B", tenure: "> 4 years", level: "L3", onboarding: "Not Applicable", alloc: 1 } as const;
  const t = {
    id: "t1", name: "T", window: "quarter" as const,
    overhead: [], ktlo: [],
    roster: [a, b],
    projects: [{ id: "p1", name: "P", est: 2, team: ["ea", "eb"] }],
  };
  const loads = personLoads(t);
  expect(loads.find((l) => l.id === "ea")!.assignedPM).toBeCloseTo(1, 5);
  expect(loads.find((l) => l.id === "eb")!.assignedPM).toBeCloseTo(1, 5);
});
```
(Use `newId` import only if other tests in the file need it; the literal ids above are fine.)

- [ ] **Step 2: Run it, expect fail**

Run: `npx vitest run src/engine/selectors.test.ts`
Expected: FAIL — `l.id` undefined and/or `p.team.includes("ea")` is `false` because `team` is typed `number[]`.

- [ ] **Step 3: Change the type**

`src/engine/types.ts`:
```ts
export interface Project {
  id: string;
  name: string;
  est: number;       // person-months
  team: string[];    // engineer ids assigned to this project
}
```

- [ ] **Step 4: Update the seed to reference ids**

In `src/data/seed.ts`, change the `p()` helper so callers pass roster index positions but it stores ids. Replace the `p` helper and the `team()` helper so projects resolve indices against their own roster:
```ts
const p = (name: string, est: number, team: string[]): Project => ({ id: newId(), name, est, team });

const team = (
  name: string, roster: Engineer[], makeProjects: (ids: string[]) => Project[],
): Team => {
  const ids = roster.map((r) => r.id);
  return { id: newId(), name, window: "quarter", overhead: defaultOverhead(), ktlo: defaultKtlo(), roster, projects: makeProjects(ids) };
};
```
Then each team's projects become a callback using `ids`:
```ts
  team("Payments",
    [ e("Ana Idris", "> 4 years", "Staff", "Not Applicable", 1),
      e("Bo Rana", "2–4 years", "L3", "Not Applicable", 1),
      e("Cy Okafor", "1–2 years", "L3", "Not Applicable", 1),
      e("Dot Vance", "< 4 months", "L2", "New Hire: Month 2", 1) ],
    (id) => [ p("Card vault", 1.4, [id[0], id[1]]), p("Payout API", 1.0, [id[2]]) ]),
```
Apply the same pattern to all six teams (replace each `[ p(...), p(...) ]` array with `(id) => [ p(..., [id[0], ...]), ... ]`, mapping the previous numeric indices to `id[n]`):
- Growth: `(id) => [ p("Referral loop", 0.9, [id[0]]), p("Onboarding funnel", 0.5, [id[1]]) ]`
- Aurora: `(id) => [ p("Search revamp", 1.2, [id[0], id[1]]), p("Billing migration", 0.8, [id[2]]), p("Onboarding tooling", 0.3, [id[3]]) ]`
- Mobile: `(id) => [ p("App rewrite", 2.0, [id[0], id[1]]) ]`
- Data: `(id) => [ p("Warehouse v2", 1.4, [id[0], id[1]]) ]`
- Identity: `(id) => [ p("SSO revamp", 1.3, [id[0]]) ]`

- [ ] **Step 5: Update `personLoads` and `PersonLoad` to be id-based**

`src/engine/selectors.ts`:
```ts
export interface PersonLoad {
  id: string;
  name: string;
  assignedPM: number;
  personNet: number;
  pct: number;
  over: boolean;
}

export const personLoads = (t: Team): PersonLoad[] =>
  t.roster.map((e) => {
    const assignedPM = t.projects.reduce(
      (s, p) => s + (p.team.includes(e.id) ? p.est / p.team.length : 0),
      0,
    );
    const pNet = personNet(e, t);
    const pct = pNet > 0 ? (assignedPM / pNet) * 100 : 0;
    return { id: e.id, name: e.name, assignedPM, personNet: pNet, pct, over: pct > 100 };
  });
```

- [ ] **Step 6: Update `TOGGLE_ASSIGNMENT` to take a member id**

In `src/state/store.tsx`, change the action type and reducer case:
```ts
  | { type: "TOGGLE_ASSIGNMENT"; team: number; project: number; member: string }
```
```ts
    case "TOGGLE_ASSIGNMENT":
      return mapTeam(state, action.team, (t) => ({
        ...t,
        projects: t.projects.map((p, i) => {
          if (i !== action.project) return p;
          const has = p.team.includes(action.member);
          return { ...p, team: has ? p.team.filter((m) => m !== action.member) : [...p.team, action.member] };
        }),
      }));
```

- [ ] **Step 7: Make `Pills` id-based**

Replace `src/components/Pills.tsx` entirely:
```tsx
export function Pills({
  items, selected, onToggle,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ id, label }) => {
        const on = selected.includes(id);
        return (
          <button
            key={id}
            aria-pressed={on}
            onClick={() => onToggle(id)}
            className={`rounded-pill px-2.5 py-0.5 text-xs font-mono border transition-colors ${on ? "bg-matcha-tint border-matcha-tint-border text-matcha-deep" : "bg-oat border-line text-muted"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8: Update Manager's Pills wiring + the LoadBar key**

In `src/screens/Manager.tsx` (project assignment block ~line 315):
```tsx
                      <Pills
                        items={team.roster.map((e) => ({ id: e.id, label: e.name }))}
                        selected={project.team}
                        onToggle={(id) => dispatch({ type: "TOGGLE_ASSIGNMENT", team: ti, project: pi, member: id })}
                      />
```
And the per-person load list (~line 370-371) — key by id instead of name (names can collide):
```tsx
            {loads.map((load) => (
              <LoadBar key={load.id} name={load.name} pct={load.pct} over={load.over} />
            ))}
```

- [ ] **Step 9: Fix Pills test + any literal-team test data**

In `src/components/primitives.test.tsx`, update the Pills test to the new props shape. Replace the Pills render/assert with:
```tsx
const items = [ { id: "x", label: "Xena" }, { id: "y", label: "Yan" } ];
render(<Pills items={items} selected={["x"]} onToggle={() => {}} />);
expect(screen.getByRole("button", { name: "Xena" })).toHaveAttribute("aria-pressed", "true");
expect(screen.getByRole("button", { name: "Yan" })).toHaveAttribute("aria-pressed", "false");
```
In `src/state/store.test.tsx`, update any `TOGGLE_ASSIGNMENT` test to dispatch a `member` **id** (read it from the team's roster, e.g. `state.teams[0].roster[1].id`) and assert `project.team` contains/omits that id. Update any inline project literals from `team: [0]` to `team: [<engineerId>]`.

- [ ] **Step 10: Green gate**

Run: `npm run typecheck && npm run lint && npm run lint:tokens && npm test`
Expected: all pass.

- [ ] **Step 11: Commit**
```bash
git add -A
git commit -m "refactor(ids): Project.team references engineer ids (string[]) end-to-end"
```

---

## Task 3: Id-based remove/move (delete `reindexAfterRemoval`, fix move data-loss)

**Files:**
- Modify: `src/state/store.tsx`, `src/screens/Director.tsx`
- Tests: `src/state/store.test.tsx`

- [ ] **Step 1: Write failing tests for assignment survival**

Add to `src/state/store.test.tsx`:
```ts
it("REMOVE_ENGINEER drops that engineer's id from project assignments only", () => {
  let s = initialState();
  const team = 2; // Aurora
  const roster = s.teams[team].roster;
  const removedId = roster[0].id;     // Alex (assigned to "Search revamp")
  const keptId = roster[1].id;        // Sam   (also on "Search revamp")
  s = reducer(s, { type: "REMOVE_ENGINEER", team, index: 0 });
  const search = s.teams[team].projects.find((p) => p.name === "Search revamp")!;
  expect(search.team).not.toContain(removedId);
  expect(search.team).toContain(keptId);
  expect(s.teams[team].roster.some((e) => e.id === removedId)).toBe(false);
});

it("MOVE_ENGINEER preserves the engineer's identity and removes them from the source team", () => {
  let s = initialState();
  const fromTeam = 2, toTeam = 0;
  const movedId = s.teams[fromTeam].roster[2].id; // Jordan
  s = reducer(s, { type: "MOVE_ENGINEER", from: fromTeam, engineerId: movedId, to: toTeam });
  expect(s.teams[fromTeam].roster.some((e) => e.id === movedId)).toBe(false);
  expect(s.teams[toTeam].roster.some((e) => e.id === movedId)).toBe(true);
  // source projects no longer reference the moved id
  expect(s.teams[fromTeam].projects.some((p) => p.team.includes(movedId))).toBe(false);
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npx vitest run src/state/store.test.tsx`
Expected: FAIL — `MOVE_ENGINEER` still typed with `index`; `engineerId` not accepted.

- [ ] **Step 3: Rewrite the remove/move reducer cases by id**

In `src/state/store.tsx`: delete the `reindexAfterRemoval` helper. Change the `MOVE_ENGINEER` action type:
```ts
  | { type: "MOVE_ENGINEER"; from: number; engineerId: string; to: number }
```
Replace `REMOVE_ENGINEER` and `MOVE_ENGINEER` cases:
```ts
    case "REMOVE_ENGINEER": {
      const removedId = state.teams[action.team]?.roster[action.index]?.id;
      if (!removedId) return state;
      return mapTeam(state, action.team, (t) => ({
        ...t,
        roster: t.roster.filter((_, i) => i !== action.index),
        projects: t.projects.map((p) => ({ ...p, team: p.team.filter((id) => id !== removedId) })),
      }));
    }
    case "MOVE_ENGINEER": {
      if (action.from === action.to) return state;
      const person = state.teams[action.from]?.roster.find((e) => e.id === action.engineerId);
      if (!person) return state;
      let next = mapTeam(state, action.from, (t) => ({
        ...t,
        roster: t.roster.filter((e) => e.id !== action.engineerId),
        projects: t.projects.map((p) => ({ ...p, team: p.team.filter((id) => id !== action.engineerId) })),
      }));
      next = mapTeam(next, action.to, (t) => ({ ...t, roster: [...t.roster, person] }));
      return next;
    }
```

- [ ] **Step 4: Update Director's move dispatch**

In `src/screens/Director.tsx` (~line 46), the dispatch becomes id-based. `mvWho` remains a roster index for the `<select>`, translated to an id at dispatch:
```ts
    dispatch({ type: "MOVE_ENGINEER", from: mvFrom, engineerId: fromRoster[mvWho].id, to: mvTo });
```
Leave the `<select>` options keyed/valued by index as they are (they index `fromRoster`); they are local UI state, not persisted identity.

- [ ] **Step 5: Run tests, expect pass**

Run: `npx vitest run src/state/store.test.tsx` → PASS.

- [ ] **Step 6: Green gate**

Run: `npm run typecheck && npm run lint && npm run lint:tokens && npm test`

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "refactor(ids): id-based remove/move, drop reindexAfterRemoval, fix move assignment loss"
```

---

# Group B — Storage seam + sanitizer

## Task 4: Storage interfaces + pure sanitizer/serializer

**Files:**
- Create: `src/storage/types.ts`, `src/storage/sanitize.ts`, `src/storage/sanitize.test.ts`

- [ ] **Step 1: Define the interfaces**

`src/storage/types.ts`:
```ts
import type { Team } from "../engine/types";

export type PersistedState = { cur: number; teams: Team[] };

export interface StoragePort {
  load(): Promise<PersistedState | null>; // null = brand-new user, no document yet
  save(state: PersistedState): Promise<void>;
}

export interface RowStore {
  getRow(): Promise<unknown | null>; // raw jsonb for the current user, or null
  putRow(data: unknown): Promise<void>;
}

export const DOC_VERSION = 1;
```

- [ ] **Step 2: Write failing sanitizer tests**

`src/storage/sanitize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sanitize, serialize, DOC_VERSION } from "./sanitize";
import { makeSeedTeams } from "../data/seed";

describe("serialize", () => {
  it("wraps state with the doc version", () => {
    const doc = serialize({ cur: 1, teams: makeSeedTeams() });
    expect(doc).toMatchObject({ version: DOC_VERSION, cur: 1 });
    expect(Array.isArray((doc as { teams: unknown[] }).teams)).toBe(true);
  });
});

describe("sanitize", () => {
  it("returns null for a null row (brand-new user)", () => {
    expect(sanitize(null)).toBeNull();
  });

  it("round-trips a serialized document", () => {
    const state = { cur: 2, teams: makeSeedTeams() };
    const result = sanitize(serialize(state));
    expect(result!.cur).toBe(2);
    expect(result!.teams).toHaveLength(6);
  });

  it("clamps cur into range and to 0 when teams is empty", () => {
    expect(sanitize({ version: 1, cur: 99, teams: makeSeedTeams() })!.cur).toBe(5);
    expect(sanitize({ version: 1, cur: -3, teams: makeSeedTeams() })!.cur).toBe(0);
    expect(sanitize({ version: 1, cur: 4, teams: [] })!.cur).toBe(0);
  });

  it("accepts an empty teams array", () => {
    expect(sanitize({ version: 1, cur: 0, teams: [] })).toEqual({ cur: 0, teams: [] });
  });

  it("coerces/clamps invalid numeric fields", () => {
    const t = makeSeedTeams()[0];
    const dirty = {
      version: 1, cur: 0,
      teams: [{
        ...t,
        roster: [{ ...t.roster[0], alloc: 3 }],            // invalid alloc -> nearest valid (1)
        projects: [{ ...t.projects[0], est: -5, team: [] }], // negative est -> 0
        overhead: [{ key: "x", desc: "x", current: 250, ideal: -10 }], // clamp 0..100
      }],
    };
    const out = sanitize(dirty)!;
    expect(out.teams[0].roster[0].alloc).toBe(1);
    expect(out.teams[0].projects[0].est).toBe(0);
    expect(out.teams[0].overhead[0].current).toBe(100);
    expect(out.teams[0].overhead[0].ideal).toBe(0);
  });

  it("backfills a missing engineer id", () => {
    const t = makeSeedTeams()[0];
    const noId = { ...t, roster: [{ ...t.roster[0], id: undefined as unknown as string }] };
    const out = sanitize({ version: 1, cur: 0, teams: [noId] })!;
    expect(typeof out.teams[0].roster[0].id).toBe("string");
    expect(out.teams[0].roster[0].id.length).toBeGreaterThan(0);
  });

  it("throws on a non-null but unrecognized blob (never silently overwrite)", () => {
    expect(() => sanitize({ hello: "world" })).toThrow();
    expect(() => sanitize({ version: 2, cur: 0, teams: [] })).toThrow();
    expect(() => sanitize("garbage")).toThrow();
    expect(() => sanitize(42)).toThrow();
  });
});
```

- [ ] **Step 3: Run, expect fail**

Run: `npx vitest run src/storage/sanitize.test.ts`
Expected: FAIL — `./sanitize` not found.

- [ ] **Step 4: Implement the sanitizer**

`src/storage/sanitize.ts`:
```ts
import type { Team, Engineer, Alloc } from "../engine/types";
import type { PersistedState } from "./types";
import { DOC_VERSION } from "./types";
import { newId } from "../engine/ids";

export { DOC_VERSION } from "./types";

export function serialize(state: PersistedState): unknown {
  return { version: DOC_VERSION, cur: state.cur, teams: state.teams };
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, v));
};

const VALID_ALLOCS: Alloc[] = [1, 0.75, 0.5, 0.25];
const coerceAlloc = (a: unknown): Alloc => {
  const n = typeof a === "number" ? a : 1;
  return VALID_ALLOCS.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), 1 as Alloc);
};

const normEngineer = (e: Engineer): Engineer => ({
  ...e,
  id: e.id || newId(),
  alloc: coerceAlloc(e.alloc),
});

const normTeam = (t: Team): Team => ({
  ...t,
  id: t.id || newId(),
  roster: t.roster.map(normEngineer),
  projects: t.projects.map((p) => ({ ...p, id: p.id || newId(), est: clamp(p.est, 0, Number.MAX_SAFE_INTEGER, 0), team: [...p.team] })),
  overhead: t.overhead.map((f) => ({ ...f, current: clamp(f.current, 0, 100, 0), ideal: clamp(f.ideal, 0, 100, 0) })),
  ktlo: t.ktlo.map((f) => ({ ...f, current: clamp(f.current, 0, 100, 0), ideal: clamp(f.ideal, 0, 100, 0) })),
});

function isRecognized(raw: unknown): raw is { version: number; cur: unknown; teams: Team[] } {
  return (
    typeof raw === "object" && raw !== null &&
    (raw as { version?: unknown }).version === DOC_VERSION &&
    Array.isArray((raw as { teams?: unknown }).teams)
  );
}

export function sanitize(raw: unknown): PersistedState | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecognized(raw)) {
    throw new Error("Unrecognized stored document; refusing to load (would risk overwriting data).");
  }
  const teams = raw.teams.map(normTeam);
  const cur = teams.length === 0 ? 0 : clamp(raw.cur, 0, teams.length - 1, 0);
  return { cur, teams };
}
```

- [ ] **Step 5: Run, expect pass**

Run: `npx vitest run src/storage/sanitize.test.ts` → PASS (all cases).

- [ ] **Step 6: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(storage): load-boundary sanitizer + serializer (throws on unrecognized blob)"
```

---

## Task 5: `LocalPort` + `FakeRowStore` + `createStoragePort` (local only)

**Files:**
- Create: `src/storage/localPort.ts`, `src/storage/localPort.test.ts`, `src/storage/fakeRowStore.ts`, `src/storage/createStoragePort.ts`, `src/storage/createStoragePort.test.ts`

- [ ] **Step 1: Failing test for LocalPort**

`src/storage/localPort.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { LocalPort } from "./localPort";
import { CUR } from "../data/seed";

describe("LocalPort", () => {
  it("load() returns the seeded state at the default team", async () => {
    const s = await new LocalPort().load();
    expect(s!.cur).toBe(CUR);
    expect(s!.teams).toHaveLength(6);
  });
  it("save() is a no-op that resolves", async () => {
    await expect(new LocalPort().save({ cur: 0, teams: [] })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, expect fail.** `npx vitest run src/storage/localPort.test.ts`

- [ ] **Step 3: Implement LocalPort**

`src/storage/localPort.ts`:
```ts
import type { StoragePort, PersistedState } from "./types";
import { makeSeedTeams, CUR } from "../data/seed";

// The public demo: seeded, ephemeral, login-free. Saves go nowhere.
export class LocalPort implements StoragePort {
  async load(): Promise<PersistedState> {
    return { cur: CUR, teams: makeSeedTeams() };
  }
  async save(_state: PersistedState): Promise<void> {
    // intentional no-op
  }
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Implement FakeRowStore (test helper used here + Task 9)**

`src/storage/fakeRowStore.ts`:
```ts
import type { RowStore } from "./types";

// In-memory RowStore for tests. Optionally seeded with an initial row.
export class FakeRowStore implements RowStore {
  constructor(private row: unknown | null = null) {}
  async getRow(): Promise<unknown | null> {
    return this.row;
  }
  async putRow(data: unknown): Promise<void> {
    this.row = data;
  }
  peek(): unknown | null {
    return this.row;
  }
}
```

- [ ] **Step 6: Failing test for the factory (local branch)**

`src/storage/createStoragePort.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createStoragePort } from "./createStoragePort";
import { LocalPort } from "./localPort";

describe("createStoragePort", () => {
  it("returns a LocalPort when VITE_BACKEND is not 'supabase'", () => {
    // default test env has no VITE_BACKEND set
    expect(createStoragePort()).toBeInstanceOf(LocalPort);
  });
});
```

- [ ] **Step 7: Run, expect fail.**

- [ ] **Step 8: Implement the factory (Supabase branch added in Task 9)**

`src/storage/createStoragePort.ts`:
```ts
import type { StoragePort } from "./types";
import { LocalPort } from "./localPort";

export function createStoragePort(): StoragePort {
  if (import.meta.env.VITE_BACKEND === "supabase") {
    // Dynamic import keeps the Supabase SDK out of the local/demo bundle.
    // Implemented in Task 9.
    return makeDeferredSupabasePort();
  }
  return new LocalPort();
}

function makeDeferredSupabasePort(): StoragePort {
  let portP: Promise<StoragePort> | null = null;
  const get = () => (portP ??= import("./supabasePort").then((m) => m.createSupabasePort()));
  return {
    load: () => get().then((p) => p.load()),
    save: (s) => get().then((p) => p.save(s)),
  };
}
```
Note: until Task 9 creates `./supabasePort`, the `import("./supabasePort")` reference will not typecheck. To keep this task green, the `makeDeferredSupabasePort` body is only reachable when `VITE_BACKEND==='supabase'`, but the static `import()` specifier still needs the module to exist for `tsc -b`. Therefore **create a stub now** and flesh it out in Task 9:

`src/storage/supabasePort.ts` (stub):
```ts
import type { StoragePort } from "./types";

export function createSupabasePort(): StoragePort {
  throw new Error("Supabase backend not yet implemented");
}
```

- [ ] **Step 9: Run, expect pass.** `npx vitest run src/storage/createStoragePort.test.ts src/storage/localPort.test.ts`

- [ ] **Step 10: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(storage): LocalPort, FakeRowStore, and createStoragePort factory (local branch)"
```

---

# Group C — Async hydration, UI states, autosave

## Task 6: Async store hydration (loading/ready/error + injectable port)

**Files:**
- Modify: `src/state/store.tsx`
- Test: `src/state/store.test.tsx` (add a hydration suite — needs DOM)

- [ ] **Step 1: Failing hydration test**

Create `src/state/hydration.test.tsx` (DOM env):
```tsx
// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StoreProvider, useStore } from "./store";
import type { StoragePort, PersistedState } from "../storage/types";

function Probe() {
  const { state } = useStore();
  return <div data-testid="probe">{state.status}:{state.teams.length}</div>;
}

const portWith = (load: () => Promise<PersistedState | null>): StoragePort => ({
  load, save: async () => {},
});

describe("StoreProvider hydration", () => {
  it("goes loading -> ready and adopts loaded teams", async () => {
    const port = portWith(async () => ({ cur: 0, teams: [] }));
    render(<StoreProvider port={port}><Probe /></StoreProvider>);
    expect(screen.getByTestId("probe").textContent).toBe("loading:0");
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("ready:0"));
  });

  it("goes loading -> error when load rejects", async () => {
    const port = portWith(async () => { throw new Error("bad blob"); });
    render(<StoreProvider port={port}><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("error:0"));
  });

  it("treats a null load as an empty-but-ready document", async () => {
    const port = portWith(async () => null);
    render(<StoreProvider port={port}><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("ready:0"));
  });
});
```

- [ ] **Step 2: Run, expect fail** (`StoreProvider` has no `port` prop; no `status`).

Run: `npx vitest run src/state/hydration.test.tsx`

- [ ] **Step 3: Implement async hydration in `src/state/store.tsx`**

Extend `State`, `initialState`, add actions, and rework `StoreProvider`:
```ts
export type LoadStatus = "loading" | "ready" | "error";

export interface State {
  teams: Team[];
  cur: number;
  view: View;
  status: LoadStatus;
  saveError: boolean;
}

export const initialState = (): State => ({ teams: [], cur: 0, view: "manager", status: "loading", saveError: false });
```
Add to the `Action` union:
```ts
  | { type: "HYDRATE"; cur: number; teams: Team[] }
  | { type: "LOAD_ERROR" }
  | { type: "SET_SAVE_ERROR"; value: boolean }
```
Add reducer cases (top of the switch):
```ts
    case "HYDRATE":
      return { ...state, cur: action.cur, teams: action.teams, status: "ready" };
    case "LOAD_ERROR":
      return { ...state, status: "error" };
    case "SET_SAVE_ERROR":
      return { ...state, saveError: action.value };
```
Rework the provider to take an optional injected port and load on mount:
```tsx
import { useEffect, useRef } from "react";
import { createStoragePort } from "../storage/createStoragePort";
import type { StoragePort } from "../storage/types";

export function StoreProvider({ children, port }: { children: ReactNode; port?: StoragePort }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const portRef = useRef<StoragePort>(port ?? createStoragePort());

  useEffect(() => {
    let cancelled = false;
    portRef.current
      .load()
      .then((loaded) => {
        if (cancelled) return;
        dispatch({ type: "HYDRATE", cur: loaded?.cur ?? 0, teams: loaded?.teams ?? [] });
      })
      .catch(() => { if (!cancelled) dispatch({ type: "LOAD_ERROR" }); });
    return () => { cancelled = true; };
  }, []);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}
```
(Keep `port` on the provider only as a test/diagnostics seam; production passes nothing and gets `createStoragePort()`.)

- [ ] **Step 4: Run hydration test, expect pass.**

- [ ] **Step 5: Fix fallout in existing tests**

`initialState()` now starts empty/loading, so any test rendering `<StoreProvider>` and expecting seed data immediately will change. For component/screen tests (`App.test.tsx`, `Manager.test.tsx`, `Director.test.tsx`, `PM.test.tsx`, `topbar.test.tsx`, `a11y.test.tsx`) that need seeded data synchronously, render with an injected synchronous-seed port and await ready. Provide this shared helper:

Create `src/test/renderWithSeed.tsx`:
```tsx
import { render, waitFor, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { StoreProvider } from "../state/store";
import { LocalPort } from "../storage/localPort";

// Renders children inside a seeded, already-hydrated store.
export async function renderSeeded(ui: ReactElement) {
  const result = render(<StoreProvider port={new LocalPort()}>{ui}</StoreProvider>);
  await waitFor(() => expect(screen.queryByTestId("app-loading")).not.toBeInTheDocument());
  return result;
}
```
Update each screen test to use `await renderSeeded(<Manager />)` etc. (Reducer-only tests in `store.test.tsx` call `reducer(initialState(), ...)` — but note `initialState()` now has empty teams. Those reducer tests must seed explicitly: replace `initialState()` with a ready seeded state.) Add this helper to `store.test.tsx`:
```ts
import { makeSeedTeams, CUR } from "../data/seed";
const seeded = (): State => ({ teams: makeSeedTeams(), cur: CUR, view: "manager", status: "ready", saveError: false });
```
and replace `initialState()` with `seeded()` in the existing reducer tests (the new Task 3 tests already call `initialState()` — change those to `seeded()` as well).

- [ ] **Step 6: Green gate**

Run: `npm run typecheck && npm run lint && npm run lint:tokens && npm test`
Expected: all pass.

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat(store): async hydration with loading/ready/error and injectable port"
```

---

## Task 7: Shell states — Loading / LoadError / EmptyState

**Files:**
- Create: `src/components/Loading.tsx`, `src/components/LoadError.tsx`, `src/components/EmptyState.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx` (extend)

- [ ] **Step 1: Failing tests for the shell states**

Replace/extend `src/App.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";
import { StoreProvider } from "./state/store";
import { Shell } from "./App";
import type { StoragePort } from "./storage/types";

const port = (load: StoragePort["load"]): StoragePort => ({ load, save: async () => {} });

describe("App shell states", () => {
  it("shows loading then the app for a seeded ready state", async () => {
    render(<StoreProvider port={port(async () => ({ cur: 2, teams: (await import("./data/seed")).makeSeedTeams() }))}><Shell /></StoreProvider>);
    expect(screen.getByTestId("app-loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Aurora")).toBeInTheDocument());
  });

  it("shows the empty state when ready with zero teams", async () => {
    render(<StoreProvider port={port(async () => null)}><Shell /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId("app-empty")).toBeInTheDocument());
    expect(screen.getByText(/no teams yet/i)).toBeInTheDocument();
  });

  it("shows the load-error state when load fails", async () => {
    render(<StoreProvider port={port(async () => { throw new Error("x"); })}><Shell /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId("app-error")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run, expect fail** (no `Shell` export, no testids).

- [ ] **Step 3: Implement the three components**

`src/components/Loading.tsx`:
```tsx
export function Loading() {
  return (
    <div data-testid="app-loading" className="mx-auto max-w-[1180px] px-6 py-16 text-muted" role="status" aria-live="polite">
      Loading your plan…
    </div>
  );
}
```
`src/components/LoadError.tsx`:
```tsx
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-testid="app-error" className="mx-auto max-w-[1180px] px-6 py-16" role="alert">
      <div className="font-serif text-2xl text-ink">Couldn’t load your plan</div>
      <p className="mt-2 text-muted">Your saved data could not be read. Your data has not been changed.</p>
      <button onClick={onRetry} className="mt-4 rounded-pill border border-line px-3 py-1 text-sm text-ink">
        Try again
      </button>
    </div>
  );
}
```
`src/components/EmptyState.tsx`:
```tsx
export function EmptyState() {
  return (
    <div data-testid="app-empty" className="mx-auto max-w-[1180px] px-6 py-16">
      <div className="font-serif text-2xl text-ink">No teams yet</div>
      <p className="mt-2 text-muted">Your account is ready. Creating your first team arrives in the next release.</p>
    </div>
  );
}
```

- [ ] **Step 4: Rework `src/App.tsx` to branch on status/teams**

```tsx
import { StoreProvider, useStore } from "./state/store";
import { TopBar } from "./components/TopBar";
import { Manager } from "./screens/Manager";
import { Director } from "./screens/Director";
import { PM } from "./screens/PM";
import { Loading } from "./components/Loading";
import { LoadError } from "./components/LoadError";
import { EmptyState } from "./components/EmptyState";

function ActiveView() {
  const { state } = useStore();
  if (state.view === "director") return <Director />;
  if (state.view === "pm") return <PM />;
  return <Manager />;
}

export function Shell() {
  const { state } = useStore();
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <LoadError onRetry={() => location.reload()} />;
  if (state.teams.length === 0) return <EmptyState />;
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <ActiveView />
      </main>
    </>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
```
This guarantees `TopBar`/`Manager`/`ExportMenu` never dereference `teams[cur]` with zero teams.

- [ ] **Step 5: Run, expect pass.** `npx vitest run src/App.test.tsx`

- [ ] **Step 6: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test
git add -A
git commit -m "feat(shell): loading / load-error / empty-state screens above the data gate"
```

---

## Task 8: Debounced autosave

**Files:**
- Modify: `src/state/store.tsx`
- Test: `src/state/autosave.test.tsx`

- [ ] **Step 1: Failing autosave test (fake timers)**

`src/state/autosave.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { StoreProvider, useStore } from "./store";
import type { StoragePort, PersistedState } from "../storage/types";
import { makeSeedTeams } from "../data/seed";

function Editor() {
  const { state, dispatch } = useStore();
  return (
    <button onClick={() => dispatch({ type: "ADD_PROJECT", team: state.cur })}>add</button>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("autosave", () => {
  it("debounces save() after edits once ready", async () => {
    const saved: PersistedState[] = [];
    const port: StoragePort = {
      load: async () => ({ cur: 0, teams: makeSeedTeams() }),
      save: async (s) => { saved.push(s); },
    };
    render(<StoreProvider port={port}><Editor /></StoreProvider>);
    // let load() microtask resolve into HYDRATE
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const before = saved.length;
    await act(async () => {
      document.querySelector("button")!.click();
      document.querySelector("button")!.click();
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(saved.length).toBe(before + 1); // two rapid edits coalesce into one save
    expect(saved[saved.length - 1].teams[0].projects.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, expect fail** (no save triggered).

- [ ] **Step 3: Add the debounced autosave effect to `StoreProvider`**

In `src/state/store.tsx`, after the load effect:
```tsx
  useEffect(() => {
    if (state.status !== "ready") return;
    const handle = setTimeout(() => {
      portRef.current
        .save({ cur: state.cur, teams: state.teams })
        .then(() => dispatch({ type: "SET_SAVE_ERROR", value: false }))
        .catch(() => dispatch({ type: "SET_SAVE_ERROR", value: true }));
    }, 600);
    return () => clearTimeout(handle);
  }, [state.teams, state.cur, state.status]);
```
(The debounce: each edit resets the 600 ms timer; only the last fires. `state.view` is intentionally NOT a dependency — it isn't persisted.)

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Surface save errors in the TopBar (non-blocking)**

In `src/components/TopBar.tsx`, read `saveError` from state and render a small indicator when true (place near the existing window control; tokens-only, no raw hex):
```tsx
  const { state, dispatch } = useStore();
  // ...
  {state.saveError && (
    <span role="status" className="text-xs text-muted">Couldn’t save — retrying on next edit</span>
  )}
```
Add a test in `src/components/topbar.test.tsx` rendering a seeded store whose port `save` rejects, asserting the indicator appears after an edit + debounce (mirror the autosave test's timer pattern). Keep it minimal.

- [ ] **Step 6: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test
git add -A
git commit -m "feat(store): debounced autosave with non-blocking save-error indicator"
```

---

# Group D — Supabase adapter, flag, schema

## Task 9: Supabase adapter (real `supabasePort` + client) behind the dynamic import

**Files:**
- Modify: `package.json` (add dep), `src/storage/supabasePort.ts` (replace stub)
- Create: `src/storage/client.ts`, `src/storage/supabasePort.test.ts`

- [ ] **Step 1: Add the SDK dependency (exact-pinned, per Phase 0 convention)**

Run (from `web/`, `.npmrc` already sets `ignore-scripts=true`):
```bash
npm install @supabase/supabase-js
```
Then pin it: read the resolved version and rewrite the `package.json` entry from `^x.y.z` to the exact `x.y.z`. Confirm `node -e "console.log(require('./package-lock.json').packages['node_modules/@supabase/supabase-js'].version)"` matches the pinned value. Re-verify the lock still has 25 `@rollup/rollup-*` entries (Phase 0 caveat).

- [ ] **Step 2: Failing test for SupabasePort against FakeRowStore**

`src/storage/supabasePort.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SupabasePort } from "./supabasePort";
import { FakeRowStore } from "./fakeRowStore";
import { serialize } from "./sanitize";
import { makeSeedTeams } from "../data/seed";

describe("SupabasePort", () => {
  it("load() returns null for a brand-new (empty) row store", async () => {
    expect(await new SupabasePort(new FakeRowStore(null)).load()).toBeNull();
  });

  it("save() then load() round-trips through the row store", async () => {
    const rows = new FakeRowStore(null);
    const port = new SupabasePort(rows);
    await port.save({ cur: 1, teams: makeSeedTeams() });
    const out = await port.load();
    expect(out!.cur).toBe(1);
    expect(out!.teams).toHaveLength(6);
    expect((rows.peek() as { version: number }).version).toBe(1);
  });

  it("load() throws on an unrecognized stored row", async () => {
    await expect(new SupabasePort(new FakeRowStore({ junk: true })).load()).rejects.toThrow();
  });

  it("load() reads a pre-seeded valid row", async () => {
    const rows = new FakeRowStore(serialize({ cur: 0, teams: [] }));
    expect(await new SupabasePort(rows).load()).toEqual({ cur: 0, teams: [] });
  });
});
```

- [ ] **Step 3: Run, expect fail** (stub `SupabasePort` not exported).

- [ ] **Step 4: Implement the client and the real port**

`src/storage/client.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Lazily build one shared client (data + auth). Anon/publishable key only.
export async function getClient(): Promise<SupabaseClient> {
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase env not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
    client = createClient(url, key);
  }
  return client;
}
```
`src/storage/supabasePort.ts` (replace the stub):
```ts
import type { StoragePort, RowStore, PersistedState } from "./types";
import { sanitize, serialize } from "./sanitize";
import { getClient } from "./client";

export class SupabasePort implements StoragePort {
  constructor(private rows: RowStore) {}
  async load(): Promise<PersistedState | null> {
    return sanitize(await this.rows.getRow());
  }
  async save(state: PersistedState): Promise<void> {
    await this.rows.putRow(serialize(state));
  }
}

// Thin network binding. Logic lives in SupabasePort/sanitize (tested via FakeRowStore).
class SupabaseRowStore implements RowStore {
  async getRow(): Promise<unknown | null> {
    const c = await getClient();
    const { data: auth } = await c.auth.getUser();
    if (!auth.user) return null; // no session yet (login arrives in Phase 2)
    const { data, error } = await c.from("app_data").select("data").eq("owner", auth.user.id).maybeSingle();
    if (error) throw error;
    return (data as { data?: unknown } | null)?.data ?? null;
  }
  async putRow(data: unknown): Promise<void> {
    const c = await getClient();
    const { data: auth } = await c.auth.getUser();
    if (!auth.user) throw new Error("Not authenticated");
    const { error } = await c.from("app_data").upsert({ owner: auth.user.id, data, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
}

export function createSupabasePort(): StoragePort {
  return new SupabasePort(new SupabaseRowStore());
}
```

- [ ] **Step 5: Run, expect pass.** `npx vitest run src/storage/supabasePort.test.ts`

- [ ] **Step 6: Green gate + commit**
```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "feat(storage): Supabase adapter (SupabasePort + RowStore) behind the dynamic import"
```

---

## Task 10: Schema, env example, type declarations for VITE_* vars

**Files:**
- Create: `supabase/schema.sql`, `web/.env.example`, `web/src/vite-env.d.ts` (or extend existing)

- [ ] **Step 1: Declare the env vars for TypeScript**

If `src/vite-env.d.ts` does not already declare them, create/extend it so `import.meta.env.VITE_*` typechecks:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND?: "local" | "supabase";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Write the schema**

`supabase/schema.sql`:
```sql
-- One JSON document per user. Run this in the Supabase SQL editor.
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

- [ ] **Step 3: Write the env example**

`web/.env.example`:
```bash
# Backend selector: "local" (default, seeded demo, no login) or "supabase" (the real app).
VITE_BACKEND=supabase

# Supabase project — publishable/anon key ONLY. Never the service_role key.
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 4: Typecheck + commit**
```bash
npm run typecheck
git add -A supabase/schema.sql web/.env.example web/src/vite-env.d.ts
git commit -m "feat(supabase): schema.sql, .env.example, and VITE_* env typings"
```

---

## Task 11: Bundle hygiene + full milestone verification

**Files:** none (verification + a guard script)

- [ ] **Step 1: Build the demo (local) bundle and assert no Supabase chunk**

Run:
```bash
npm run build
```
Then verify the local build excludes the SDK:
```bash
grep -rl "supabase" dist/assets || echo "OK: no supabase in local bundle"
```
Expected: `OK: no supabase in local bundle`. (With `VITE_BACKEND` unset/local, the `import("./supabasePort")` branch is statically dead and Rollup drops it.) Record the demo bundle JS size; it should be within a few KB of the pre-Phase-1 size (~243 KB).

- [ ] **Step 2: Build the supabase bundle and assert the SDK is split into its own chunk**

Run:
```bash
VITE_BACKEND=supabase npm run build
ls dist/assets
grep -rl "supabase" dist/assets >/dev/null && echo "OK: supabase present in supabase build"
```
Expected: a separate chunk contains the SDK (loaded only when the supabase port is first used), and the entry chunk is not bloated by it. Then restore the default build: `npm run build`.

- [ ] **Step 3: Full green gate (the real build, per the Phase 0 gotcha)**

Run:
```bash
npm run typecheck && npm run lint && npm run lint:tokens && npm test && npm run build
```
Expected: all green; `npm audit --omit=dev` still 0 (run it to confirm the new SDK dep added no production advisory):
```bash
npm audit --omit=dev
```

- [ ] **Step 4: Commit any incidental fixes, then stop for the human step**

```bash
git add -A
git commit -m "chore(phase-1): verify bundle hygiene (no SDK in demo build) and full green gate" --allow-empty
```

---

## Human-in-the-loop (after the plan is green)

Pause and hand the user exact values:
1. Create a Supabase project (free tier).
2. Run `supabase/schema.sql` in the SQL editor.
3. Put `VITE_SUPABASE_URL` + anon key into `web/.env` (copy `.env.example`).

The real end-to-end Supabase round-trip is verified after **Phase 2** adds login (there is no session yet, so `SupabaseRowStore.getRow()` returns `null` until then — the plumbing is proven here via `FakeRowStore`).

---

## Self-Review (completed)

- **Spec coverage:** stable-ID refactor (Tasks 1–3), persisted shape `{version,cur,teams}` (Task 4 `serialize`), seam `StoragePort`/`RowStore`/`PersistedState` (Tasks 4–5), sanitizer null/normalize/throw (Task 4), async hydration + loading/error/empty (Tasks 6–7), debounced autosave + save-error indicator (Task 8), `VITE_BACKEND` flag + dynamic SDK import + bundle hygiene (Tasks 5, 9, 11), Supabase adapter + client (Task 9), schema + `.env.example` (Task 10), human step (end). All spec sections map to tasks.
- **Placeholders:** none — every code step shows full code. The Task 5 `supabasePort` stub is intentional and is replaced in Task 9 (called out explicitly).
- **Type consistency:** `PersistedState = {cur, teams}` used identically in `types.ts`, `sanitize`, `LocalPort`, `SupabasePort`, hydration; `StoragePort.load(): Promise<PersistedState | null>` consistent across factory/ports/provider; `TOGGLE_ASSIGNMENT.member: string` and `MOVE_ENGINEER.engineerId: string` consistent between store and screens; `PersonLoad.id` added in Task 2 and used by Manager's `LoadBar key`.
