# Engineering Capacity Planner — matcha-oat rebuild

**Date:** 2026-06-03
**Status:** Approved (design)
**Repo:** `engineering-capacity-planner` (local `~/capacity-planning`)

## Purpose

A planning tool that answers one question with trustworthy, auditable math:
**does the work a team is being asked to do fit the team it actually has?**

It models **supply** (per-engineer effective capacity, less overhead and reserved
work) against **demand** (projects estimated in person-months), and reports **net
capacity** and **fit**. One deterministic engine powers three lenses on one shared
data model: **Manager** (one EM builds their team), **Director** (roll-up across
teams, move engineers), **PM** (demand-first "will my project land?").

Everything is computed live: change any input and every dependent number updates.
No number is stored as source of truth — all derive from inputs via pure selectors.

Source of truth for layout, copy, and behavior: the handoff prototype
(`reference/Capacity Dashboard.html`) and its README. This document records the
**locked data model**, the **formulas**, and the **implementation decisions** for
the matcha-oat rebuild.

## Decisions

- **Location:** build inside the existing `engineering-capacity-planner` repo.
- **Engine:** fresh, framework-free **TypeScript selectors** (not the repo's prior
  Python/Pyodide engine). The new app is self-contained.
- **Retire the prior stack:** the Python `engine/`, FastAPI `server/`, and the old
  dark-redesign `web/` app are the superseded approach. They are removed from the
  working tree (preserved in git history) and `web/` is rebuilt fresh.
- **Skin:** matcha-oat, consumed exactly like `performance-calibration` —
  `matcha-oat-design-system` as a `github:` dependency, its Tailwind preset in
  `tailwind.config.ts`, `tokens.css` imported. The prototype is already matcha, so
  the rebuild maps its hexes to tokens (no Ada re-skin — the README's Ada caveat is
  overridden by the explicit matcha-oat target).
- **Stack:** React 19 + TypeScript + Vite + Tailwind 3, vitest + vitest-axe,
  `scripts/lint-tokens.mjs` guardrail, GitHub Pages deploy — mirroring
  `performance-calibration`.

## Data model (locked — these types and constants are the contract)

### Engineer (roster row)
`name: string` (editable) · `tenure: Tenure` (informational, not in math) ·
`level: Level` · `onboarding: Onboarding` · `alloc: 1 | 0.75 | 0.5 | 0.25`.

### Constants

```ts
LEVELS   = { Intern: 0.70, L2: 1.00, L3: 1.00, Staff: 0.85, Principal: 0.70 }
ONBOARD  = { 'New Hire: Month 1': 0.25, 'New Hire: Month 2': 0.50,
             'New Hire: Month 3': 0.75, 'Mentor: Month 1': 0.85,
             'Mentor: Month 2': 0.90, 'Mentor: Month 3': 0.95,
             'Not Applicable': 1.00 }
TENURE   = ['< 4 months','4–12 months','1–2 years','2–4 years','> 4 years']
```

### OverheadFactor (per-engineer; each has `current %` + editable `ideal %`)
Defaults (cur/ideal): Paid time off (8/8) · Sick leave (2/2) · Public holidays
(4/4) · Company + offsites (8/8) · Meetings & rituals (10/8) · PR reviews (7/7) ·
Cross-functional (5/5) · Learning & dev (5/5). A **percentage of the working week
that never reaches project work.**

### KtloFactor ("Keep The Lights On"; `current %` + editable `ideal %` + swatch color)
Defaults: Support tickets (15/10, `#6E8B57`) · Escalations / incidents (15/5,
`#C0533A`) · Interviews (5/5, `#E8B23C`) · Onboarding others (10/0, `#8E6416`) ·
PTO / holidays / events (5/5, `#A9A294`). Reserved **before** any project work.
(Swatch hexes map to matcha / rust / yolk / yolk-deep / muted tokens.)

### Project (demand row)
`name: string` (editable) · `est: number` (person-months) · `team: number[]`
(indices of assigned roster members).

### Team
Owns its own `roster`, `overhead`, `ktlo`, `projects`, and `win` (`'month' |
'quarter'`). The org is an **array of teams**. `cur` is the index of the team open
in the Manager view. Seed: six teams (Payments, Growth, Aurora, Mobile, Data,
Identity), `cur = Aurora` (index 2). Seed data copied verbatim from the prototype.

## Formulas (the engine)

Given a team and `weeks = win === 'month' ? 4.33 : 12`:

```
effFTE      = Σ roster ( alloc × LEVELS[level] × ONBOARD[onboarding] )
overheadSum = Σ OVERHEAD current%        (fraction)
productive  = max(0, 1 − overheadSum)
grossPM     = effFTE × (weeks / 4) × productive
ktloSum     = Σ KTLO current%            (fraction)
netPM       = grossPM × (1 − ktloSum)    ← headline
demand      = Σ projects est
fit         = netPM − demand             (+ spare, − oversubscribed)
```

- **Per-person load:** each project's estimate split evenly across assigned members;
  `load% = assignedPM / personNet × 100`, where `personNet` runs the same formula
  for that single engineer. Over **100%** = overcommitted.
- **Director roll-up:** run for every team; group net = `Σ (netPM − demand)`.
- **PM "will it land?":** `spare = netPM − demand` for the chosen team. `est ≤ spare`
  → lands (with leftover). Else short by `est − spare`, offer three directional
  levers (trim KTLO, push another project, loan an engineer).

Reference values to assert against (prototype output): Aurora net ≈ **2.7 pm**,
KTLO reserved = **50%**.

## Architecture (all under `web/`)

One-way data flow; computed values are never stored.

- `src/engine/` — pure, framework-free. `constants.ts`, `types.ts`, `selectors.ts`
  (`effFTE`, `grossPM`, `netPM`, `demand`, `fit`, `personLoad`, `rollup`,
  `pmVerdict`). The tested source of truth.
- `src/data/seed.ts` — the six-team sample org verbatim; `cur = 2`.
- `src/state/` — `useReducer` store holding `teams[]`, `cur`, `view`. Mutations are
  actions (edit engineer field, toggle assignment, set slider, edit ideal %, add/
  remove engineer or project, move engineer, set window, switch view). Removing an
  engineer strips their index from every project `team[]`.
- `src/screens/` — `Manager.tsx`, `Director.tsx`, `PM.tsx`.
- `src/components/` — `TopBar`, `ViewSwitcher`, `SegmentedToggle`, `ExportMenu`,
  `EditableField` (commit on blur/Enter), `Slider`, `Tooltip`, `FitBar`/`LoadBar`,
  `StatRow`, `DarkPanel`, `Pills` (assignment chips), `Icon` (Lucide).
- `src/export/` — `toCSV` (roster + projects + summary), `toJSON` (loss-less =
  save format), `print` (window.print + print stylesheet that hides chrome and
  linearizes).

## Screens (recreate faithfully — see prototype + screenshots)

- **Top bar (all views):** team name + mono sub-label; centered Monthly/Quarterly
  segmented toggle; Export ▾ menu (CSV / JSON / PDF-print); view switcher row
  (EM Manager · VP Director · PM).
- **Manager:** two columns — inputs (fluid left) + sticky 392px results rail. A
  matcha "how this works" strip (steps 1–4) under the bar. Input cards: (1) Team
  roster table with computed `lvl×`, `onb×`, `Eff. FTE`; (2) Where the week goes —
  8 overhead sliders with editable ideals + total→productive row; (3) KTLO &
  recurring work — 5 reservations with swatches, sliders, editable ideals, total
  reserved row, KTLO hover definition; (4) Projects — table with editable name,
  assignment chips, editable estimate, total demand; (5) Who's quietly overloaded —
  per-person load bars, >100% in error color. Results rail: dark hero (net capacity
  big mono number + serif-italic verdict), free-vs-reserved bar, stat list with ⓘ
  tooltips, projects-vs-capacity fit block, plain-words paragraph, "why this matters"
  yolk callout, reserved-by-bucket legend.
- **Director:** serif H2 + group-net line; 3-col tile grid (status dot by fit, name,
  "open" badge on current team, fit bar, supply/demand, signed fit pm; tiles
  clickable → detail panel with roster and "Open <team> in Manager view →"); "Move
  an engineer" panel (From ▾ · Engineer ▾ · → · To ▾ · Move) showing before→after
  fit for both teams.
- **PM:** serif H2; left card (Project name, Estimate pm, Which team ▾); right live
  card — green "Yes — lands on <team>" with leftover, or red "Not as-is — short by
  X pm" + three bulleted levers.

## Interactions

Live recompute on every edit/slider/select. Editable cells commit on blur/Enter.
Assignment chips toggle membership. Add/remove rows. Monthly/Quarterly changes
`weeks` and is stored per team. Move-engineer mutates both rosters and re-renders;
if the open team is involved, reload it. Tooltips on ⓘ / dotted terms. Subtle
0.12–0.18s transitions; honor `prefers-reduced-motion`.

## Skin / tokens

matcha-oat tokens via the Tailwind preset. Role → token: page bg `--oat`; card
`--paper`; text `--ink`/`--ink-2`/`--muted`; matcha accent `--matcha`/`--matcha-deep`;
yolk warn `--yolk`/`--yolk-deep`/`--yolk-tint`; rust/over `--bad`/`--bad-border`;
dark hero `--term-bg`. Display/body via `--serif`/`--sans`, numbers/pills `--mono`.
Sentence case everywhere; **no emoji**. 8pt rhythm, ~14px card radius, ~8px inputs,
full-round pills, 1px hairlines, barely-there shadows. `lint-tokens` guardrail fails
CI on hardcoded hex/font literals in `src`.

## Testing

- Engine: exhaustive selector unit tests; assert against prototype values
  (Aurora net ≈ 2.7, reserved 50%); per-person load and roll-up edge cases
  (zero roster, net ≤ 0, unassigned project).
- Reducer: action tests (move engineer updates both rosters; removing engineer
  strips project assignments; window stored per team).
- Components: EditableField commit semantics, assignment toggle, slider→recompute,
  export CSV/JSON shape.
- a11y: vitest-axe smoke per screen.

## Out of scope (roadmap)

Persistence/accounts, real Jira/HRIS/CSV import, confidence bands (low/expected/high),
plan-vs-actual drift, skills/capability matching. JSON export is the de-facto save
format and IS built.
