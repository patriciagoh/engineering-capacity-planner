# Hosted Capacity Web App (dark redesign + Pyodide static hosting) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the capacity web app into a polished dark "data dashboard" and make it a password-gated static site that runs the real Python engine in-browser via Pyodide — deployable to GitHub Pages with no backend server.

**Architecture:** Two facets, design-first then hosting. (1) Restyle every component to a small dark token set (blue accent, red/green semantics). (2) Add a Pyodide-backed data layer (`api/engine.ts`) with the same function signatures as the existing HTTP client (`api/client.ts`), selected via `api/index.ts`; a small `presenter.py` runs in Pyodide on top of the `capacity_engine` wheel. A GitHub Actions workflow builds the wheel + web bundle, staticrypt-encrypts the entry page, and publishes to Pages. The FastAPI server and all existing tests stay.

**Tech Stack:** React 18 + TypeScript + Vite + Vitest (existing); Pyodide (Python→WASM, CDN); `capacity_engine` built to a wheel; staticrypt + GitHub Pages + Actions.

---

## Context for the implementer

- Frontend lives in `web/` (Vite + React + TS + Vitest). Components: `web/src/components/{FitBar,RosterTable,DeliverablesList,RisksList,ScenarioPanel}.tsx`; pages `web/src/pages/{ManagerView,DirectorView}.tsx`; data layer `web/src/api/{client.ts,types.ts}`; styles `web/src/index.css`. Run frontend tests: `cd web && npm test`; typecheck: `npx tsc --noEmit -p tsconfig.json`.
- The data layer exposes (in `api/client.ts`): `getOrg, getTeamPlan, getTeamRoster, getGroupRollup, postScenario`. TS response types are in `api/types.ts` and mirror the server's `capacity_server/serialize.py`.
- The engine (`engine/capacity_engine`) is pure-stdlib Python with a `pyproject.toml` and this public API: `org_from_dict, org_to_dict, plan_team, rollup_group, apply_scenario, SetAvailability, SetReservation, RemoveEngineer, AddEngineer, Engineer, Level, OnboardingState, TeamAssignment, effective_capacity, DEFAULT_BASELINE_FACTOR`. The server venv (`server/.venv`) has both `capacity_engine` and `pytest` installed.
- The seeded fictional org is `server/data/sample_org.json` (teams Checkout/Notifications under groups eng/exp; engineers Maya/Priya/Tom/Sara/Ben). The presenter must reproduce the dict shapes in `capacity_server/serialize.py`.
- **Design tokens** (from the spec): page `#0f172a`, card `#1e293b`, border `#334155`, text `#e2e8f0`, muted `#94a3b8`, accent `#3b82f6`, over `#f87171`, headroom `#4ade80`, warn `#fbbf24`. System sans; tabular-nums for figures; 8px spacing grid; 8–12px radii. Dark only.

Work from `/Users/patricia/capacity-planning` on a feature branch. Node 20 + npm 10 are available.

## File Structure

```
web/
  src/
    index.css                 # MODIFY: dark token set + base styles
    App.tsx                   # MODIFY: dark shell, segmented Manager/Director toggle
    components/*.tsx           # MODIFY: restyle to tokens (logic unchanged)
    components/EngineLoading.tsx   # NEW: Pyodide boot state
    api/types.ts               # unchanged
    api/client.ts              # unchanged (HTTP impl, kept behind a flag)
    api/engine.ts              # NEW: Pyodide-backed impl (same signatures)
    api/index.ts               # NEW: selects engine.ts (default) or client.ts
  public/
    presenter.py               # NEW: in-Pyodide presenter over capacity_engine
    capacity_engine-*.whl      # GENERATED (by prepare-engine-assets.sh; gitignored)
    sample_org.json            # GENERATED (copied from server/data; gitignored)
  scripts/prepare-engine-assets.sh   # NEW: build wheel + copy assets into public/
  tests-py/test_presenter.py   # NEW: pytest for presenter.py (run in server venv)
  index.html                  # MODIFY: load Pyodide runtime (CDN, pinned)
.github/workflows/deploy.yml   # NEW: build → staticrypt → Pages
web/HOSTING.md                 # NEW
```

---

## Task 1: Dark design tokens + app shell

**Files:**
- Modify: `web/src/index.css`
- Modify: `web/src/App.tsx`
- Test: `web/src/App.test.tsx` (existing — keep green, add an assertion)

- [ ] **Step 1: Update the failing test (assert the segmented toggle + active state)**

Replace `web/src/App.test.tsx` with:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("renders the title and a Manager/Director toggle, Manager active by default", () => {
  render(<App />);
  expect(screen.getByText("Capacity Planning")).toBeInTheDocument();
  const manager = screen.getByRole("button", { name: "Manager" });
  const director = screen.getByRole("button", { name: "Director" });
  expect(manager).toHaveAttribute("aria-pressed", "true");
  expect(director).toHaveAttribute("aria-pressed", "false");
});

test("clicking Director switches the active tab", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Director" }));
  expect(screen.getByRole("button", { name: "Director" })).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/App.test.tsx`
Expected: FAIL — current App buttons use `disabled`, not `aria-pressed`.

- [ ] **Step 3: Rewrite `web/src/index.css` with the dark token set**

```css
:root {
  --bg: #0f172a; --card: #1e293b; --border: #334155;
  --text: #e2e8f0; --muted: #94a3b8;
  --accent: #3b82f6; --over: #f87171; --ok: #4ade80; --warn: #fbbf24;
  --radius: 10px; --gap: 8px;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: var(--text);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); }
.app { max-width: 980px; margin: 0 auto; padding: 1.5rem; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
.topbar h1 { font-size: 1.15rem; font-weight: 700; margin: 0; }
.segmented { display: inline-flex; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2px; }
.segmented button { border: 0; background: transparent; color: var(--muted); font-weight: 600; font-size: .85rem; padding: .35rem .9rem; border-radius: 8px; cursor: pointer; }
.segmented button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.1rem; margin-bottom: 1rem; }
.num { font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
.over { color: var(--over); } .ok { color: var(--ok); }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid var(--border); font-size: .88rem; }
th { color: var(--muted); font-weight: 600; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
select { background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: .35rem .6rem; }
.bar-track { background: var(--border); border-radius: 999px; height: 8px; overflow: hidden; }
.bar { height: 100%; background: var(--accent); }
.btn { background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: .4rem .9rem; font-weight: 600; font-size: .85rem; cursor: pointer; }
.pill { display: inline-block; padding: .15rem .55rem; border-radius: 999px; font-size: .78rem; font-weight: 600; }
.pill-over { background: rgba(248,113,113,.15); color: var(--over); }
.pill-ok { background: rgba(74,222,128,.15); color: var(--ok); }
.chip { font-size: .72rem; color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: .05rem .4rem; }
@media (max-width: 640px) { .tiles { grid-template-columns: 1fr !important; } }
```

- [ ] **Step 4: Rewrite `web/src/App.tsx` shell**

```tsx
import { useState } from "react";
import { ManagerView } from "./pages/ManagerView";
import { DirectorView } from "./pages/DirectorView";

type Persona = "manager" | "director";

export default function App() {
  const [persona, setPersona] = useState<Persona>("manager");
  return (
    <div className="app">
      <header className="topbar">
        <h1>Capacity Planning</h1>
        <div className="segmented" role="group" aria-label="View">
          <button aria-pressed={persona === "manager"} onClick={() => setPersona("manager")}>Manager</button>
          <button aria-pressed={persona === "director"} onClick={() => setPersona("director")}>Director</button>
        </div>
      </header>
      {persona === "manager" ? <ManagerView /> : <DirectorView />}
    </div>
  );
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd web && npx vitest run src/App.test.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: 2 passed; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add web/src/index.css web/src/App.tsx web/src/App.test.tsx
git commit -m "feat(web): dark design tokens + segmented app shell"
```

---

## Task 2: Restyle FitBar (stat tiles + slim bar)

**Files:**
- Modify: `web/src/components/FitBar.tsx`
- Test: `web/src/components/FitBar.test.tsx` (keep green; the "PM net"/"PM demand"/oversubscribed/headroom text must remain)

- [ ] **Step 1: Update the test to assert the tiles + keep existing text**

Replace `web/src/components/FitBar.test.tsx`'s body assertions (keep the fixtures) so it checks both the tiles and the label:
```tsx
test("shows net/demand/fit tiles and an oversubscribed label", () => {
  render(<FitBar plan={plan} />);
  expect(screen.getByText(/1\.6 PM net/)).toBeInTheDocument();
  expect(screen.getByText(/4\.5 PM demand|3\.0 PM demand/)).toBeInTheDocument();
  expect(screen.getByText(/oversubscribed/i)).toBeInTheDocument();
  expect(screen.getByText("Fit")).toBeInTheDocument(); // tile label
});

test("shows headroom when not oversubscribed", () => {
  const ok: TeamPlan = { ...plan, net_pm: 6,
    fit: { ...plan.fit, net_pm: 6, expected_delta: 3, is_oversubscribed_expected: false } };
  render(<FitBar plan={ok} />);
  expect(screen.getByText(/headroom/i)).toBeInTheDocument();
});
```
(The existing fixture uses demand.expected = 3.0; keep it — the regex accepts either value.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/components/FitBar.test.tsx`
Expected: FAIL — no "Fit" tile label yet.

- [ ] **Step 3: Rewrite `web/src/components/FitBar.tsx`**

```tsx
import type { TeamPlan } from "../api/types";

export function FitBar({ plan }: { plan: TeamPlan }) {
  const { net_pm, demand, fit } = plan;
  const over = fit.is_oversubscribed_expected;
  const scale = Math.max(net_pm, demand.high, 1);
  const pct = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`;
  return (
    <div className="card">
      <div className="tiles" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.6rem" }}>
        <Tile label="Net PM" value={net_pm.toFixed(1)} />
        <Tile label="Demand" value={demand.expected.toFixed(1)} />
        <Tile label="Fit" value={(fit.expected_delta >= 0 ? "+" : "") + fit.expected_delta.toFixed(1)}
              cls={over ? "over" : "ok"} />
      </div>
      <div className="bar-track" style={{ margin: "0.8rem 0 0.4rem" }}>
        <div className="bar" style={{ width: pct(net_pm) }} />
      </div>
      <div className={over ? "over" : "ok"} style={{ fontSize: ".82rem" }}>
        {net_pm.toFixed(1)} PM net vs {demand.expected.toFixed(1)} PM demand
        {" · "}
        {over
          ? `⚠ ${Math.abs(fit.expected_delta).toFixed(1)} PM oversubscribed`
          : `✓ ${fit.expected_delta.toFixed(1)} PM headroom`}
        <span className="muted"> (range {demand.low.toFixed(1)}–{demand.high.toFixed(1)})</span>
      </div>
    </div>
  );
}

function Tile({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: ".55rem .7rem" }}>
      <div className="muted" style={{ fontSize: ".65rem", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div className={`num ${cls ?? ""}`} style={{ fontSize: "1.3rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run src/components/FitBar.test.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: 2 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/FitBar.tsx web/src/components/FitBar.test.tsx
git commit -m "feat(web): restyle FitBar as stat tiles + bar"
```

---

## Task 3: Restyle RosterTable, DeliverablesList, RisksList

**Files:**
- Modify: `web/src/components/RosterTable.tsx`, `web/src/components/DeliverablesList.tsx`, `web/src/components/RisksList.tsx`
- Test: their existing `.test.tsx` files (must stay green — assert the same text)

- [ ] **Step 1: Confirm the existing tests still describe the behavior**

Run: `cd web && npx vitest run src/components/RosterTable.test.tsx src/components/DeliverablesList.test.tsx src/components/RisksList.test.tsx`
Expected: PASS (they assert text/values that the restyle preserves). These are the regression guard for this task.

- [ ] **Step 2: Rewrite `web/src/components/RosterTable.tsx`**

```tsx
import type { RosterRow } from "../api/types";

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  const max = Math.max(...rows.map((r) => r.effective_capacity), 1);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: ".95rem" }}>Roster · effective capacity</h3>
      <table>
        <thead><tr><th>Engineer</th><th>Level</th><th>Avail</th><th>Effective</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.engineer_id}>
              <td>{r.name}</td>
              <td>{r.level}{r.onboarding_state !== "none" ? <span className="chip" style={{ marginLeft: 6 }}>{r.onboarding_state}</span> : null}</td>
              <td className="num">{r.availability.toFixed(2)}</td>
              <td className="num">{(Math.round(r.effective_capacity * 100) / 100).toFixed(2)}</td>
              <td style={{ width: "32%" }}>
                <div className="bar-track"><div className="bar" style={{ width: `${(r.effective_capacity / max) * 100}%` }} /></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `web/src/components/DeliverablesList.tsx`**

```tsx
import type { OrgDeliverable } from "../api/types";

export function DeliverablesList({ deliverables }: { deliverables: OrgDeliverable[] }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: ".95rem" }}>Deliverables</h3>
      <table>
        <thead><tr><th>Title</th><th>Type</th><th>Estimate</th><th>Priority</th></tr></thead>
        <tbody>
          {deliverables.map((d) => (
            <tr key={d.id}>
              <td>{d.title}</td>
              <td><span className="chip">{d.type}</span></td>
              <td className="num">{String(d.estimate.fidelity)}{d.estimate.size ? ` ${d.estimate.size}` : ""}{d.estimate.expected != null ? ` (${d.estimate.expected} PM)` : ""}</td>
              <td className="num">{d.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `web/src/components/RisksList.tsx`**

```tsx
import type { Risk } from "../api/types";

const dot = (sev: string) => (sev === "high" ? "var(--over)" : sev === "medium" ? "var(--warn)" : "var(--muted)");

export function RisksList({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return <div className="card ok">✓ No risks flagged</div>;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: ".95rem" }}>Risks</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {risks.map((r, i) => (
          <li key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: ".25rem 0" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot(r.severity), marginTop: 6, flex: "0 0 auto" }} />
            <span><span className="muted" style={{ textTransform: "uppercase", fontSize: ".7rem" }}>{r.severity}</span> · {r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify all stay green**

Run: `cd web && npx vitest run src/components/RosterTable.test.tsx src/components/DeliverablesList.test.tsx src/components/RisksList.test.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: 5 passed; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/RosterTable.tsx web/src/components/DeliverablesList.tsx web/src/components/RisksList.tsx
git commit -m "feat(web): restyle roster, deliverables, risks to dark tokens"
```

---

## Task 4: Restyle ScenarioPanel + DirectorView

**Files:**
- Modify: `web/src/components/ScenarioPanel.tsx`, `web/src/pages/DirectorView.tsx`
- Test: their existing `.test.tsx` (keep green)

- [ ] **Step 1: Confirm current tests describe behavior (regression guard)**

Run: `cd web && npx vitest run src/components/ScenarioPanel.test.tsx src/pages/DirectorView.test.tsx`
Expected: PASS.

- [ ] **Step 2: Rewrite `web/src/components/ScenarioPanel.tsx`** (logic identical; styled)

```tsx
import { useState } from "react";
import type { Change, ScenarioResult } from "../api/types";

export function ScenarioPanel({
  teamId, onRun,
}: { teamId: string; onRun: (teamId: string, changes: Change[]) => Promise<ScenarioResult> }) {
  const [ktlo, setKtlo] = useState(0.4);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run() {
    setError(null); setPending(true);
    try {
      setResult(await onRun(teamId, [{ op: "set_reservation", team_id: teamId, name: "KTLO", fraction: ktlo }]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: ".95rem" }}>What-if · KTLO reservation</h3>
      <label className="muted" style={{ fontSize: ".82rem" }}>
        KTLO {Math.round(ktlo * 100)}%{" "}
        <input type="range" min={0} max={1} step={0.05} value={ktlo}
               onChange={(e) => setKtlo(Number(e.target.value))} style={{ accentColor: "var(--accent)", verticalAlign: "middle" }} />
      </label>
      <div style={{ marginTop: ".6rem" }}>
        <button className="btn" onClick={run} disabled={pending}>{pending ? "Running…" : "Apply scenario"}</button>
      </div>
      {result && (
        <div style={{ marginTop: ".6rem" }}>
          <span className={result.delta.net_pm >= 0 ? "pill pill-ok" : "pill pill-over"}>
            {result.delta.net_pm >= 0 ? "+" : ""}{result.delta.net_pm.toFixed(1)} PM net vs baseline
          </span>
        </div>
      )}
      {error && <div className="over" style={{ marginTop: ".6rem" }}>{error}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `web/src/pages/DirectorView.tsx` body** (data-fetching logic unchanged; restyle the markup)

Keep the existing `useState`/`useEffect`/`getOrg`/`getGroupRollup` logic and the cancel/reset guards EXACTLY as they are. Replace only the returned JSX (from `return (` to the end of the component) with:
```tsx
  return (
    <div>
      <label className="muted" style={{ fontSize: ".85rem" }}>
        Group:{" "}
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {org.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <h2 style={{ fontSize: "1.1rem" }}>{rollup.group_name}</h2>
      <div className="card tiles" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: ".6rem" }}>
        <div><div className="muted" style={{ fontSize: ".65rem", textTransform: "uppercase" }}>Net PM</div><div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{rollup.total_net_pm.toFixed(1)}</div></div>
        <div><div className="muted" style={{ fontSize: ".65rem", textTransform: "uppercase" }}>Demand</div><div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{rollup.total_demand.expected.toFixed(1)}</div></div>
        <div><div className="muted" style={{ fontSize: ".65rem", textTransform: "uppercase" }}>Teams</div><div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{rollup.team_plans.length}</div></div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Team</th><th>Net PM</th><th>Demand</th><th>Fit (expected)</th></tr></thead>
          <tbody>
            {rollup.team_plans.map((t) => (
              <tr key={t.team_id}>
                <td>{t.team_name}</td>
                <td className="num">{t.net_pm.toFixed(1)}</td>
                <td className="num">{t.demand.expected.toFixed(1)}</td>
                <td className={`num ${t.fit.is_oversubscribed_expected ? "over" : "ok"}`}>{t.fit.expected_delta.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
```
(Keep the `if (error) ...` and `if (!org || !groupId || !rollup) ...` guards above it unchanged.)

- [ ] **Step 4: Run to verify all stay green**

Run: `cd web && npx vitest run src/components/ScenarioPanel.test.tsx src/pages/DirectorView.test.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ScenarioPanel.tsx web/src/pages/DirectorView.tsx
git commit -m "feat(web): restyle scenario panel + director roll-up"
```

---

## Task 5: Pyodide presenter.py + asset-prep script

**Files:**
- Create: `web/public/presenter.py`
- Create: `web/scripts/prepare-engine-assets.sh`
- Create: `web/tests-py/test_presenter.py`
- Modify: `web/.gitignore` (ignore generated assets)

- [ ] **Step 1: Write the failing test** (run in the server venv, which has `capacity_engine` + `pytest`)

File: `web/tests-py/test_presenter.py`
```python
import json, sys
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"
sys.path.insert(0, str(PUBLIC))
import presenter  # noqa: E402

SAMPLE = Path(__file__).resolve().parents[2] / "server" / "data" / "sample_org.json"


def setup_module(_):
    presenter.load_org(SAMPLE.read_text())


def test_get_team_plan_shape_and_values():
    plan = json.loads(presenter.get_team_plan("msg"))
    assert plan["team_id"] == "msg"
    assert plan["gross_pm"] == __import__("pytest").approx(5.325, abs=1e-3)
    assert "fit" in plan and "risks" in plan


def test_get_team_roster_effective_capacity():
    body = json.loads(presenter.get_team_roster("msg"))
    rows = {r["engineer_id"]: r for r in body["roster"]}
    assert rows["maya"]["effective_capacity"] == __import__("pytest").approx(0.71, abs=1e-3)


def test_get_group_rollup_sums_teams():
    r = json.loads(presenter.get_group_rollup("eng"))
    assert {tp["team_id"] for tp in r["team_plans"]} == {"msg", "email"}


def test_post_scenario_returns_delta():
    out = json.loads(presenter.post_scenario("msg", json.dumps(
        [{"op": "set_reservation", "team_id": "msg", "name": "KTLO", "fraction": 0.4}])))
    assert out["delta"]["net_pm"] > 0


def test_matches_server_serializer():
    # presenter dicts must equal capacity_server.serialize output for the same org
    from capacity_engine.store import load_org
    from capacity_engine.planning import plan_team
    from capacity_server.serialize import team_plan_to_dict
    org = load_org(SAMPLE)
    assert json.loads(presenter.get_team_plan("msg")) == team_plan_to_dict(plan_team(org, "msg"))
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/patricia/capacity-planning/server && . .venv/bin/activate && pytest ../web/tests-py/test_presenter.py -q`
Expected: FAIL — `web/public/presenter.py` doesn't exist.

- [ ] **Step 3: Write `web/public/presenter.py`** (depends only on `capacity_engine`)

```python
"""Runs inside Pyodide on top of the capacity_engine wheel. Holds one org and
exposes JSON-returning functions mirroring the FastAPI responses. Kept in sync
with capacity_server/serialize.py (test_presenter asserts equality)."""
import json

from capacity_engine import (
    org_from_dict, org_to_dict, plan_team, rollup_group, apply_scenario,
    SetAvailability, SetReservation, RemoveEngineer, AddEngineer,
    Engineer, Level, OnboardingState, TeamAssignment,
)

_ORG = None


def load_org(org_json: str) -> None:
    global _ORG
    _ORG = org_from_dict(json.loads(org_json))


def get_org() -> str:
    return json.dumps(org_to_dict(_ORG))


def _demand(d):
    return {"low": d.low, "expected": d.expected, "high": d.high}


def _fit(f):
    return {
        "net_pm": f.net_pm, "demand": _demand(f.demand),
        "optimistic_delta": f.optimistic_delta, "expected_delta": f.expected_delta,
        "pessimistic_delta": f.pessimistic_delta,
        "is_oversubscribed_expected": f.is_oversubscribed_expected,
    }


def _risk(r):
    return {"kind": r.kind, "severity": r.severity.value, "detail": r.detail}


def _team_plan(p):
    return {
        "team_id": p.team_id, "team_name": p.team_name, "gross_pm": p.gross_pm,
        "net_pm": p.net_pm, "demand": _demand(p.demand), "fit": _fit(p.fit),
        "risks": [_risk(r) for r in p.risks],
    }


def get_team_plan(team_id: str) -> str:
    return json.dumps(_team_plan(plan_team(_ORG, team_id)))


def get_team_roster(team_id: str) -> str:
    from capacity_engine import effective_capacity, DEFAULT_BASELINE_FACTOR
    team = _ORG.team(team_id)
    rows = [{
        "engineer_id": e.id, "name": e.name, "level": e.level.value,
        "onboarding_state": e.onboarding_state.value,
        "availability": e.availability_on(team_id),
        "effective_capacity": effective_capacity(e, team_id, DEFAULT_BASELINE_FACTOR),
    } for e in _ORG.engineers_on(team_id)]
    return json.dumps({"team_id": team.id, "team_name": team.name, "roster": rows})


def get_group_rollup(group_id: str) -> str:
    r = rollup_group(_ORG, group_id)
    return json.dumps({
        "group_id": r.group_id, "group_name": r.group_name,
        "total_gross_pm": r.total_gross_pm, "total_net_pm": r.total_net_pm,
        "total_demand": _demand(r.total_demand), "fit": _fit(r.fit),
        "team_plans": [_team_plan(p) for p in r.team_plans],
    })


def _change(d):
    op = d.get("op")
    if op == "set_availability":
        return SetAvailability(d["engineer_id"], d["team_id"], float(d["availability"]))
    if op == "set_reservation":
        return SetReservation(d["team_id"], d["name"], float(d["fraction"]))
    if op == "remove_engineer":
        return RemoveEngineer(d["engineer_id"])
    if op == "add_engineer":
        return AddEngineer(Engineer(
            id=d["id"], name=d["name"], level=Level(d["level"]),
            onboarding_state=OnboardingState(d.get("onboarding_state", "none")),
            assignments=[TeamAssignment(a["team_id"], float(a["availability"]))
                         for a in d.get("assignments", [])]))
    raise ValueError(f"unknown change op: {op!r}")


def post_scenario(team_id: str, changes_json: str) -> str:
    baseline = plan_team(_ORG, team_id)
    changes = [_change(c) for c in json.loads(changes_json)]
    scen = plan_team(apply_scenario(_ORG, changes), team_id)
    return json.dumps({
        "plan": _team_plan(scen), "baseline": _team_plan(baseline),
        "delta": {
            "gross_pm": scen.gross_pm - baseline.gross_pm,
            "net_pm": scen.net_pm - baseline.net_pm,
            "expected_delta": scen.fit.expected_delta - baseline.fit.expected_delta,
        },
    })
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/patricia/capacity-planning/server && . .venv/bin/activate && pytest ../web/tests-py/test_presenter.py -q`
Expected: 5 passed (including `test_matches_server_serializer`).

- [ ] **Step 5: Write `web/scripts/prepare-engine-assets.sh`**

```bash
#!/usr/bin/env bash
# Build the engine wheel and copy runtime assets into web/public/ for Pyodide.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PUBLIC="$ROOT/web/public"
python3 -m pip install --quiet build
( cd "$ROOT/engine" && python3 -m build --wheel --outdir "$PUBLIC" )
cp "$ROOT/server/data/sample_org.json" "$PUBLIC/sample_org.json"
echo "Engine assets ready in $PUBLIC:"
ls "$PUBLIC"/capacity_engine-*.whl "$PUBLIC/sample_org.json"
```

- [ ] **Step 6: Add generated assets to `web/.gitignore`**

Append to `web/.gitignore`:
```
public/capacity_engine-*.whl
public/sample_org.json
```

- [ ] **Step 7: Build the assets once + verify**

Run:
```bash
chmod +x /Users/patricia/capacity-planning/web/scripts/prepare-engine-assets.sh
/Users/patricia/capacity-planning/web/scripts/prepare-engine-assets.sh
```
Expected: prints a `capacity_engine-0.1.0-py3-none-any.whl` and `sample_org.json` in `web/public/`.

- [ ] **Step 8: Commit**

```bash
git add web/public/presenter.py web/scripts/prepare-engine-assets.sh web/tests-py/test_presenter.py web/.gitignore
git commit -m "feat(web): in-Pyodide presenter over capacity_engine + asset build"
```

---

## Task 6: Pyodide client (`api/engine.ts`) + index.html loader + EngineLoading

**Files:**
- Modify: `web/index.html` (load Pyodide from CDN)
- Create: `web/src/api/engine.ts`
- Create: `web/src/components/EngineLoading.tsx`
- Test: `web/src/api/engine.test.ts`

- [ ] **Step 1: Add the Pyodide runtime to `web/index.html`**

Add inside `<head>` (pin the version):
```html
    <script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
```

- [ ] **Step 2: Write the failing test** (mock the Pyodide runtime + fetch)

File: `web/src/api/engine.test.ts`
```ts
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const calls: Record<string, unknown[]> = {};
function fakePyodide() {
  const globals = {
    get: (name: string) => (...args: unknown[]) => {
      calls[name] = args;
      if (name === "get_team_plan") return JSON.stringify({ team_id: args[0], team_name: "Checkout", gross_pm: 5.3, net_pm: 1.6, demand: { low: 1, expected: 2, high: 3 }, fit: { net_pm: 1.6, demand: { low: 1, expected: 2, high: 3 }, optimistic_delta: 0, expected_delta: -0.4, pessimistic_delta: -1, is_oversubscribed_expected: true }, risks: [] });
      if (name === "load_org") return undefined;
      return "{}";
    },
  };
  return {
    loadPackage: vi.fn().mockResolvedValue(undefined),
    pyimport: vi.fn().mockReturnValue({ install: vi.fn().mockResolvedValue(undefined) }),
    runPythonAsync: vi.fn().mockResolvedValue(undefined),
    runPython: vi.fn(),
    globals,
  };
}

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  (globalThis as any).loadPyodide = vi.fn().mockResolvedValue(fakePyodide());
  (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "PYCODE_OR_JSON" } as Response);
});
afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

test("getTeamPlan boots pyodide, installs the wheel, and returns a parsed plan", async () => {
  const { getTeamPlan } = await import("./engine");
  const plan = await getTeamPlan("msg");
  expect((globalThis as any).loadPyodide).toHaveBeenCalled();
  expect(plan.team_id).toBe("msg");
  expect(calls["get_team_plan"]).toEqual(["msg"]);
});

test("postScenario passes team id and a JSON changes string", async () => {
  const { postScenario } = await import("./engine");
  await postScenario("msg", [{ op: "set_reservation", team_id: "msg", name: "KTLO", fraction: 0.4 }]);
  expect(calls["post_scenario"]?.[0]).toBe("msg");
  expect(typeof calls["post_scenario"]?.[1]).toBe("string");
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd web && npx vitest run src/api/engine.test.ts`
Expected: FAIL — `./engine` not found.

- [ ] **Step 4: Write `web/src/api/engine.ts`**

```ts
import type { GroupRollup, Org, ScenarioResult, TeamPlan, TeamRoster, Change } from "./types";

declare global {
  // provided by the Pyodide CDN script in index.html
  function loadPyodide(config?: { indexURL?: string }): Promise<any>;
}

const BASE = import.meta.env.BASE_URL ?? "/";
const WHEEL = `${BASE}capacity_engine-0.1.0-py3-none-any.whl`;

let bootPromise: Promise<any> | null = null;

function boot(): Promise<any> {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const pyodide = await loadPyodide();
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install(new URL(WHEEL, location.href).href);
    const presenterSrc = await (await fetch(`${BASE}presenter.py`)).text();
    await pyodide.runPythonAsync(presenterSrc);
    const orgJson = await (await fetch(`${BASE}sample_org.json`)).text();
    pyodide.globals.get("load_org")(orgJson);
    return pyodide;
  })();
  return bootPromise;
}

async function call<T>(fn: string, ...args: unknown[]): Promise<T> {
  const pyodide = await boot();
  const result = pyodide.globals.get(fn)(...args);
  return JSON.parse(typeof result === "string" ? result : result.toString()) as T;
}

export const getOrg = () => call<Org>("get_org");
export const getTeamPlan = (teamId: string) => call<TeamPlan>("get_team_plan", teamId);
export const getTeamRoster = (teamId: string) => call<TeamRoster>("get_team_roster", teamId);
export const getGroupRollup = (groupId: string) => call<GroupRollup>("get_group_rollup", groupId);
export const postScenario = (teamId: string, changes: Change[]) =>
  call<ScenarioResult>("post_scenario", teamId, JSON.stringify(changes));

/** Resolves once the engine is booted — for the loading state. */
export const ready = () => boot().then(() => true);
```

- [ ] **Step 5: Write `web/src/components/EngineLoading.tsx`**

```tsx
export function EngineLoading() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
      <div style={{
        width: 28, height: 28, margin: "0 auto 0.8rem", borderRadius: "50%",
        border: "3px solid var(--border)", borderTopColor: "var(--accent)",
        animation: "spin 0.8s linear infinite",
      }} />
      <div className="muted">Warming up the engine…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd web && npx vitest run src/api/engine.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: 2 passed; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add web/index.html web/src/api/engine.ts web/src/components/EngineLoading.tsx web/src/api/engine.test.ts
git commit -m "feat(web): Pyodide-backed engine client + loading state"
```

---

## Task 7: Data-layer selector + wire pages to it

**Files:**
- Create: `web/src/api/index.ts`
- Modify: `web/src/pages/ManagerView.tsx`, `web/src/pages/DirectorView.tsx` (import from `../api` instead of `../api/client`)
- Modify: `web/src/pages/ManagerView.test.tsx`, `web/src/pages/DirectorView.test.tsx` (mock `../api`)

- [ ] **Step 1: Write `web/src/api/index.ts`** (selector — Pyodide default, HTTP behind a flag)

```ts
// Selects the data-layer implementation. Default: the in-browser Pyodide engine
// (works for the static build and local `npm run dev`, no server needed).
// Set VITE_API_MODE=http to use the FastAPI HTTP client instead.
import * as engine from "./engine";
import * as http from "./client";

const impl = import.meta.env.VITE_API_MODE === "http" ? http : engine;

export const getOrg = impl.getOrg;
export const getTeamPlan = impl.getTeamPlan;
export const getTeamRoster = impl.getTeamRoster;
export const getGroupRollup = impl.getGroupRollup;
export const postScenario = impl.postScenario;
export const ready: () => Promise<boolean> =
  "ready" in impl ? (impl as typeof engine).ready : () => Promise.resolve(true);
```

- [ ] **Step 2: Repoint the pages' imports**

In `web/src/pages/ManagerView.tsx` and `web/src/pages/DirectorView.tsx`, change:
```tsx
import { getOrg, getTeamPlan, getTeamRoster, postScenario } from "../api/client";
```
to import the same names from `"../api"` (the selector). DirectorView similarly imports `getGroupRollup, getOrg` from `"../api"`.

- [ ] **Step 3: Repoint the test mocks**

In `web/src/pages/ManagerView.test.tsx` and `web/src/pages/DirectorView.test.tsx`, change `vi.mock("../api/client")` to `vi.mock("../api")` and `import * as api from "../api/client"` to `import * as api from "../api"`.

- [ ] **Step 4: Run to verify pages + tests still pass**

Run: `cd web && npm test && npx tsc --noEmit -p tsconfig.json`
Expected: all frontend tests pass (App, api/client, api/engine, all components, both pages); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add web/src/api/index.ts web/src/pages/ManagerView.tsx web/src/pages/DirectorView.tsx web/src/pages/ManagerView.test.tsx web/src/pages/DirectorView.test.tsx
git commit -m "feat(web): data-layer selector; pages use Pyodide engine by default"
```

---

## Task 8: Deploy workflow (staticrypt → GitHub Pages) + HOSTING.md

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `web/HOSTING.md`

- [ ] **Step 1: Local production build smoke-check**

Run:
```bash
cd /Users/patricia/capacity-planning/web && ./scripts/prepare-engine-assets.sh && npm run build
```
Expected: `npm run build` succeeds (tsc + vite), `dist/` contains `index.html`, the hashed JS/CSS, the `.whl`, `presenter.py`, and `sample_org.json`. (Vite copies `public/` into `dist/`.)

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy capacity web app
on:
  push:
    branches: [main]
    paths: ["web/**", "engine/**", ".github/workflows/deploy.yml"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: Build engine assets (wheel + sample org)
        run: ./web/scripts/prepare-engine-assets.sh
      - name: Build web bundle
        run: cd web && npm ci && npm run build
      - name: Encrypt entry page with staticrypt
        env:
          STATICRYPT_PASSWORD: ${{ secrets.STATICRYPT_PASSWORD }}
        run: |
          if [ -z "$STATICRYPT_PASSWORD" ]; then
            echo "STATICRYPT_PASSWORD secret is not set — refusing to publish unencrypted." >&2
            exit 1
          fi
          npx --yes staticrypt web/dist/index.html \
            -p "$STATICRYPT_PASSWORD" --short \
            -d web/dist
          # staticrypt writes the encrypted index.html into web/dist (overwrites entry)
      - uses: actions/upload-pages-artifact@v3
        with: { path: web/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Write `web/HOSTING.md`**

```markdown
# Hosting — Capacity Web App

A static site that runs the real Python engine in your browser via Pyodide.
No backend server. Published to GitHub Pages, gated by a shared password
(staticrypt).

## One-time setup
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → New secret**:
   `STATICRYPT_PASSWORD` = the shared password you'll give viewers.

## Deploy
Push to `main` (touching `web/**` or `engine/**`), or run the **Deploy capacity
web app** workflow manually. It builds the engine wheel, builds the web bundle,
encrypts the entry page, and publishes to Pages. The published URL appears in the
workflow's deploy step.

## What viewers experience
Open the URL → enter the shared password → the app loads. First load takes a few
seconds while the Python-in-WASM engine boots ("Warming up the engine…").

## Run locally
```
cd web && ./scripts/prepare-engine-assets.sh && npm install && npm run dev
```
No server needed — the engine runs in the browser. (To run against the FastAPI
backend instead: `VITE_API_MODE=http npm run dev` with the server started.)

## Note on the password
staticrypt encrypts the entry page; the JS bundle and `sample_org.json` remain
fetchable by direct URL. That's fine here — the data is fictional and the code is
open-source. The gate keeps the page from being trivially public, not secret.
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml web/HOSTING.md
git commit -m "feat(web): GitHub Pages deploy workflow + hosting docs"
```

- [ ] **Step 5: Final full verification**

Run:
```bash
cd /Users/patricia/capacity-planning/web && npm test && npx tsc --noEmit -p tsconfig.json && npm run build
cd /Users/patricia/capacity-planning/server && . .venv/bin/activate && pytest -q && pytest ../web/tests-py/test_presenter.py -q
cd /Users/patricia/capacity-planning/engine && . .venv/bin/activate && pytest -q
```
Expected: all green — frontend suite, tsc, production build, server suite, presenter suite, engine suite.

---

## Self-Review (completed during planning)

- **Spec coverage:** dark design system + tokens (Tasks 1–4); Pyodide in-browser engine with the same data-layer interface (Tasks 5–7); presenter mirrors `serialize.py` and is pinned to it by a test (Task 5); static GitHub Pages + staticrypt deploy (Task 8); FastAPI server + all suites kept (selector flag in Task 7, full verification in Task 8); EngineLoading state (Task 6). Open questions resolved to the spec defaults: wheel via micropip, Pyodide from CDN, presenter as a `.py` asset.
- **Placeholder scan:** none — every step has complete code/commands.
- **Type consistency:** `engine.ts` exports match `client.ts` (`getOrg/getTeamPlan/getTeamRoster/getGroupRollup/postScenario`) so `api/index.ts` re-exports cleanly; presenter dict keys match `api/types.ts` and `serialize.py`.

## Notes for the implementer

- The `EngineLoading` component (Task 6) is built but only wired opportunistically — `ManagerView`/`DirectorView` already show "Loading…" until data resolves, which now also covers the Pyodide boot (the first `getOrg`/`getTeamPlan` await blocks on `boot()`). Swapping their `<div>Loading…</div>` for `<EngineLoading />` is a one-line nicety left to the implementer's discretion within Task 7.
- Pyodide can't run in jsdom; `engine.ts` is unit-tested with a mocked runtime (Task 6) and the real path is covered by the Task 8 production build + a manual open-the-page smoke check.
- `test_presenter.py` runs in the **server venv** (it has both `capacity_engine` and `capacity_server`); it is not part of the `web` Vitest suite.
```
