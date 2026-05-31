# Capacity Planning Tool & Skill — Design

**Date:** 2026-05-29
**Author:** EM (author) with Claude
**Status:** Approved design, pending spec review

## Goal

Give engineering managers a tool to plan work, projects, and estimates against
real team capacity — and, just as importantly, to communicate that plan back to
stakeholders: explaining tradeoffs, surfacing risk early, and showing what is and
isn't realistic in a quarter.

The tool unifies the three capacity spreadsheets in use today into one coherent
model, and serves managers, directors, and VPs/CTOs from that single model at
different altitudes.

## Source material

Three existing source spreadsheets, read in full, represent three layers of the same
problem:

1. **Per-engineer effective-capacity model** (bottom-up, hours). Base 160 hrs/mo,
   minus overhead deductions (PTO, sick, holidays, company events, offsites,
   meetings/rituals, PR reviews, cross-functional support, L&D ≈ 49%), times a
   **level multiplier** (Intern 0.70, L2/L3 1.00, Staff 0.85, Principal 0.70) and
   an **onboarding multiplier** (new hire month 1/2/3 = 0.25/0.5/0.75; mentor tax
   0.85/0.9/0.95). Produces *Effective Hours* and *Effective Working Days*.
2. **Team capacity in person-months** (top-down, %). Per team: availability-weighted
   member count, productive weeks left in the quarter (12 → 6 mid-Q),
   **Total Person Months Available**, minus P0/overhead reservations expressed as
   percentages (KTLO, bug intake, escalations, support, meetings, cross-func/PR,
   interviews, onboarding, PTO). A *person-month* = two 10-day sprints.
3. **Sprint allocation timeline** (Gantt). Per-engineer, sprint-by-sprint:
   deliverable vs KTLO, on-call primary/secondary, onboarding stage, PTO.

The pipeline is: **per-engineer effective capacity → team person-months available
after carve-outs → committed to specific work per sprint.**

## Key decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Data model | **Unify** the three sheets into one pipeline; one source of truth. |
| Form factor | **Local web app + Python engine + Claude skill.** |
| Data ownership | **App is source of truth.** One-time import seeds it; exports to Sheets/Slides/Markdown for sharing. |
| Scope | **Role-based**, not team-count based. Scope = the org subtree you own. Managers author; directors and VPs/CTOs read roll-ups. |
| Estimation | **Progressive fidelity ladder**: T-shirt → person-months → sprint allocation, all with uncertainty ranges. |
| Comms outputs | All four: tradeoff scenarios, capacity-vs-commitment summary, risk & assumptions callouts, narrative/exec summary. |
| Architecture | Approach A: deterministic engine + thin web app + skill. |

## Foundational principle

**The capacity math is deterministic code — a tested engine that is the single
source of numeric truth. Claude never invents numbers; it explains, narrates, and
runs scenarios *through* the engine.** A VP must be able to trust that
"1.5 person-months oversubscribed" is real, not an LLM guess.

## Architecture

Three layers plus a versioned data store:

```
Claude skill ("capacity-planning")
  • one-time import from Google Sheets → seed model
  • drive scenarios in natural language
  • generate narratives / exec summaries
  • validate plans, flag risks, export to Sheets/Slides/MD
        │ calls (never invents numbers)
        ▼
Capacity engine (Python)            Local web app
  • pure, tested functions      ◄──   • React/Vite frontend
  • SINGLE source of numeric          • FastAPI server (thin)
    truth                       ──►   • roster editing, sliders,
  • supply, demand, scenarios,          charts, role-aware views
    risk detection
        │ reads/writes
        ▼
Data store: version-controlled JSON files
  (git history = audit trail; app edits them, humans don't hand-edit)
```

Repo layout:

```
capacity-planning/
  engine/    # Python: capacity math, demand, scenarios, risks (pure, unit-tested)
  server/    # FastAPI: thin HTTP layer over engine + JSON store
  web/       # React/Vite: editing UI, sliders, charts, role views
  data/      # versioned JSON: org, teams, engineers, quarters, deliverables, scenarios
  skill/     # the Claude skill: SKILL.md + import/export/narrative helpers
  tests/     # engine unit tests + golden-file tests vs. the source sheets
```

Rationale: the engine is usable headless (skill, tests, CI) and behind the app, so
the math is written and tested once. The web app stays thin (rendering + calling
the engine). The skill is the intelligence + communication layer.

## Data model

Entities, normalized so nothing is double-defined:

**Org hierarchy (enables role-aware scope)**
`Org → Group (a director's/VP's span) → Team → Engineer`. Scope is "the subtree you
own," so a manager with 1 team, a manager with 3, a director, and a VP all use the
same model at different roots.

**Engineer**
`name`, `level` (→ level multiplier), `team(s)` with `availability` per team
(fractional 1 / 0.5 / 0.25, supporting cross-team loans), `onboarding_state`
(new-hire month 1–3 / mentor month 1–3 / none → multiplier), `planned_time_off`
(date ranges).

**Quarter / calendar**
`productive_weeks` per team (the 12 → 6 figure; calendar-level downtime like winter
break, the company offsite, offsites lives here), sprint boundaries, "as-of" date so a plan
can be re-cut mid-quarter.

**Overhead taxonomy**
A single list of overhead categories, each tagged `level: individual | team`, so
each cost is counted exactly once (see Capacity math).

**Deliverable (demand)**
`title`, `type` (deliverable / tech-debt / KTLO), `estimate` with `fidelity`
(tshirt | person_months | sprint_allocation) and an **uncertainty range**
(low/expected/high), `priority`, optional `target_date`, optional per-sprint
`allocations` (engineer → sprint), `jira_epic` link.

**Scenario**
A named overlay of changes (diff) on the baseline — add/remove engineer, shift
dates, change KTLO %, add/cut deliverable. Scenarios are diffs so "Plan of Record"
vs. "if we hire 1 L3" compare side by side without forking data.

**Plan / snapshot**
An immutable capture of (supply + demand + scenario) at a date — what you export
and what leadership reads. Git history gives the audit trail.

Design note: **Engineer × Team availability is a join, not a field** — this is what
lets one person sit on multiple teams and lets roll-ups sum correctly without
double-counting a loaned engineer.

## Capacity math (the crux: unify without double-counting)

Today Sheet 1 counts meetings/PR/PTO/onboarding as per-engineer hours, and Sheet 2
counts many of the same things again as team-level %. The unifying rule:

> **Each overhead category is tagged `individual` or `team` — never both.
> Validation rejects a config where a category appears in both buckets.**

**Bucket A — Individual always-on overhead** (baked into each person's effective
capacity, per Sheet 2's own note that a person-month already accounts for
rituals/reviews/etc.): team rituals & meetings, PR reviews, baseline cross-functional
support, L&D, routine sick/PTO accrual. Reduces the per-engineer *baseline factor*.

**Bucket B — Calendar-level downtime** (handled via `productive_weeks`, not as
hours or %): holidays, winter break, the company offsite, offsites, large planned-vacation
clusters. Sheet 2 already does this ("12 weeks minus expected downtime"); we keep it
there and remove it from Sheet 1's hour deductions so it isn't subtracted twice.

**Bucket C — Team discretionary reservations** (the quarter-by-quarter planning
choices, the only things left as team-level %): KTLO, bug intake (≥10% per OKRs),
escalations/incidents, dedicated support rotation, extra cross-func, interviews.
Carved off the team pool.

**Onboarding** is handled once, at the individual level (ramp multiplier on the new
hire + mentor tax on the mentor — more accurate than a flat team %), and removed
from team %.

Calculation pipeline:

```
1. Per engineer, per quarter:
     effective_capacity =
         availability_on_team           # 1 / 0.5 / 0.25
       × level_multiplier               # Intern .70, L2/L3 1.0, Staff .85, Principal .70
       × onboarding_multiplier          # new-hire ramp / mentor tax / 1.0
       × individual_baseline_factor     # = 1 − Bucket-A overhead %, per-level

2. Gross team person-months =
       Σ(effective_capacity over engineers) × productive_weeks ÷ 4
       # 1 person-month = 4 productive weeks of one full-time engineer
       # (matches Sheet 2: 4.5 members × 12 wks ÷ 4 = 13.5 PM)

3. Net roadmap person-months =
       Gross × (1 − Σ Bucket-C reservations %)

4. Fit =
       Net roadmap PM − Σ(deliverable estimates)
       # >0 headroom, <0 oversubscribed; carried with the uncertainty range
```

Upgrade over the current sheets: step 2 today is a crude `#members × weeks ÷ 4` with
a flat 1.0 per head. Here a Staff at 0.85 and a month-1 hire at 0.25 contribute
their real effective capacity, so the person-month total is honest and the
per-engineer detail (Sheet 1) and team total (Sheet 2) can never disagree — one is
literally the sum of the other.

Every % and multiplier is **configurable per team** (Checkout KTLO 70%, Notifications
55%) with sheet values as defaults. The engine preserves the **current-vs-ideal**
comparison those two teams already track.

## Demand, scenarios & risk detection

**Estimation fidelity ladder** — a deliverable can live at any rung and firm up over
time:
- **T-shirt** (S/M/L/XL) → person-month ranges with wide uncertainty.
- **Person-months** → low/expected/high estimate (the quarter-fit unit).
- **Sprint allocation** → engineer×sprint grid (the Sheet 3 Gantt); auto-rolls up
  into person-months so the fit check works at any rung.

Uncertainty propagates: the fit result is a range ("expected: 1.2 PM headroom;
pessimistic: 0.8 PM oversubscribed").

**Scenario engine** — scenarios are composable diffs on the baseline, compared
side-by-side. Levers:
- Supply: add/remove engineer, change availability, change level/onboarding, add/clear
  PTO, change productive weeks.
- Demand: add/cut/resize a deliverable, change priority or target date.
- Reservations: change any Bucket-C % (e.g. KTLO 70% → 40% ideal).

Each scenario re-runs the pipeline and reports the delta vs. Plan-of-Record. This is
the engine behind "if you want X by Y, here's what slips."

**Risk detection** — deterministic rules over the model, surfaced automatically,
each data-linked (names the engineer/deliverable/sprint):
- Oversubscription (demand > net PM, at expected or pessimistic).
- Onboarding drag (ramp + mentor tax materially cutting a quarter's output).
- Single point of failure (one engineer carrying a deliverable with no backup;
  on-call concentration).
- KTLO creep (reservations trending up vs. ideal / prior quarter).
- PTO clusters (overlapping time off in the same sprint).
- Optimistic estimates (wide uncertainty on high-priority work).

## Role-aware web app views

One model, three lenses. Scope = the subtree you own.

**Manager view — author mode** (polished first):
```
┌─ Checkout · Q2 2026 ───────────────────────── as of May 29 ┐
│ Roster (effective capacity)        Net roadmap: 5.3 PM      │
│  Maya   L3   1.0  ████████ 0.82                             │
│  Priya  L3   1.0  ████████ 0.82    Demand:      6.1 PM      │
│  Tom    L2   0.5  ███░ 0.38        ──────────────────────   │
│  Kofi   L3 onb-m1 0.25 █ 0.21      ⚠ −0.8 PM oversubscribed │
│                                       (−1.4 pessimistic)    │
│ Deliverables          est(PM)  fidelity   risk              │
│  Checkout Redesign     2.5     P-M         —                 │
│  Search v2 GA          1.8     T-shirt L   ⚠ wide estimate  │
│  Smart Replies         1.8     sprint      ⚠ SPOF: Sara     │
│ [ + deliverable ]   [ run scenario ▸ ]   [ export ▸ ]       │
└─────────────────────────────────────────────────────────────┘
```
Editable roster, sliders for availability/reservations, deliverable cards draggable
along the fidelity ladder, a live fit bar that recomputes instantly.

**Director view — roll-up / read mode:** a grid of owned teams — net PM, fit
(green/amber/red), KTLO-vs-ideal, top risks per team — with drill-down into any
team's manager view.

**VP / CTO view — portfolio read:** org-level supply vs. roadmap commitment, the
deliverable-vs-KTLO-vs-overhead split across the org, biggest tradeoffs and risks
rolled up. Investment signal, not editing.

Leadership views are **read + scenario-only** (they can explore "what if we add 2
headcount to Search" but not edit a manager's roster), keeping authorship with
managers.

## Communication outputs & the Claude skill

All four outputs are generated *from* the engine (numbers real, language from Claude):

1. **Tradeoff scenarios** — "If Search v2 GA ships by end of Q2, then either
   Smart Replies slips a sprint, or KTLO drops to 60%, or we add 1 L3." Each
   option carries its capacity math and side effects.
2. **Capacity-vs-commitment one-pager** — headline fit + deliverable/KTLO/overhead
   split. The "are we being realistic?" artifact.
3. **Risk & assumptions callouts** — auto-detected risks plus the explicit
   assumptions a plan rests on (estimates, productive weeks, headcount timing).
4. **Narrative / exec summary** — plain-language writeup at the altitude of the
   audience.

**Exports:** Google Sheets (clean snapshot), Slides (exec deck), Markdown. Built on
the read-only Drive scope today; confirm before writing back to Drive.

**The Claude skill (`SKILL.md`)** — orchestration + judgment layer:
- **Import/bootstrap:** read the three sheets once, map into the JSON model, show
  inferred mapping, let the user correct.
- **Converse:** "plan Checkout for Q2," "what if Kofi ramps slower," "compare
  against losing Tom" → translate to engine scenario calls, never hand-compute.
- **Narrate:** turn engine output into the four artifacts at the right altitude.
- **Validate & challenge:** flag double-booked loaned engineers, optimistic
  estimates, reservations drifting from ideal.
- **Export:** generate snapshot/deck/doc.

Hard line: **the skill calls the engine for every number.** It may phrase,
prioritize, and explain — never invent a figure.

## Testing & error handling

- **Engine unit tests** for every formula (multipliers, the 4-step pipeline, fit,
  each risk rule).
- **Golden-file tests:** seed the engine from the actual sheets and assert it
  reproduces known person-month totals (e.g. Platform = 13.5 PM, Notifications = 10.5
  PM) — proving the unified model is faithful before it's trusted.
- **Validation as first-class:** reject configs that double-count an overhead
  category, mis-sum cross-team availability, use negative productive weeks, or omit
  estimate uncertainty. Errors are explained in plain language (no stack traces to
  the user).
- **Property tests:** roll-ups always equal the sum of their parts (director total =
  Σ teams); scenarios never mutate the baseline.

## Out of scope (for this version)

- Hosted multi-user server with auth and a shared live database (Approach C). The
  data model is designed so this is an additive future step, not a rewrite.
- Two-way live sync with the Google Sheets (export only, plus one-time import).
- Automated Jira/Linear estimate ingestion (manual links only for now).

## Open questions for implementation planning

- Exact per-level `individual_baseline_factor` values (derive from Sheet 1's
  reference tables vs. set as configurable defaults).
- Whether the one-time import targets all ~13 teams at once or one team to start.
- Charting library for the web app (kept thin regardless).
