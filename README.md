# Engineering Capacity Planner

**Live:** https://patriciagoh.github.io/engineering-capacity-planner/

A capacity-planning tool for engineering managers — plan a quarter against real
team capacity, run what-if scenarios, and communicate tradeoffs to stakeholders.

It models the gap between **supply** (what a team can actually deliver, after
overhead, levels, and onboarding ramp) and **demand** (the projects on the
roadmap, estimated in person-months), and surfaces the fit — with the math
living in a deterministic, tested TypeScript engine so the numbers are
trustworthy, not guessed.

> The sample org in this repo is fictional — generic team and person names for
> illustration only.

---

## The model

For a team over a window (`weeks = 4.33` monthly, `12` quarterly):

```
effFTE      = Σ roster ( alloc × level multiplier × onboarding multiplier )
productive  = max(0, 1 − overhead%)        // share of the week that reaches real work
grossPM     = effFTE × (weeks / 4) × productive
netPM       = grossPM × (1 − KTLO%)        // free for projects  ← the headline
demand      = Σ project estimates (person-months)
fit         = netPM − demand               // + spare, − oversubscribed
```

Level and onboarding multipliers discount a ramping hire or a leadership-heavy
senior; overhead (meetings, PTO, reviews…) and KTLO ("keep the lights on":
support, incidents, interviews) are reserved before any project work. Every
displayed number traces back to inputs through these formulas — nothing is
hard-coded. The seeded Aurora team works out to **2.7 net person-months**.

---

## Architecture

This is a single-app React SPA. There is no server to run.

```
web/
  src/
    engine/       # Pure TypeScript capacity engine — the source of truth for all math
    data/         # Six-team seed org; CUR = 2 (Aurora open by default)
    state/        # useReducer store: teams[], cur, view (computed values always re-derived)
    components/   # Shared UI primitives (tokens-only, no raw hex)
    screens/      # Manager, Director, PM lenses
    export/       # CSV, JSON, and print exporters
  reference/      # The handoff prototype (Capacity Dashboard.html + screenshots)
docs/
  superpowers/    # Design spec and implementation plans
```

The invariant throughout: **only the engine computes capacity math.** The store
holds inputs; components format and draw. Computed values (netPM, fit, etc.) are
always derived live via selectors — never stored.

### Three lenses

| Lens | Audience | What it shows |
|------|----------|---------------|
| **Manager** | Team lead | Roster, per-engineer load, overhead sliders, KTLO breakdown, deliverables fit bar |
| **VP Director** | Director / VP | Every team's supply, demand, and fit at a glance; click any team to drill in |
| **PM** | Product manager | Enter an estimate; get a verdict on whether it lands this quarter |

All three lenses share the same live state — edits in Manager are immediately
reflected in Director and PM.

---

## Run

```bash
cd web
npm install
npm run dev
# open the printed URL (typically http://localhost:5173/engineering-capacity-planner/)
```

---

## Test

```bash
cd web
npm test           # vitest — all suites (engine, state, components, screens, a11y)
npm run typecheck  # tsc --noEmit; must be clean before merging
npm run lint:tokens  # guardrail: no raw hex or font literals in components/screens
```

---

## Build

```bash
cd web
npm run build      # tsc -b && vite build → writes web/dist/
```

The Vite `base` is `/engineering-capacity-planner/`, matching the GitHub Pages
repo path.

---

## Deploy

Pushing to `main` runs CI (`.github/workflows/ci.yml`: typecheck → token
guardrail → tests → build) and, on success, deploys `web/dist` to GitHub Pages
(`.github/workflows/deploy.yml`). Pages is configured to build from GitHub
Actions.

> **Lockfile caveat.** A `package-lock.json` regenerated on macOS can omit the
> Linux `@rollup/rollup-*` optional packages, which makes `npm ci` fail on the
> Pages runner (`Cannot find module @rollup/rollup-linux-x64-gnu`, npm/cli#4828).
> If you regenerate the lock, do a clean `rm -rf node_modules package-lock.json
> && npm install` and confirm `node_modules/@rollup/rollup-linux-x64-gnu` is a
> real entry in the lock (≈25 `@rollup/rollup-*` platform entries) before pushing.

---

## Tech stack

- React 19, TypeScript, Vite, Tailwind CSS 3
- [matcha-oat-design-system](https://github.com/patriciagoh/matcha-oat-design-system)
  — the design tokens, consumed via its Tailwind preset; real color/font values
  live only there. App-specific aliases sit in `web/src/styles/tokens.planner.css`;
  a `lint:tokens` guardrail fails the build on any raw hex or font literal in
  `components/`/`screens/`.
- Lucide icons
- Vitest + @testing-library + vitest-axe
- Node 20

---

## Reference and design docs

- **Prototype:** `web/reference/Capacity Dashboard.html` — the handoff HTML used
  as the markup and copy source. Port it faithfully; only the tokens change.
- **Design spec:** `docs/superpowers/specs/2026-06-03-engineering-capacity-planner-matcha-oat-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-06-03-engineering-capacity-planner.md`
