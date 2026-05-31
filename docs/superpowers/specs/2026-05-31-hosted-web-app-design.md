# Hosted, Properly-Designed Capacity Web App — Design

**Date:** 2026-05-31
**Author:** EM (author) with Claude
**Status:** Approved design, pending spec review

## Goal

Turn the local capacity-planning web app into a **hosted, shareable, properly-designed**
product: a password-gated demo (fictional data) that anyone with the link + shared
password can open in a browser — with a real visual design rather than the current
placeholder CSS.

Two asks, settled in brainstorming:
- **Hosted & shareable** — a password-gated static site, no server to keep alive.
- **Properly designed** — a coherent dark "data dashboard" design system.

## Decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Audience & data | **Password-gated shareable demo**, fictional data (already scrubbed). No user accounts. |
| Hosting | **Pyodide static site on GitHub Pages**, gated with **staticrypt** (shared password). No backend to deploy/keep alive. |
| Design direction | **Dark data dashboard**, **blue `#3b82f6`** brand accent, red/green semantics. Dark only (no light mode). |
| Engine | Runs **in-browser via Pyodide** — the same `capacity_engine` Python, as the single source of truth. No math in JS. |
| FastAPI server | **Kept** in the repo as the HTTP API (+ its tests); no longer required to run the app. |

## Architecture

The web app's data layer flips from "HTTP → FastAPI" to **calling the engine in the
browser via Pyodide** (Python compiled to WebAssembly), making the whole thing static.

```
Static bundle (GitHub Pages, staticrypt-gated)
 ├─ index.html            ← staticrypt-encrypted entry (shared password)
 ├─ assets/*.js,*.css      ← Vite-built React app (dark dashboard)
 ├─ capacity_engine-*.whl  ← pure-Python wheel of the REAL engine
 └─ sample_org.json        ← seeded fictional org

In the browser:
 React app → Pyodide → micropip installs the wheel → a thin Python
 "presenter" calls capacity_engine.plan_team / rollup_group /
 apply_scenario and returns the same dicts the FastAPI API returned
```

**One data-layer interface, two implementations.** The pages today call
`getOrg / getTeamPlan / getTeamRoster / getGroupRollup / postScenario` from
`api/client.ts`. We add `api/engine.ts` (Pyodide-backed) with identical signatures,
and `api/index.ts` selects the implementation — Pyodide by default (static build and
local dev; **no server needed to run the app**), HTTP client behind a flag for anyone
running FastAPI. `ManagerView` / `DirectorView` are otherwise unchanged.

**Engine stays authoritative.** The same `capacity_engine` runs in the browser; no
capacity math is reimplemented in JS. A small Python "presenter" (mirroring
`capacity_server/serialize.py` + the route dispatch) shapes engine results into the
existing response dicts, so the TS types are unchanged.

**Honest nuance:** staticrypt encrypts the *entry page*; the JS bundle and
`sample_org.json` remain fetchable by direct URL. Acceptable here — the data is
fictional and the code is already open-source. The password gate is about not making
the page trivially public, not protecting secrets.

## Design system

A small token set drives the whole UI (dark dashboard, blue accent):

**Tokens**
- Surfaces: page `#0f172a`, card `#1e293b`, border `#334155`; text `#e2e8f0`, muted `#94a3b8`.
- Brand accent (buttons, active nav, slider, bar fills): `#3b82f6`.
- Semantics: over `#f87171` (red), headroom `#4ade80` (green), medium-severity warning `#fbbf24` (amber).
- Type: system sans; **tabular-nums** for all figures; scale 12/14/18/24/32; 8px spacing grid; 8–12px radii.

**Components** (restyle of existing components — same data, same props):
- **App shell** — top bar: product name + **Manager / Director** segmented toggle (active = blue) + styled team/group dropdown.
- **Stat tiles** — Net PM · Demand · Fit (three-up); Fit colored red/green by `is_oversubscribed_expected`.
- **Fit bar** — slim track, blue fill for net, faint band for the low–high demand range, marker at expected; red/green label.
- **Roster table** — name · level (+ onboarding chip) · availability · effective, with a thin blue per-row capacity bar; tabular numbers.
- **Deliverables** — compact rows: title · type chip · estimate · priority.
- **Risks** — severity dot (red/amber) + detail; green "✓ no risks" empty state.
- **Scenario panel** — KTLO slider (blue) + Apply; result delta as a green/red pill.
- **Director view** — roll-up as a dark table (team · net · demand · fit, red/green) under a header strip of group-total tiles.
- **EngineLoading** — branded spinner + "warming up the engine…" while Pyodide boots; plus empty/error states and hover/focus states. Responsive: tiles stack on narrow screens.

Light mode is out of scope.

## Code changes

**New / changed in `web/`:**
- `web/src/api/engine.ts` — Pyodide-backed client: boot Pyodide, `micropip`-install the engine wheel, load `sample_org.json` into an in-memory org (mirroring the server's `OrgStore`), expose the five functions. Includes the Python presenter string.
- `web/src/api/index.ts` — selects Pyodide (default) vs HTTP client (flag: `VITE_API_MODE=http`).
- Restyle all components/pages to the token set; add `EngineLoading`.
- `web/index.html` — load the Pyodide runtime (CDN, pinned version).

**New (deploy):**
- `.github/workflows/deploy.yml` — build engine wheel (`python -m build` in `engine/`) → copy wheel + `sample_org.json` into `web/public/` → `npm run build` → staticrypt-encrypt `dist/index.html` with `${{ secrets.STATICRYPT_PASSWORD }}` → publish `dist/` to GitHub Pages.
- `web/HOSTING.md` — set the `STATICRYPT_PASSWORD` repo secret; published URL; how to run locally.

**Unchanged:** the `engine/` package (consumed as a built wheel) and the `server/`
FastAPI app + all its tests.

## Testing

- **Component/page tests** stay as-is — they mock the `api` module; we repoint the mock to `api/index.ts`. No behavioral change.
- **Engine-bridge test** (new) — jsdom can't run Pyodide, so mock the Pyodide runtime and assert the presenter dispatches to the right engine calls and returns dicts matching the TS types (shape + a representative value).
- **Build-and-smoke** — the deploy workflow builds the bundle; a manual/CI smoke step opens the page, confirms Pyodide boots and real numbers render (the same kind of live e2e we ran for the local app).
- **Engine + server suites** unchanged (97 tests total remain green).

## Out of scope (deferred)

- Real authentication / user accounts and real org data (this is a fictional-data demo).
- Light mode.
- In-UI editing/persistence of roster/deliverables (read + scenario only, as today).
- The Claude skill + Sheets/Slides export (separate plan).
- A dedicated VP portfolio view beyond the Director roll-up.

## Open questions for implementation planning

- Pyodide load strategy: CDN (simplest, pinned) vs self-hosted assets. Default: CDN.
- Engine delivery into Pyodide: built wheel via `micropip` (preferred) vs loading source files onto `sys.path`. Default: wheel.
- Where the presenter logic lives: an inline Python string in `engine.ts` vs a small `.py` asset loaded into Pyodide. Default: a small `.py` asset for readability/testability.
