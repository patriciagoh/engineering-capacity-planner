# Capacity Web App (Frontend) Implementation Plan — Plan 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The usable product — a local web app an engineering manager opens to plan a quarter against real capacity (per-engineer effective capacity, demand fit, risks), run what-if scenarios with a live fit readout, and a director roll-up read across teams.

**Architecture:** A Vite + React + TypeScript SPA in `web/` that talks to the existing FastAPI server (Plan 2) over HTTP. The frontend renders and orchestrates; it **never recomputes capacity math** — all numbers come from the API (which gets them from the engine). One small server addition exposes per-engineer effective capacity so the roster view can show it without the client reimplementing multipliers. Components are presentational + tested with Vitest + React Testing Library; pages compose them and fetch via a typed API client.

**Tech Stack:** Python/FastAPI (existing server, one new endpoint), Node 20 + Vite + React 18 + TypeScript, Vitest + @testing-library/react + jsdom for tests. Plain CSS (no UI/chart library) — capacity bars are CSS widths.

---

## Context for the implementer

- The API (Plan 2, on `main`) exposes: `GET /org`, `POST /org`, `GET /teams/{id}/plan`, `POST /teams/{id}/scenario`, `GET /groups/{id}/rollup`. Response shapes are produced by `server/capacity_server/serialize.py` — read it for exact field names (`team_plan` has `team_id, team_name, gross_pm, net_pm, demand{low,expected,high}, fit{net_pm,demand,optimistic_delta,expected_delta,pessimistic_delta,is_oversubscribed_expected}, risks[{kind,severity,detail}]`; `rollup` has `group_id, group_name, total_gross_pm, total_net_pm, total_demand, fit, team_plans[]`).
- `GET /org` returns the full org via `org_to_dict` (teams, engineers with `assignments[{team_id,availability}]` and `level`/`onboarding_state`, deliverables with `owner_ids`/`estimate`, groups).
- The engine exposes `effective_capacity(engineer, team_id, baseline_factor=DEFAULT_BASELINE_FACTOR)` and `DEFAULT_BASELINE_FACTOR` (0.71).
- Server venv: `server/.venv`. Run server tests: `cd server && . .venv/bin/activate && pytest -q`.
- Run the server live: `cd server && . .venv/bin/activate && uvicorn 'capacity_server.app:create_app' --factory --port 8000` then `POST /org` the sample to seed it. For dev convenience this plan adds a seeded entrypoint too.
- Work from `/Users/patricia/capacity-planning` on a feature branch.

## File Structure

```
capacity-planning/
  server/capacity_server/
    routes.py        # MODIFY: add GET /teams/{id}/roster
    serialize.py     # MODIFY: add roster_to_dict / engineer_capacity_to_dict
    app_seeded.py    # NEW: factory seeded from data/sample_org.json (live dev convenience)
  web/
    package.json, vite.config.ts, tsconfig.json, index.html, .gitignore
    src/
      main.tsx                 # React entry
      api/client.ts            # typed fetch wrapper + response types
      api/types.ts             # TS interfaces mirroring serialize.py
      components/FitBar.tsx     # net vs demand range, color by oversubscription
      components/RosterTable.tsx
      components/DeliverablesList.tsx
      components/RisksList.tsx
      components/ScenarioPanel.tsx
      pages/ManagerView.tsx
      pages/DirectorView.tsx
      App.tsx                  # persona/team/group routing (simple state, no router dep)
      index.css
      test/setup.ts            # jest-dom
    src/**/*.test.tsx          # Vitest component/page tests
```

---

## Task 1: Server — per-engineer effective capacity endpoint

**Files:**
- Modify: `server/capacity_server/serialize.py`
- Modify: `server/capacity_server/routes.py`
- Test: `server/tests/test_roster.py`

- [ ] **Step 1: Write the failing test**

File: `server/tests/test_roster.py`
```python
def test_roster_msg_effective_capacity(client):
    resp = client.get("/teams/msg/roster")
    assert resp.status_code == 200
    body = resp.json()
    rows = {r["engineer_id"]: r for r in body["roster"]}
    assert set(rows) == {"dia", "claudia", "albert"}
    # Dia: L3 (1.0) x none (1.0) x avail 1.0 x 0.71 baseline = 0.71
    assert rows["dia"]["effective_capacity"] == __import__("pytest").approx(0.71, abs=1e-3)
    # Albert: L2 (1.0) x avail 0.5 x 0.71 = 0.355
    assert rows["albert"]["effective_capacity"] == __import__("pytest").approx(0.355, abs=1e-3)
    assert rows["dia"]["level"] == "L3"
    assert rows["albert"]["availability"] == __import__("pytest").approx(0.5)


def test_roster_unknown_team_404(client):
    assert client.get("/teams/ghost/roster").status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && . .venv/bin/activate && pytest tests/test_roster.py -q`
Expected: FAIL — no `/teams/{id}/roster` route.

- [ ] **Step 3: Add `roster_to_dict` to `server/capacity_server/serialize.py`**

```python
from capacity_engine.capacity import DEFAULT_BASELINE_FACTOR, effective_capacity
from capacity_engine.models import Engineer, Org


def engineer_capacity_to_dict(eng: Engineer, team_id: str) -> dict:
    return {
        "engineer_id": eng.id,
        "name": eng.name,
        "level": eng.level.value,
        "onboarding_state": eng.onboarding_state.value,
        "availability": eng.availability_on(team_id),
        "effective_capacity": effective_capacity(eng, team_id, DEFAULT_BASELINE_FACTOR),
    }


def roster_to_dict(org: Org, team_id: str) -> dict:
    team = org.team(team_id)  # raises KeyError if unknown
    return {
        "team_id": team.id,
        "team_name": team.name,
        "roster": [
            engineer_capacity_to_dict(e, team_id) for e in org.engineers_on(team_id)
        ],
    }
```
(Add these alongside the existing serialize helpers; keep the existing ones unchanged. The new imports go at the top of the file.)

- [ ] **Step 4: Add the route to `server/capacity_server/routes.py`**

Add import: `from capacity_server.serialize import roster_to_dict` (alongside the existing serialize imports). Add handler:
```python
@router.get("/teams/{team_id}/roster")
def get_team_roster(team_id: str, request: Request) -> dict:
    try:
        return roster_to_dict(_store(request).get(), team_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown team: {team_id}") from exc
```

- [ ] **Step 5: Run to verify pass**

Run: `cd server && . .venv/bin/activate && pytest tests/test_roster.py -q`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add server/capacity_server/serialize.py server/capacity_server/routes.py server/tests/test_roster.py
git commit -m "feat(server): GET /teams/{id}/roster with per-engineer effective capacity"
```

---

## Task 2: Server — seeded live entrypoint

**Files:**
- Create: `server/capacity_server/app_seeded.py`
- Test: `server/tests/test_app_seeded.py`

A factory that loads `data/sample_org.json` so `uvicorn` serves a populated org for live frontend dev (the bare `create_app` is empty by design).

- [ ] **Step 1: Write the failing test**

File: `server/tests/test_app_seeded.py`
```python
from fastapi.testclient import TestClient
from capacity_server.app_seeded import create_seeded_app


def test_seeded_app_has_sample_org():
    c = TestClient(create_seeded_app())
    body = c.get("/org").json()
    assert {t["id"] for t in body["teams"]} == {"msg", "email"}
    assert c.get("/teams/msg/plan").status_code == 200
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && . .venv/bin/activate && pytest tests/test_app_seeded.py -q`
Expected: FAIL — `ModuleNotFoundError: capacity_server.app_seeded`.

- [ ] **Step 3: Write `server/capacity_server/app_seeded.py`**

```python
"""Factory that serves the bundled sample org — for local frontend dev:
    uvicorn 'capacity_server.app_seeded:create_seeded_app' --factory --port 8000
"""
from pathlib import Path

from fastapi.middleware.cors import CORSMiddleware

from capacity_engine.store import load_org
from capacity_server.app import create_app

SAMPLE = Path(__file__).parent.parent / "data" / "sample_org.json"


def create_seeded_app():
    app = create_app(org=load_org(SAMPLE))
    # The Vite dev server proxies the API, but allow direct cross-origin dev too.
    app.add_middleware(
        CORSMiddleware, allow_origins=["http://localhost:5173"],
        allow_methods=["*"], allow_headers=["*"],
    )
    return app
```

- [ ] **Step 4: Run to verify pass**

Run: `cd server && . .venv/bin/activate && pytest tests/test_app_seeded.py -q`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add server/capacity_server/app_seeded.py server/tests/test_app_seeded.py
git commit -m "feat(server): seeded live entrypoint for frontend dev"
```

---

## Task 3: Frontend scaffold + Vitest

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.node.json`, `web/index.html`, `web/.gitignore`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`, `web/src/test/setup.ts`, `web/src/App.test.tsx`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "capacity-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `web/.gitignore`**

```
node_modules/
dist/
*.local
```

- [ ] **Step 3: Create `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Capacity Planning</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `web/tsconfig.json` and `web/tsconfig.node.json`**

`web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```
`web/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `web/vite.config.ts`** (dev proxy to the API + Vitest config)

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/org": API,
      "/teams": API,
      "/groups": API,
      "/health": API,
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 6: Create `web/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 7: Create `web/src/index.css`** (minimal)

```css
:root { font-family: system-ui, sans-serif; color: #1a1a1a; }
body { margin: 0; padding: 1.5rem; background: #fafafa; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 0.35rem 0.6rem; border-bottom: 1px solid #eee; }
.bar { height: 0.8rem; border-radius: 3px; background: #4a90d9; }
.bar-track { background: #eee; border-radius: 3px; width: 100%; }
.fit-ok { color: #137333; } .fit-risk { color: #c5221f; }
.card { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
button { cursor: pointer; }
```

- [ ] **Step 8: Create `web/src/main.tsx` and `web/src/App.tsx`**

`web/src/App.tsx`:
```tsx
export default function App() {
  return <h1>Capacity Planning</h1>;
}
```
`web/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: Write the smoke test `web/src/App.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the app title", () => {
  render(<App />);
  expect(screen.getByText("Capacity Planning")).toBeInTheDocument();
});
```

- [ ] **Step 10: Install and run**

Run:
```bash
cd web && npm install && npm test
```
Expected: install succeeds; Vitest runs `App.test.tsx` → 1 passed.

- [ ] **Step 11: Commit**

```bash
git add web/ ':!web/node_modules'
git commit -m "feat(web): scaffold Vite+React+TS app with Vitest"
```

---

## Task 4: API client + types

**Files:**
- Create: `web/src/api/types.ts`, `web/src/api/client.ts`
- Test: `web/src/api/client.test.ts`

- [ ] **Step 1: Write the failing test**

File: `web/src/api/client.test.ts`
```ts
import { afterEach, expect, test, vi } from "vitest";
import { getTeamPlan, getTeamRoster, postScenario } from "./client";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok, status, json: async () => body,
  } as Response);
}

test("getTeamPlan fetches and returns the plan", async () => {
  const plan = { team_id: "msg", team_name: "Msg", gross_pm: 5.3, net_pm: 1.6,
    demand: { low: 2, expected: 3, high: 4 },
    fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 },
      optimistic_delta: -0.4, expected_delta: -1.4, pessimistic_delta: -2.4,
      is_oversubscribed_expected: true }, risks: [] };
  vi.stubGlobal("fetch", mockFetch(plan));
  const out = await getTeamPlan("msg");
  expect(out.team_id).toBe("msg");
  expect(globalThis.fetch).toHaveBeenCalledWith("/teams/msg/plan");
});

test("getTeamRoster fetches roster rows", async () => {
  const body = { team_id: "msg", team_name: "Msg",
    roster: [{ engineer_id: "dia", name: "Dia", level: "L3",
      onboarding_state: "none", availability: 1, effective_capacity: 0.71 }] };
  vi.stubGlobal("fetch", mockFetch(body));
  const out = await getTeamRoster("msg");
  expect(out.roster[0].effective_capacity).toBe(0.71);
});

test("postScenario POSTs changes and returns plan+delta", async () => {
  const body = { plan: {}, baseline: {}, delta: { gross_pm: 0, net_pm: 1.6, expected_delta: 1.6 } };
  const f = mockFetch(body);
  vi.stubGlobal("fetch", f);
  const out = await postScenario("msg", [{ op: "set_reservation", team_id: "msg", name: "KTLO", fraction: 0.4 }]);
  expect(out.delta.net_pm).toBe(1.6);
  expect(f).toHaveBeenCalledWith("/teams/msg/scenario", expect.objectContaining({ method: "POST" }));
});

test("throws on non-ok response", async () => {
  vi.stubGlobal("fetch", mockFetch({ detail: "unknown team: ghost" }, false, 404));
  await expect(getTeamPlan("ghost")).rejects.toThrow(/unknown team/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run src/api/client.test.ts`
Expected: FAIL — module `./client` not found.

- [ ] **Step 3: Write `web/src/api/types.ts`**

```ts
export interface DemandRange { low: number; expected: number; high: number; }

export interface Fit {
  net_pm: number;
  demand: DemandRange;
  optimistic_delta: number;
  expected_delta: number;
  pessimistic_delta: number;
  is_oversubscribed_expected: boolean;
}

export interface Risk { kind: string; severity: "low" | "medium" | "high"; detail: string; }

export interface TeamPlan {
  team_id: string;
  team_name: string;
  gross_pm: number;
  net_pm: number;
  demand: DemandRange;
  fit: Fit;
  risks: Risk[];
}

export interface RosterRow {
  engineer_id: string;
  name: string;
  level: string;
  onboarding_state: string;
  availability: number;
  effective_capacity: number;
}

export interface TeamRoster { team_id: string; team_name: string; roster: RosterRow[]; }

export interface ScenarioResult {
  plan: TeamPlan;
  baseline: TeamPlan;
  delta: { gross_pm: number; net_pm: number; expected_delta: number };
}

export interface GroupRollup {
  group_id: string;
  group_name: string;
  total_gross_pm: number;
  total_net_pm: number;
  total_demand: DemandRange;
  fit: Fit;
  team_plans: TeamPlan[];
}

export interface OrgDeliverable {
  id: string; title: string; type: string; priority: number;
  owner_ids: string[]; estimate: Record<string, unknown>;
}
export interface Org {
  teams: { id: string; name: string; productive_weeks: number; group_id: string | null }[];
  engineers: { id: string; name: string; level: string }[];
  deliverables: OrgDeliverable[];
  groups: { id: string; name: string; parent_id: string | null }[];
}

export type Change = Record<string, unknown> & { op: string };
```

- [ ] **Step 4: Write `web/src/api/client.ts`**

```ts
import type { GroupRollup, Org, ScenarioResult, TeamPlan, TeamRoster, Change } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function getJSON<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`);
  if (!resp.ok) throw new Error(await errorDetail(resp));
  return (await resp.json()) as T;
}

async function postJSON<T>(path: string, payload: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(await errorDetail(resp));
  return (await resp.json()) as T;
}

async function errorDetail(resp: Response): Promise<string> {
  try {
    const body = await resp.json();
    return typeof body?.detail === "string" ? body.detail : `HTTP ${resp.status}`;
  } catch {
    return `HTTP ${resp.status}`;
  }
}

export const getOrg = () => getJSON<Org>("/org");
export const getTeamPlan = (teamId: string) => getJSON<TeamPlan>(`/teams/${teamId}/plan`);
export const getTeamRoster = (teamId: string) => getJSON<TeamRoster>(`/teams/${teamId}/roster`);
export const getGroupRollup = (groupId: string) => getJSON<GroupRollup>(`/groups/${groupId}/rollup`);
export const postScenario = (teamId: string, changes: Change[]) =>
  postJSON<ScenarioResult>(`/teams/${teamId}/scenario`, { changes });
```

- [ ] **Step 5: Run to verify pass**

Run: `cd web && npx vitest run src/api/client.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
git add web/src/api
git commit -m "feat(web): typed API client + response types"
```

---

## Task 5: FitBar component

**Files:**
- Create: `web/src/components/FitBar.tsx`
- Test: `web/src/components/FitBar.test.tsx`

Shows net capacity vs the demand range, with a headroom/oversubscribed label colored by `fit.is_oversubscribed_expected`.

- [ ] **Step 1: Write the failing test**

File: `web/src/components/FitBar.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import { FitBar } from "./FitBar";
import type { TeamPlan } from "../api/types";

const plan: TeamPlan = {
  team_id: "msg", team_name: "Messaging Experience", gross_pm: 5.3, net_pm: 1.6,
  demand: { low: 2, expected: 3, high: 4 },
  fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 },
    optimistic_delta: -0.4, expected_delta: -1.4, pessimistic_delta: -2.4,
    is_oversubscribed_expected: true },
  risks: [],
};

test("shows net and demand and an oversubscribed label", () => {
  render(<FitBar plan={plan} />);
  expect(screen.getByText(/1\.6 PM net/)).toBeInTheDocument();
  expect(screen.getByText(/3\.0 PM demand/)).toBeInTheDocument();
  expect(screen.getByText(/oversubscribed/i)).toBeInTheDocument();
});

test("shows headroom when not oversubscribed", () => {
  const ok: TeamPlan = { ...plan, net_pm: 6,
    fit: { ...plan.fit, net_pm: 6, expected_delta: 3, is_oversubscribed_expected: false } };
  render(<FitBar plan={ok} />);
  expect(screen.getByText(/headroom/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run src/components/FitBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `web/src/components/FitBar.tsx`**

```tsx
import type { TeamPlan } from "../api/types";

export function FitBar({ plan }: { plan: TeamPlan }) {
  const { net_pm, demand, fit } = plan;
  const over = fit.is_oversubscribed_expected;
  const delta = fit.expected_delta;
  const scale = Math.max(net_pm, demand.high, 1);
  const pct = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`;
  return (
    <div className="card">
      <div>
        <strong>{net_pm.toFixed(1)} PM net</strong> vs{" "}
        <strong>{demand.expected.toFixed(1)} PM demand</strong>{" "}
        <span>(range {demand.low.toFixed(1)}–{demand.high.toFixed(1)})</span>
      </div>
      <div className="bar-track" style={{ marginTop: 8 }}>
        <div className="bar" style={{ width: pct(net_pm) }} />
      </div>
      <div className={over ? "fit-risk" : "fit-ok"} style={{ marginTop: 8 }}>
        {over
          ? `⚠ ${Math.abs(delta).toFixed(1)} PM oversubscribed (expected)`
          : `✓ ${delta.toFixed(1)} PM headroom (expected)`}
        {` · pessimistic ${fit.pessimistic_delta.toFixed(1)} PM`}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run src/components/FitBar.test.tsx`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/FitBar.tsx web/src/components/FitBar.test.tsx
git commit -m "feat(web): FitBar component"
```

---

## Task 6: RosterTable, DeliverablesList, RisksList components

**Files:**
- Create: `web/src/components/RosterTable.tsx`, `web/src/components/DeliverablesList.tsx`, `web/src/components/RisksList.tsx`
- Test: `web/src/components/RosterTable.test.tsx`, `web/src/components/DeliverablesList.test.tsx`, `web/src/components/RisksList.test.tsx`

- [ ] **Step 1: Write the failing tests**

File: `web/src/components/RosterTable.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import { RosterTable } from "./RosterTable";
import type { RosterRow } from "../api/types";

const rows: RosterRow[] = [
  { engineer_id: "dia", name: "Dia", level: "L3", onboarding_state: "none", availability: 1, effective_capacity: 0.71 },
  { engineer_id: "albert", name: "Albert", level: "L2", onboarding_state: "none", availability: 0.5, effective_capacity: 0.355 },
];

test("renders each engineer with effective capacity", () => {
  render(<RosterTable rows={rows} />);
  expect(screen.getByText("Dia")).toBeInTheDocument();
  expect(screen.getByText("Albert")).toBeInTheDocument();
  expect(screen.getByText("0.71")).toBeInTheDocument();
  expect(screen.getByText("0.36")).toBeInTheDocument(); // 0.355 rounded
});
```

File: `web/src/components/DeliverablesList.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import { DeliverablesList } from "./DeliverablesList";
import type { OrgDeliverable } from "../api/types";

const delivs: OrgDeliverable[] = [
  { id: "sunco", title: "SunCo CPaaS", type: "deliverable", priority: 1, owner_ids: ["dia"],
    estimate: { fidelity: "person_months", expected: 2.5 } },
  { id: "tw", title: "GA Twilio", type: "deliverable", priority: 2, owner_ids: ["claudia"],
    estimate: { fidelity: "tshirt", size: "L" } },
];

test("renders deliverable titles and fidelity", () => {
  render(<DeliverablesList deliverables={delivs} />);
  expect(screen.getByText("SunCo CPaaS")).toBeInTheDocument();
  expect(screen.getByText(/person_months/)).toBeInTheDocument();
  expect(screen.getByText(/tshirt/)).toBeInTheDocument();
});
```

File: `web/src/components/RisksList.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import { RisksList } from "./RisksList";
import type { Risk } from "../api/types";

test("renders risks with severity and detail", () => {
  const risks: Risk[] = [{ kind: "oversubscription", severity: "high", detail: "Over by 1.4 PM" }];
  render(<RisksList risks={risks} />);
  expect(screen.getByText(/Over by 1.4 PM/)).toBeInTheDocument();
  expect(screen.getByText(/high/i)).toBeInTheDocument();
});

test("renders an all-clear when no risks", () => {
  render(<RisksList risks={[]} />);
  expect(screen.getByText(/no risks/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run src/components/RosterTable.test.tsx src/components/DeliverablesList.test.tsx src/components/RisksList.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the components**

`web/src/components/RosterTable.tsx`:
```tsx
import type { RosterRow } from "../api/types";

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  const max = Math.max(...rows.map((r) => r.effective_capacity), 1);
  return (
    <div className="card">
      <h3>Roster — effective capacity</h3>
      <table>
        <thead>
          <tr><th>Engineer</th><th>Level</th><th>Avail</th><th>Effective</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.engineer_id}>
              <td>{r.name}</td>
              <td>{r.level}{r.onboarding_state !== "none" ? ` · ${r.onboarding_state}` : ""}</td>
              <td>{r.availability.toFixed(2)}</td>
              <td>{r.effective_capacity.toFixed(2)}</td>
              <td style={{ width: "30%" }}>
                <div className="bar-track">
                  <div className="bar" style={{ width: `${(r.effective_capacity / max) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
`web/src/components/DeliverablesList.tsx`:
```tsx
import type { OrgDeliverable } from "../api/types";

export function DeliverablesList({ deliverables }: { deliverables: OrgDeliverable[] }) {
  return (
    <div className="card">
      <h3>Deliverables</h3>
      <table>
        <thead><tr><th>Title</th><th>Type</th><th>Estimate</th><th>Priority</th></tr></thead>
        <tbody>
          {deliverables.map((d) => (
            <tr key={d.id}>
              <td>{d.title}</td>
              <td>{d.type}</td>
              <td>{String(d.estimate.fidelity)}{d.estimate.size ? ` ${d.estimate.size}` : ""}
                {d.estimate.expected != null ? ` (${d.estimate.expected} PM)` : ""}</td>
              <td>{d.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
`web/src/components/RisksList.tsx`:
```tsx
import type { Risk } from "../api/types";

export function RisksList({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return <div className="card fit-ok">✓ No risks flagged</div>;
  return (
    <div className="card">
      <h3>Risks</h3>
      <ul>
        {risks.map((r, i) => (
          <li key={i} className={r.severity === "high" ? "fit-risk" : undefined}>
            <strong>[{r.severity}]</strong> {r.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run src/components/RosterTable.test.tsx src/components/DeliverablesList.test.tsx src/components/RisksList.test.tsx`
Expected: PASS (5 passed across the three files).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/RosterTable.tsx web/src/components/DeliverablesList.tsx web/src/components/RisksList.tsx web/src/components/RosterTable.test.tsx web/src/components/DeliverablesList.test.tsx web/src/components/RisksList.test.tsx
git commit -m "feat(web): roster, deliverables, and risks components"
```

---

## Task 7: ScenarioPanel component

**Files:**
- Create: `web/src/components/ScenarioPanel.tsx`
- Test: `web/src/components/ScenarioPanel.test.tsx`

A KTLO reservation slider + an "apply" that calls a passed `onRun(changes)` callback and shows the returned net-PM delta.

- [ ] **Step 1: Write the failing test**

File: `web/src/components/ScenarioPanel.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioPanel } from "./ScenarioPanel";
import type { ScenarioResult } from "../api/types";

test("runs a KTLO scenario and shows the net delta", async () => {
  const result: ScenarioResult = {
    plan: {} as ScenarioResult["plan"], baseline: {} as ScenarioResult["baseline"],
    delta: { gross_pm: 0, net_pm: 1.6, expected_delta: 1.6 },
  };
  const onRun = vi.fn().mockResolvedValue(result);
  render(<ScenarioPanel teamId="msg" onRun={onRun} />);
  await userEvent.click(screen.getByRole("button", { name: /apply/i }));
  expect(onRun).toHaveBeenCalledWith("msg", [
    { op: "set_reservation", team_id: "msg", name: "KTLO", fraction: expect.any(Number) },
  ]);
  expect(await screen.findByText(/\+1\.6 PM net/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run src/components/ScenarioPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `web/src/components/ScenarioPanel.tsx`**

```tsx
import { useState } from "react";
import type { Change, ScenarioResult } from "../api/types";

export function ScenarioPanel({
  teamId, onRun,
}: {
  teamId: string;
  onRun: (teamId: string, changes: Change[]) => Promise<ScenarioResult>;
}) {
  const [ktlo, setKtlo] = useState(0.4);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      const changes: Change[] = [
        { op: "set_reservation", team_id: teamId, name: "KTLO", fraction: ktlo },
      ];
      setResult(await onRun(teamId, changes));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card">
      <h3>What-if: KTLO reservation</h3>
      <label>
        KTLO {Math.round(ktlo * 100)}%{" "}
        <input type="range" min={0} max={1} step={0.05} value={ktlo}
          onChange={(e) => setKtlo(Number(e.target.value))} />
      </label>
      <div style={{ marginTop: 8 }}>
        <button onClick={run}>Apply scenario</button>
      </div>
      {result && (
        <div style={{ marginTop: 8 }} className={result.delta.net_pm >= 0 ? "fit-ok" : "fit-risk"}>
          {result.delta.net_pm >= 0 ? "+" : ""}{result.delta.net_pm.toFixed(1)} PM net vs baseline
        </div>
      )}
      {error && <div className="fit-risk" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run src/components/ScenarioPanel.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ScenarioPanel.tsx web/src/components/ScenarioPanel.test.tsx
git commit -m "feat(web): ScenarioPanel with KTLO slider and delta readout"
```

---

## Task 8: ManagerView page

**Files:**
- Create: `web/src/pages/ManagerView.tsx`
- Test: `web/src/pages/ManagerView.test.tsx`

Fetches org (for team list + deliverables), the team plan, and the roster; composes FitBar + RosterTable + DeliverablesList + RisksList + ScenarioPanel. A team `<select>` switches teams.

- [ ] **Step 1: Write the failing test** (mocks the api client module)

File: `web/src/pages/ManagerView.test.tsx`
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi, test, expect, beforeEach } from "vitest";
import { ManagerView } from "./ManagerView";
import * as api from "../api/client";

vi.mock("../api/client");

const org = {
  teams: [{ id: "msg", name: "Messaging Experience", productive_weeks: 12, group_id: "exp" }],
  engineers: [], deliverables: [
    { id: "sunco", title: "SunCo CPaaS", type: "deliverable", priority: 1, owner_ids: ["dia"],
      estimate: { fidelity: "person_months", expected: 2.5 } }],
  groups: [],
};
const plan = {
  team_id: "msg", team_name: "Messaging Experience", gross_pm: 5.3, net_pm: 1.6,
  demand: { low: 2, expected: 3, high: 4 },
  fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 },
    optimistic_delta: -0.4, expected_delta: -1.4, pessimistic_delta: -2.4,
    is_oversubscribed_expected: true },
  risks: [{ kind: "oversubscription", severity: "high", detail: "Over by 1.4 PM" }],
};
const roster = { team_id: "msg", team_name: "Messaging Experience",
  roster: [{ engineer_id: "dia", name: "Dia", level: "L3", onboarding_state: "none",
    availability: 1, effective_capacity: 0.71 }] };

beforeEach(() => {
  vi.mocked(api.getOrg).mockResolvedValue(org as never);
  vi.mocked(api.getTeamPlan).mockResolvedValue(plan as never);
  vi.mocked(api.getTeamRoster).mockResolvedValue(roster as never);
});

test("loads and renders the team plan, roster, deliverables, and risks", async () => {
  render(<ManagerView />);
  expect(await screen.findByText("Dia")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/1\.6 PM net/)).toBeInTheDocument());
  expect(screen.getByText("SunCo CPaaS")).toBeInTheDocument();
  expect(screen.getByText(/Over by 1.4 PM/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run src/pages/ManagerView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `web/src/pages/ManagerView.tsx`**

```tsx
import { useEffect, useState } from "react";
import { getOrg, getTeamPlan, getTeamRoster, postScenario } from "../api/client";
import type { Org, TeamPlan, TeamRoster } from "../api/types";
import { FitBar } from "../components/FitBar";
import { RosterTable } from "../components/RosterTable";
import { DeliverablesList } from "../components/DeliverablesList";
import { RisksList } from "../components/RisksList";
import { ScenarioPanel } from "../components/ScenarioPanel";

export function ManagerView() {
  const [org, setOrg] = useState<Org | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [plan, setPlan] = useState<TeamPlan | null>(null);
  const [roster, setRoster] = useState<TeamRoster | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrg().then((o) => {
      setOrg(o);
      if (o.teams[0]) setTeamId(o.teams[0].id);
    }).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!teamId) return;
    Promise.all([getTeamPlan(teamId), getTeamRoster(teamId)])
      .then(([p, r]) => { setPlan(p); setRoster(r); })
      .catch((e) => setError(String(e)));
  }, [teamId]);

  if (error) return <div className="fit-risk">{error}</div>;
  if (!org || !teamId || !plan || !roster) return <div>Loading…</div>;

  const ownedDeliverables = org.deliverables; // server already scopes via owners on the team in /plan
  return (
    <div>
      <label>
        Team:{" "}
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {org.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <h2>{plan.team_name}</h2>
      <FitBar plan={plan} />
      <RosterTable rows={roster.roster} />
      <DeliverablesList deliverables={ownedDeliverables} />
      <RisksList risks={plan.risks} />
      <ScenarioPanel teamId={teamId} onRun={postScenario} />
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run src/pages/ManagerView.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/ManagerView.tsx web/src/pages/ManagerView.test.tsx
git commit -m "feat(web): ManagerView page composing the team plan"
```

---

## Task 9: DirectorView + App wiring + run docs + e2e

**Files:**
- Create: `web/src/pages/DirectorView.tsx`, `web/src/pages/DirectorView.test.tsx`
- Modify: `web/src/App.tsx` (persona toggle: Manager / Director)
- Create: `web/README.md`

- [ ] **Step 1: Write the failing DirectorView test**

File: `web/src/pages/DirectorView.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import { vi, test, expect, beforeEach } from "vitest";
import { DirectorView } from "./DirectorView";
import * as api from "../api/client";

vi.mock("../api/client");

const org = {
  teams: [], engineers: [], deliverables: [],
  groups: [{ id: "eng", name: "Engineering", parent_id: null },
           { id: "exp", name: "Experiences", parent_id: "eng" }],
};
const rollup = {
  group_id: "eng", group_name: "Engineering", total_gross_pm: 9.6, total_net_pm: 3.5,
  total_demand: { low: 4, expected: 6, high: 8 },
  fit: { net_pm: 3.5, demand: { low: 4, expected: 6, high: 8 },
    optimistic_delta: -0.5, expected_delta: -2.5, pessimistic_delta: -4.5,
    is_oversubscribed_expected: true },
  team_plans: [
    { team_id: "msg", team_name: "Messaging Experience", gross_pm: 5.3, net_pm: 1.6,
      demand: { low: 2, expected: 3, high: 4 },
      fit: { net_pm: 1.6, demand: { low: 2, expected: 3, high: 4 }, optimistic_delta: -0.4,
        expected_delta: -1.4, pessimistic_delta: -2.4, is_oversubscribed_expected: true }, risks: [] },
    { team_id: "email", team_name: "Email", gross_pm: 4.3, net_pm: 1.9,
      demand: { low: 2, expected: 3, high: 4 },
      fit: { net_pm: 1.9, demand: { low: 2, expected: 3, high: 4 }, optimistic_delta: -0.1,
        expected_delta: -1.1, pessimistic_delta: -2.1, is_oversubscribed_expected: true }, risks: [] },
  ],
};

beforeEach(() => {
  vi.mocked(api.getOrg).mockResolvedValue(org as never);
  vi.mocked(api.getGroupRollup).mockResolvedValue(rollup as never);
});

test("renders a per-team roll-up grid with totals", async () => {
  render(<DirectorView />);
  expect(await screen.findByText("Messaging Experience")).toBeInTheDocument();
  expect(screen.getByText("Email")).toBeInTheDocument();
  expect(screen.getByText(/3\.5 PM net/)).toBeInTheDocument(); // group total
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run src/pages/DirectorView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `web/src/pages/DirectorView.tsx`**

```tsx
import { useEffect, useState } from "react";
import { getGroupRollup, getOrg } from "../api/client";
import type { GroupRollup, Org } from "../api/types";

export function DirectorView() {
  const [org, setOrg] = useState<Org | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [rollup, setRollup] = useState<GroupRollup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrg().then((o) => {
      setOrg(o);
      if (o.groups[0]) setGroupId(o.groups[0].id);
    }).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!groupId) return;
    getGroupRollup(groupId).then(setRollup).catch((e) => setError(String(e)));
  }, [groupId]);

  if (error) return <div className="fit-risk">{error}</div>;
  if (!org || !groupId || !rollup) return <div>Loading…</div>;

  return (
    <div>
      <label>
        Group:{" "}
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {org.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <h2>{rollup.group_name}</h2>
      <div className="card">
        <strong>{rollup.total_net_pm.toFixed(1)} PM net</strong> vs{" "}
        <strong>{rollup.total_demand.expected.toFixed(1)} PM demand</strong> across{" "}
        {rollup.team_plans.length} teams
      </div>
      <table className="card">
        <thead><tr><th>Team</th><th>Net PM</th><th>Demand</th><th>Fit (expected)</th></tr></thead>
        <tbody>
          {rollup.team_plans.map((t) => (
            <tr key={t.team_id}>
              <td>{t.team_name}</td>
              <td>{t.net_pm.toFixed(1)}</td>
              <td>{t.demand.expected.toFixed(1)}</td>
              <td className={t.fit.is_oversubscribed_expected ? "fit-risk" : "fit-ok"}>
                {t.fit.expected_delta.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run src/pages/DirectorView.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Wire `web/src/App.tsx`**

```tsx
import { useState } from "react";
import { ManagerView } from "./pages/ManagerView";
import { DirectorView } from "./pages/DirectorView";

type Persona = "manager" | "director";

export default function App() {
  const [persona, setPersona] = useState<Persona>("manager");
  return (
    <div>
      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ display: "inline-block", marginRight: "1rem" }}>Capacity Planning</h1>
        <button onClick={() => setPersona("manager")} disabled={persona === "manager"}>Manager</button>{" "}
        <button onClick={() => setPersona("director")} disabled={persona === "director"}>Director</button>
      </header>
      {persona === "manager" ? <ManagerView /> : <DirectorView />}
    </div>
  );
}
```

The existing `App.test.tsx` asserts the title "Capacity Planning" — still present, so it keeps passing. Verify.

- [ ] **Step 6: Create `web/README.md`**

```markdown
# Capacity Planning — Web App

## Run it
1. Start the API (seeded with the sample org):
   ```
   cd ../server && . .venv/bin/activate && uvicorn 'capacity_server.app_seeded:create_seeded_app' --factory --port 8000
   ```
2. Start the web app:
   ```
   cd web && npm install && npm run dev
   ```
3. Open the printed URL (default http://localhost:5173). Vite proxies `/org`, `/teams`, `/groups` to the API on :8000.

## Test
```
npm test
```
```

- [ ] **Step 7: Run the FULL frontend suite + the server suite**

Run: `cd web && npm test` → all frontend tests pass.
Run: `cd server && . .venv/bin/activate && pytest -q` → all server tests pass (incl. roster + seeded app).

- [ ] **Step 8: Manual end-to-end (real server + real browser build)**

Run the API seeded entrypoint and a production build preview:
```bash
cd server && . .venv/bin/activate && (uvicorn 'capacity_server.app_seeded:create_seeded_app' --factory --port 8000 &) ; sleep 3
cd ../web && npm run build
```
Confirm `npm run build` succeeds (tsc + vite build with no type errors). Then `curl localhost:8000/teams/msg/roster` returns Dia/Claudia/Albert with effective_capacity values. Kill the uvicorn. (Interactive browser check is optional but recommended: `npm run dev` and click Manager/Director.)

- [ ] **Step 9: Commit**

```bash
git add web/src/pages/DirectorView.tsx web/src/pages/DirectorView.test.tsx web/src/App.tsx web/README.md
git commit -m "feat(web): DirectorView roll-up + persona toggle + run docs"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** the manager authoring/read view (roster with per-engineer effective capacity, deliverables, fit, risks, what-if scenario) and the director roll-up read view, both from the live API; numbers always from the engine (the new `/roster` endpoint calls `effective_capacity`; the frontend never multiplies). Role personas are a simple toggle (no router dependency — YAGNI).
- **Placeholder scan:** none — every component, page, test, and config file has complete code.
- **Type consistency:** the TS `types.ts` mirrors `serialize.py` exactly; `getTeamRoster`/`/roster` shape matches Task 1's `roster_to_dict`; `ScenarioResult.delta` matches the scenario route.
- **Invariant:** the frontend computes no capacity math. The only arithmetic in the UI is `.toFixed()` formatting and CSS bar widths (presentational scaling), never capacity/fit values.

## Deferred (Plan 4 and beyond — NOT in scope here)
- The Claude skill: sheet import, conversational scenarios, the four stakeholder narrative artifacts, Sheets/Slides/Markdown export.
- VP portfolio view (the director view generalizes to any group incl. the root; a dedicated VP screen with deliverable/KTLO/overhead split is a later enhancement).
- Editing the roster/deliverables in the UI and persisting via `POST /org` (the app currently reads + runs scenarios; full authoring/persistence is a fast-follow).
- Richer charts, drag-to-resize estimates, and Figma-designed styling.
```
