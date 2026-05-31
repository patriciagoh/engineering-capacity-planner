# Capacity Planning

A capacity-planning tool for engineering managers — plan a quarter against *real*
team capacity, run what-if scenarios, and communicate tradeoffs to stakeholders.

It models the gap between **supply** (what a team can actually deliver, after
overhead, levels, and onboarding ramp) and **demand** (the work, estimated at
whatever fidelity you have), and surfaces the fit — with the math living in a
deterministic, tested engine so the numbers are trustworthy, not guessed.

> The sample data in this repo (`server/data/sample_org.json`, test fixtures) is
> fictional — generic team and person names for illustration.

## The model

- **Per-engineer effective capacity** — availability × level multiplier ×
  onboarding multiplier × an always-on-overhead baseline factor.
- **Team person-months** — effective capacity × productive weeks ÷ 4, minus
  team-level reservations (KTLO, bug intake, escalations, …).
- **Demand** — a fidelity ladder (T-shirt → person-months → sprint allocation)
  with low/expected/high uncertainty that propagates into the fit.
- **One overhead category is counted once** — individual overhead in the baseline
  factor, calendar downtime in productive weeks, discretionary work in team
  reservations; validation rejects double-counting.
- **Scenarios** are immutable diffs; **risk detection** (oversubscription,
  single-point-of-failure) is deterministic and data-linked.
- **Hierarchy** — Group → Team, so directors/VPs read roll-ups across the teams
  they own (loaned engineers are never double-counted).

## Layout

```
engine/   # Python: the deterministic capacity engine (stdlib only). The source of truth.
server/   # FastAPI: a thin HTTP API over the engine. Serializes results; invents no numbers.
web/      # Vite + React + TypeScript: the manager & director UI.
docs/     # Design spec and implementation plans.
```

The invariant throughout: **only the engine computes capacity math.** The server
serializes engine results; the UI only formats and draws bars.

## Run it

**API** (Python 3.11+):

```bash
cd engine && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
cd ../server && python3 -m venv .venv && . .venv/bin/activate \
  && pip install -e ../engine && pip install -e ".[dev]"
uvicorn 'capacity_server.app_seeded:create_seeded_app' --factory --port 8000
```

**Web** (Node 20+), in another terminal:

```bash
cd web && npm install && npm run dev
# open the printed URL; it proxies the API on :8000
```

Toggle **Manager** to plan a team (roster, fit bar, deliverables, risks, KTLO
what-if slider); toggle **Director** for the per-team roll-up.

## Test

```bash
cd engine  && . .venv/bin/activate && pytest -q   # engine
cd server  && . .venv/bin/activate && pytest -q   # API
cd web     && npm test                            # frontend
```

## Status

Engine, API, and web app are implemented and tested. A Claude skill for sheet
import, conversational scenarios, and stakeholder-narrative export is planned.
