# Capacity API + Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the capacity engine over a local HTTP API, and complete the engine's deferred org-hierarchy so directors/VPs can read roll-ups across the teams they own.

**Architecture:** Two layers. First, extend `capacity_engine` with a `plan_team` orchestration helper, a `Group` hierarchy (Group → Team), and a `rollup_group` aggregation — all pure, tested functions. Second, a thin FastAPI `server` package that holds one org in app state (loaded from a JSON file via the engine's store), translates HTTP ↔ engine, and calls the engine for every number. The server invents no math; it serializes engine results.

**Tech Stack:** Python 3.11+, `capacity_engine` (existing), FastAPI, uvicorn, httpx (for TestClient), pytest. The engine stays stdlib-only; new third-party deps live only in the `server` package.

---

## Context for the implementer

The engine is complete and merged on `main` under `engine/capacity_engine/` with this public API (see `engine/capacity_engine/__init__.py`): `Org, Group?`(no — Group does not exist yet, this plan adds it), `Team, Engineer, Deliverable, Estimate, OverheadCategory, Quarter`, the enums `Level/OnboardingState/Fidelity/DeliverableType`, `OverheadLevel`, `effective_capacity, gross_person_months, net_person_months, normalize_estimate, total_demand, DemandRange, compute_fit, FitResult, apply_scenario, Change, SetAvailability, SetReservation, RemoveEngineer, AddEngineer, detect_risks, Risk, Severity, validate_org, ValidationError, load_org, save_org, org_to_dict, org_from_dict`.

Key engine facts the implementer must rely on:
- `Org.team(team_id)` raises `KeyError` if missing. `Org.engineers_on(team_id)` returns engineers with availability > 0 there. `Org.deliverables_for(team_id)` returns deliverables whose owners are on the team.
- `gross_person_months(roster, team, baseline_factor=DEFAULT_BASELINE_FACTOR)`, `net_person_months(gross_pm, team)`, `total_demand(deliverables) -> DemandRange`, `compute_fit(net_pm, demand) -> FitResult`, `detect_risks(org, team_id, fit) -> list[Risk]`.
- `Team` currently has: `id, name, productive_weeks, reservations, ideal_reservations`. This plan ADDS `group_id`.
- `Org` currently has: `teams, engineers, deliverables, quarter`. This plan ADDS `groups`.
- The engine venv is at `engine/.venv/`. Run engine tests with `cd engine && . .venv/bin/activate && pytest -q`.

Work from `/Users/patricia/capacity-planning` on a feature branch.

## File Structure

```
capacity-planning/
  engine/capacity_engine/
    planning.py        # NEW: plan_team() + TeamPlan, rollup_group() + GroupRollup
    models.py          # MODIFY: add Group dataclass, Team.group_id, Org.groups + helpers
    store.py           # MODIFY: (de)serialize groups + group_id
    validation.py      # MODIFY: validate group refs + acyclic parents
    __init__.py        # MODIFY: export Group, plan_team, TeamPlan, rollup_group, GroupRollup
  server/
    pyproject.toml     # NEW: fastapi, uvicorn, httpx, pytest; depends on engine
    capacity_server/
      __init__.py
      app.py           # NEW: FastAPI app factory, state, routes wiring
      state.py         # NEW: load/hold the active Org in app.state
      schemas.py       # NEW: pydantic request models (scenario changes, org upload)
      serialize.py     # NEW: engine result -> JSON-able dict
      routes.py        # NEW: endpoint handlers
    tests/
      conftest.py      # NEW: TestClient fixture seeded with a sample org
      test_health.py
      test_org.py
      test_team_plan.py
      test_scenario.py
      test_rollup.py
    data/
      sample_org.json  # NEW: a small seed org (Messaging Exp + Email under a group)
```

---

## Task 1: Engine — `plan_team` orchestration helper

**Files:**
- Create: `engine/capacity_engine/planning.py`
- Test: `engine/tests/test_planning.py`

This composes the four pipeline calls + risks into one result object, closing the "no single entry point" gap noted in Plan 1's final review.

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_planning.py`
```python
import pytest
from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
    Deliverable, DeliverableType, Estimate, Fidelity,
)
from capacity_engine.planning import plan_team, TeamPlan


def _org():
    team = Team(
        id="msg", name="Messaging Experience", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.5)],
    )
    eng = Engineer(id="dia", name="Dia", level=Level.L3,
                   assignments=[TeamAssignment("msg", 1.0)])
    deliv = Deliverable(
        id="d1", title="SunCo", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=2.0),
        owner_ids=["dia"],
    )
    return Org(teams=[team], engineers=[eng], deliverables=[deliv])


def test_plan_team_composes_pipeline():
    plan = plan_team(_org(), "msg", baseline_factor=1.0)
    assert isinstance(plan, TeamPlan)
    assert plan.team_id == "msg"
    # gross = 1.0 * 12 / 4 = 3.0 ; net = 3.0 * (1 - 0.5) = 1.5
    assert plan.gross_pm == pytest.approx(3.0)
    assert plan.net_pm == pytest.approx(1.5)
    assert plan.demand.expected == pytest.approx(2.0)
    # net 1.5 - demand 2.0 = -0.5 expected -> oversubscribed
    assert plan.fit.expected_delta == pytest.approx(-0.5)
    assert any(r.kind == "oversubscription" for r in plan.risks)


def test_plan_team_unknown_team_raises():
    with pytest.raises(KeyError):
        plan_team(_org(), "ghost")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_planning.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.planning'`.

- [ ] **Step 3: Write `engine/capacity_engine/planning.py`**

```python
"""Orchestration: compose the capacity pipeline into a single TeamPlan, and
aggregate team plans into a GroupRollup. Pure functions over the engine."""
from dataclasses import dataclass

from capacity_engine.capacity import (
    DEFAULT_BASELINE_FACTOR, gross_person_months, net_person_months,
)
from capacity_engine.demand import DemandRange, total_demand
from capacity_engine.fit import FitResult, compute_fit
from capacity_engine.models import Org
from capacity_engine.risks import Risk, detect_risks


@dataclass(frozen=True)
class TeamPlan:
    team_id: str
    team_name: str
    gross_pm: float
    net_pm: float
    demand: DemandRange
    fit: FitResult
    risks: list[Risk]


def plan_team(
    org: Org, team_id: str, baseline_factor: float = DEFAULT_BASELINE_FACTOR
) -> TeamPlan:
    """Compute the full plan for one team: capacity, demand, fit, and risks."""
    team = org.team(team_id)  # raises KeyError if unknown
    roster = org.engineers_on(team_id)
    gross = gross_person_months(roster, team, baseline_factor)
    net = net_person_months(gross, team)
    demand = total_demand(org.deliverables_for(team_id))
    fit = compute_fit(net, demand)
    risks = detect_risks(org, team_id, fit)
    return TeamPlan(
        team_id=team_id, team_name=team.name, gross_pm=gross, net_pm=net,
        demand=demand, fit=fit, risks=risks,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_planning.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/planning.py engine/tests/test_planning.py
git commit -m "feat(engine): add plan_team orchestration helper"
```

---

## Task 2: Engine — Group hierarchy in the model

**Files:**
- Modify: `engine/capacity_engine/models.py`
- Modify: `engine/capacity_engine/store.py`
- Test: `engine/tests/test_store.py` (append a hierarchy round-trip test)

- [ ] **Step 1: Write the failing test (append to `engine/tests/test_store.py`)**

```python
def test_org_round_trips_groups_and_group_id():
    from capacity_engine.models import Group
    org = Org(
        teams=[Team(id="msg", name="Messaging Experience", productive_weeks=12,
                    group_id="exp")],
        engineers=[],
        groups=[
            Group(id="eng", name="Engineering", parent_id=None),
            Group(id="exp", name="Experiences", parent_id="eng"),
        ],
    )
    restored = org_from_dict(org_to_dict(org))
    assert restored.team("msg").group_id == "exp"
    assert {g.id for g in restored.groups} == {"eng", "exp"}
    assert restored.group("exp").parent_id == "eng"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_store.py -q`
Expected: FAIL — `ImportError: cannot import name 'Group'` (or `AttributeError` on `group_id`).

- [ ] **Step 3: Modify `engine/capacity_engine/models.py`**

Add the `Group` dataclass immediately before the `Org` class:
```python
@dataclass
class Group:
    """A node in the org hierarchy (e.g. a director's or VP's span)."""
    id: str
    name: str
    parent_id: Optional[str] = None  # None for the root group
```

Add a `group_id` field to `Team` (after `ideal_reservations`):
```python
    group_id: Optional[str] = None
```

Add `groups` to `Org` (after `quarter`) and a `group()` helper. The `Org` class becomes:
```python
@dataclass
class Org:
    """Root container. Teams may belong to a Group; groups nest via parent_id."""
    teams: list[Team] = field(default_factory=list)
    engineers: list[Engineer] = field(default_factory=list)
    deliverables: list[Deliverable] = field(default_factory=list)
    quarter: Optional[Quarter] = None
    groups: list["Group"] = field(default_factory=list)

    def team(self, team_id: str) -> Team:
        for t in self.teams:
            if t.id == team_id:
                return t
        raise KeyError(f"unknown team: {team_id}")

    def group(self, group_id: str) -> "Group":
        for g in self.groups:
            if g.id == group_id:
                return g
        raise KeyError(f"unknown group: {group_id}")

    def teams_in_group(self, group_id: str) -> list[Team]:
        """All teams whose group_id is `group_id` or any descendant group."""
        descendants = {group_id}
        changed = True
        while changed:
            changed = False
            for g in self.groups:
                if g.parent_id in descendants and g.id not in descendants:
                    descendants.add(g.id)
                    changed = True
        return [t for t in self.teams if t.group_id in descendants]

    def engineers_on(self, team_id: str) -> list[Engineer]:
        return [e for e in self.engineers if e.availability_on(team_id) > 0]

    def deliverables_for(self, team_id: str) -> list[Deliverable]:
        result = []
        for d in self.deliverables:
            if any(self._on_team(oid, team_id) for oid in d.owner_ids):
                result.append(d)
        return result

    def _on_team(self, engineer_id: str, team_id: str) -> bool:
        for e in self.engineers:
            if e.id == engineer_id:
                return e.availability_on(team_id) > 0
        return False
```
(Keep the existing `team`, `engineers_on`, `deliverables_for`, `_on_team` bodies exactly as they were — only add `group`, `teams_in_group`, the `groups` field, and update the docstring.)

- [ ] **Step 4: Modify `engine/capacity_engine/store.py`**

In `org_to_dict`, add a `"groups"` key and a `group_id` on each team. The team dict gains `"group_id": t.group_id`, and add at the top level:
```python
        "groups": [
            {"id": g.id, "name": g.name, "parent_id": g.parent_id}
            for g in org.groups
        ],
```
In `org_from_dict`, reconstruct groups and pass `group_id` to each `Team`:
```python
    from capacity_engine.models import Group  # add to the existing models import at top
    # team construction gains: group_id=t.get("group_id")
    # after deliverables/quarter:
    groups = [
        Group(id=g["id"], name=g["name"], parent_id=g.get("parent_id"))
        for g in data.get("groups", [])
    ]
    return Org(teams=teams, engineers=engineers, deliverables=deliverables,
               quarter=quarter, groups=groups)
```
(Add `Group` to the existing `from capacity_engine.models import (...)` block rather than a local import if cleaner; either works. Ensure `Team(...)` construction includes `group_id=t.get("group_id")`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_store.py -q`
Expected: PASS (all store tests, including the new hierarchy round-trip).

- [ ] **Step 6: Commit**

```bash
git add engine/capacity_engine/models.py engine/capacity_engine/store.py engine/tests/test_store.py
git commit -m "feat(engine): add Group hierarchy (Group, Team.group_id, Org.groups)"
```

---

## Task 3: Engine — hierarchy validation + `rollup_group`

**Files:**
- Modify: `engine/capacity_engine/validation.py`
- Modify: `engine/capacity_engine/planning.py` (append `GroupRollup` + `rollup_group`)
- Test: `engine/tests/test_validation.py` (append), `engine/tests/test_planning.py` (append)

- [ ] **Step 1: Write the failing validation tests (append to `engine/tests/test_validation.py`)**

```python
from capacity_engine.models import Group


def test_team_unknown_group_rejected():
    org = _valid_org()
    org.teams[0].group_id = "ghost"
    with pytest.raises(ValidationError, match="unknown group"):
        validate_org(org)


def test_group_unknown_parent_rejected():
    org = _valid_org()
    org.groups.append(Group(id="g1", name="G1", parent_id="missing"))
    with pytest.raises(ValidationError, match="unknown parent"):
        validate_org(org)


def test_group_cycle_rejected():
    org = _valid_org()
    org.groups.append(Group(id="a", name="A", parent_id="b"))
    org.groups.append(Group(id="b", name="B", parent_id="a"))
    with pytest.raises(ValidationError, match="cycle"):
        validate_org(org)
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_validation.py -q`
Expected: FAIL — the new checks don't exist yet (no error raised / wrong error).

- [ ] **Step 3: Add hierarchy validation to `engine/capacity_engine/validation.py`**

Append inside `validate_org`, after the existing team loop and before the engineer loop:
```python
    group_ids = {g.id for g in org.groups}

    for t in org.teams:
        if t.group_id is not None and t.group_id not in group_ids:
            raise ValidationError(
                f"team {t.name!r}: group_id {t.group_id!r} refers to an unknown group"
            )

    for g in org.groups:
        if g.parent_id is not None and g.parent_id not in group_ids:
            raise ValidationError(
                f"group {g.name!r}: parent_id {g.parent_id!r} refers to an unknown parent"
            )

    # Detect cycles by walking parent links from each group.
    parent_of = {g.id: g.parent_id for g in org.groups}
    for start in parent_of:
        seen = set()
        cur = start
        while cur is not None:
            if cur in seen:
                raise ValidationError(
                    f"group hierarchy has a cycle involving {start!r}"
                )
            seen.add(cur)
            cur = parent_of.get(cur)
```

- [ ] **Step 4: Run validation tests to verify pass**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_validation.py -q`
Expected: PASS (all validation tests).

- [ ] **Step 5: Write the failing rollup test (append to `engine/tests/test_planning.py`)**

```python
from capacity_engine.models import Group
from capacity_engine.planning import rollup_group, GroupRollup


def _two_team_org():
    g = Group(id="exp", name="Experiences", parent_id=None)
    msg = Team(id="msg", name="Msg", productive_weeks=12, group_id="exp")
    email = Team(id="email", name="Email", productive_weeks=12, group_id="exp")
    engs = [
        Engineer(id="dia", name="Dia", level=Level.L3,
                 assignments=[TeamAssignment("msg", 1.0)]),
        Engineer(id="leah", name="Leah", level=Level.L3,
                 assignments=[TeamAssignment("email", 1.0)]),
    ]
    return Org(teams=[msg, email], engineers=engs, groups=[g])


def test_rollup_group_aggregates_member_teams():
    org = _two_team_org()
    rollup = rollup_group(org, "exp", baseline_factor=1.0)
    assert isinstance(rollup, GroupRollup)
    assert rollup.group_id == "exp"
    assert {tp.team_id for tp in rollup.team_plans} == {"msg", "email"}
    # each team gross = 1.0 * 12 / 4 = 3.0 ; total 6.0
    assert rollup.total_gross_pm == pytest.approx(6.0)
    assert rollup.total_net_pm == pytest.approx(6.0)  # no reservations
    assert rollup.total_demand.expected == pytest.approx(0.0)  # no deliverables
```

- [ ] **Step 6: Run to verify failure**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_planning.py -q`
Expected: FAIL — `ImportError: cannot import name 'rollup_group'`.

- [ ] **Step 7: Append `GroupRollup` + `rollup_group` to `engine/capacity_engine/planning.py`**

```python
@dataclass(frozen=True)
class GroupRollup:
    group_id: str
    group_name: str
    team_plans: list[TeamPlan]
    total_gross_pm: float
    total_net_pm: float
    total_demand: DemandRange
    fit: FitResult  # computed from total_net_pm vs total_demand


def rollup_group(
    org: Org, group_id: str, baseline_factor: float = DEFAULT_BASELINE_FACTOR
) -> GroupRollup:
    """Aggregate plans across every team in a group's subtree.

    Summing per-team person-months is correct even for loaned engineers: each
    engineer's per-team availability is validated to sum to <= 1.0, so a 0.5/0.5
    split contributes 0.5 to each team and is never double-counted.
    """
    group = org.group(group_id)  # raises KeyError if unknown
    teams = org.teams_in_group(group_id)
    plans = [plan_team(org, t.id, baseline_factor) for t in teams]
    total_gross = sum(p.gross_pm for p in plans)
    total_net = sum(p.net_pm for p in plans)
    total_demand = DemandRange(
        low=sum(p.demand.low for p in plans),
        expected=sum(p.demand.expected for p in plans),
        high=sum(p.demand.high for p in plans),
    )
    return GroupRollup(
        group_id=group_id, group_name=group.name, team_plans=plans,
        total_gross_pm=total_gross, total_net_pm=total_net,
        total_demand=total_demand, fit=compute_fit(total_net, total_demand),
    )
```

- [ ] **Step 8: Run to verify pass**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_planning.py -q`
Expected: PASS (all planning tests).

- [ ] **Step 9: Update engine public API and commit**

Edit `engine/capacity_engine/__init__.py`: add to imports
```python
from capacity_engine.models import (  # add Group to this existing block
    ..., Group,
)
from capacity_engine.planning import (
    plan_team, TeamPlan, rollup_group, GroupRollup,
)
```
and add `"Group", "plan_team", "TeamPlan", "rollup_group", "GroupRollup"` to `__all__`.

Run the FULL engine suite: `cd engine && . .venv/bin/activate && pytest -q` (expect all green), then:
```bash
git add engine/capacity_engine/validation.py engine/capacity_engine/planning.py engine/capacity_engine/__init__.py engine/tests/test_validation.py engine/tests/test_planning.py
git commit -m "feat(engine): hierarchy validation + rollup_group aggregation"
```

---

## Task 4: Server scaffold + health endpoint

**Files:**
- Create: `server/pyproject.toml`, `server/capacity_server/__init__.py`, `server/capacity_server/app.py`
- Create: `server/tests/conftest.py`, `server/tests/test_health.py`

- [ ] **Step 1: Create `server/pyproject.toml`**

```toml
[project]
name = "capacity_server"
version = "0.1.0"
description = "FastAPI server over the capacity engine"
requires-python = ">=3.11"
dependencies = ["fastapi>=0.110", "uvicorn>=0.29", "capacity_engine"]

[project.optional-dependencies]
dev = ["pytest>=8.0", "httpx>=0.27"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]

[tool.setuptools.packages.find]
where = ["."]
include = ["capacity_server*"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 2: Create `server/capacity_server/__init__.py`**

```python
"""FastAPI server exposing the capacity engine."""
```

- [ ] **Step 3: Write the failing test**

File: `server/tests/test_health.py`
```python
def test_health_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

File: `server/tests/conftest.py`
```python
import pytest
from fastapi.testclient import TestClient

from capacity_server.app import create_app


@pytest.fixture
def client():
    return TestClient(create_app())
```

- [ ] **Step 4: Create the venv and install (engine first, then server)**

Run:
```bash
cd server && python3 -m venv .venv && . .venv/bin/activate && pip install -q -e ../engine && pip install -q -e ".[dev]"
```
Expected: installs `capacity_engine` (editable) and `capacity_server` + fastapi/httpx/pytest.

- [ ] **Step 5: Run test to verify it fails**

Run: `cd server && . .venv/bin/activate && pytest tests/test_health.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_server.app'`.

- [ ] **Step 6: Write `server/capacity_server/app.py`**

```python
"""FastAPI application factory."""
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Capacity Planning API", version="0.1.0")

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd server && . .venv/bin/activate && pytest tests/test_health.py -q`
Expected: PASS (1 passed).

- [ ] **Step 8: Commit**

```bash
git add server/pyproject.toml server/capacity_server/__init__.py server/capacity_server/app.py server/tests/conftest.py server/tests/test_health.py
git commit -m "feat(server): scaffold FastAPI app with health endpoint"
```

---

## Task 5: Server state + org load/replace endpoints

**Files:**
- Create: `server/capacity_server/state.py`, `server/capacity_server/serialize.py`, `server/capacity_server/routes.py`
- Modify: `server/capacity_server/app.py` (wire routes + seed state)
- Create: `server/data/sample_org.json`
- Modify: `server/tests/conftest.py` (seed the client with the sample org)
- Test: `server/tests/test_org.py`

- [ ] **Step 1: Create `server/data/sample_org.json`**

```json
{
  "quarter": {"id": "q2-2026", "label": "Q2 2026", "as_of": "2026-05-30"},
  "groups": [
    {"id": "eng", "name": "Engineering", "parent_id": null},
    {"id": "exp", "name": "Experiences", "parent_id": "eng"}
  ],
  "teams": [
    {"id": "msg", "name": "Messaging Experience", "productive_weeks": 12,
     "group_id": "exp",
     "reservations": [{"name": "KTLO", "level": "team", "fraction": 0.7}],
     "ideal_reservations": [{"name": "KTLO", "level": "team", "fraction": 0.4}]},
    {"id": "email", "name": "Email", "productive_weeks": 12, "group_id": "exp",
     "reservations": [{"name": "KTLO", "level": "team", "fraction": 0.55}],
     "ideal_reservations": []}
  ],
  "engineers": [
    {"id": "dia", "name": "Dia", "level": "L3", "onboarding_state": "none",
     "assignments": [{"team_id": "msg", "availability": 1.0}]},
    {"id": "claudia", "name": "Claudia", "level": "L3", "onboarding_state": "none",
     "assignments": [{"team_id": "msg", "availability": 1.0}]},
    {"id": "albert", "name": "Albert", "level": "L2", "onboarding_state": "none",
     "assignments": [{"team_id": "msg", "availability": 0.5}]},
    {"id": "leah", "name": "Leah", "level": "L3", "onboarding_state": "none",
     "assignments": [{"team_id": "email", "availability": 1.0}]},
    {"id": "andy", "name": "Andy", "level": "L3", "onboarding_state": "none",
     "assignments": [{"team_id": "email", "availability": 1.0}]}
  ],
  "deliverables": [
    {"id": "sunco", "title": "SunCo CPaaS", "type": "deliverable",
     "estimate": {"fidelity": "person_months", "low": 2.0, "expected": 2.5, "high": 3.5},
     "priority": 1, "owner_ids": ["dia"], "jira_epic": "MSG-1"},
    {"id": "twilio", "title": "GA Twilio Social", "type": "deliverable",
     "estimate": {"fidelity": "tshirt", "size": "L"},
     "priority": 2, "owner_ids": ["claudia"]}
  ]
}
```

- [ ] **Step 2: Write the failing test**

File: `server/tests/test_org.py`
```python
def test_get_org_returns_seeded(client):
    resp = client.get("/org")
    assert resp.status_code == 200
    body = resp.json()
    assert {t["id"] for t in body["teams"]} == {"msg", "email"}


def test_post_valid_org_replaces(client):
    new_org = {
        "teams": [{"id": "solo", "name": "Solo", "productive_weeks": 10,
                   "reservations": [], "ideal_reservations": []}],
        "engineers": [], "deliverables": [], "groups": [],
    }
    resp = client.post("/org", json=new_org)
    assert resp.status_code == 200
    assert {t["id"] for t in client.get("/org").json()["teams"]} == {"solo"}


def test_post_invalid_org_returns_400(client):
    bad = {  # reservation tagged individual -> validation error
        "teams": [{"id": "t", "name": "T", "productive_weeks": 12,
                   "reservations": [{"name": "Meetings", "level": "individual",
                                     "fraction": 0.1}],
                   "ideal_reservations": []}],
        "engineers": [], "deliverables": [], "groups": [],
    }
    resp = client.post("/org", json=bad)
    assert resp.status_code == 400
    assert "individual" in resp.json()["detail"]
```

Modify `server/tests/conftest.py` so the client is seeded from the sample file:
```python
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from capacity_engine.store import load_org
from capacity_server.app import create_app

SAMPLE = Path(__file__).parent.parent / "data" / "sample_org.json"


@pytest.fixture
def client():
    app = create_app(org=load_org(SAMPLE))
    return TestClient(app)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && . .venv/bin/activate && pytest tests/test_org.py -q`
Expected: FAIL — `create_app()` takes no `org` arg / no `/org` route.

- [ ] **Step 4: Write `server/capacity_server/state.py`**

```python
"""Holds the active Org for the server process."""
from capacity_engine.models import Org


class OrgStore:
    def __init__(self, org: Org | None = None):
        self._org = org if org is not None else Org()

    def get(self) -> Org:
        return self._org

    def set(self, org: Org) -> None:
        self._org = org
```

- [ ] **Step 5: Write `server/capacity_server/serialize.py`**

```python
"""Convert engine result objects into JSON-able dicts for responses."""
from capacity_engine.demand import DemandRange
from capacity_engine.fit import FitResult
from capacity_engine.planning import GroupRollup, TeamPlan
from capacity_engine.risks import Risk


def demand_to_dict(d: DemandRange) -> dict:
    return {"low": d.low, "expected": d.expected, "high": d.high}


def fit_to_dict(f: FitResult) -> dict:
    return {
        "net_pm": f.net_pm,
        "demand": demand_to_dict(f.demand),
        "optimistic_delta": f.optimistic_delta,
        "expected_delta": f.expected_delta,
        "pessimistic_delta": f.pessimistic_delta,
        "is_oversubscribed_expected": f.is_oversubscribed_expected,
    }


def risk_to_dict(r: Risk) -> dict:
    return {"kind": r.kind, "severity": r.severity.value, "detail": r.detail}


def team_plan_to_dict(p: TeamPlan) -> dict:
    return {
        "team_id": p.team_id,
        "team_name": p.team_name,
        "gross_pm": p.gross_pm,
        "net_pm": p.net_pm,
        "demand": demand_to_dict(p.demand),
        "fit": fit_to_dict(p.fit),
        "risks": [risk_to_dict(r) for r in p.risks],
    }


def rollup_to_dict(r: GroupRollup) -> dict:
    return {
        "group_id": r.group_id,
        "group_name": r.group_name,
        "total_gross_pm": r.total_gross_pm,
        "total_net_pm": r.total_net_pm,
        "total_demand": demand_to_dict(r.total_demand),
        "fit": fit_to_dict(r.fit),
        "team_plans": [team_plan_to_dict(p) for p in r.team_plans],
    }
```

- [ ] **Step 6: Write `server/capacity_server/routes.py` (org routes for this task)**

```python
"""Endpoint handlers. The store is read from app.state."""
from fastapi import APIRouter, HTTPException, Request

from capacity_engine.store import org_from_dict, org_to_dict
from capacity_engine.validation import ValidationError, validate_org

router = APIRouter()


def _store(request: Request):
    return request.app.state.store


@router.get("/org")
def get_org(request: Request) -> dict:
    return org_to_dict(_store(request).get())


@router.post("/org")
def put_org(payload: dict, request: Request) -> dict:
    try:
        org = org_from_dict(payload)
        validate_org(org)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"malformed org: {exc}") from exc
    _store(request).set(org)
    return {"status": "ok", "teams": len(org.teams)}
```

- [ ] **Step 7: Modify `server/capacity_server/app.py` to wire state + routes**

```python
"""FastAPI application factory."""
from fastapi import FastAPI

from capacity_engine.models import Org
from capacity_server.routes import router
from capacity_server.state import OrgStore


def create_app(org: Org | None = None) -> FastAPI:
    app = FastAPI(title="Capacity Planning API", version="0.1.0")
    app.state.store = OrgStore(org)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    app.include_router(router)
    return app
```

- [ ] **Step 8: Run tests to verify pass**

Run: `cd server && . .venv/bin/activate && pytest tests/test_org.py tests/test_health.py -q`
Expected: PASS (4 passed).

- [ ] **Step 9: Commit**

```bash
git add server/capacity_server/state.py server/capacity_server/serialize.py server/capacity_server/routes.py server/capacity_server/app.py server/data/sample_org.json server/tests/conftest.py server/tests/test_org.py
git commit -m "feat(server): org state + GET/POST /org with validation"
```

---

## Task 6: Server — team plan endpoint

**Files:**
- Modify: `server/capacity_server/routes.py` (add `GET /teams/{team_id}/plan`)
- Test: `server/tests/test_team_plan.py`

- [ ] **Step 1: Write the failing test**

File: `server/tests/test_team_plan.py`
```python
def test_team_plan_msg(client):
    resp = client.get("/teams/msg/plan")
    assert resp.status_code == 200
    body = resp.json()
    assert body["team_id"] == "msg"
    # roster msg: Dia 1.0, Claudia 1.0, Albert 0.5 = 2.5 effective (L3/L2, none)
    # gross = 2.5 * 0.71 * 12 / 4 = 5.325 ; net = gross * (1 - 0.7)
    assert body["gross_pm"] == __import__("pytest").approx(5.325, abs=1e-3)
    assert body["net_pm"] == __import__("pytest").approx(5.325 * 0.30, abs=1e-3)
    assert "fit" in body and "risks" in body


def test_team_plan_unknown_team_404(client):
    resp = client.get("/teams/ghost/plan")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && . .venv/bin/activate && pytest tests/test_team_plan.py -q`
Expected: FAIL — no `/teams/{team_id}/plan` route (404 on the first test too, but the gross_pm assertion can't run).

- [ ] **Step 3: Add the route to `server/capacity_server/routes.py`**

Add imports at the top:
```python
from capacity_engine.planning import plan_team
from capacity_server.serialize import team_plan_to_dict
```
Add the handler:
```python
@router.get("/teams/{team_id}/plan")
def get_team_plan(team_id: str, request: Request) -> dict:
    try:
        plan = plan_team(_store(request).get(), team_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown team: {team_id}") from exc
    return team_plan_to_dict(plan)
```

- [ ] **Step 4: Run to verify pass**

Run: `cd server && . .venv/bin/activate && pytest tests/test_team_plan.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add server/capacity_server/routes.py server/tests/test_team_plan.py
git commit -m "feat(server): GET /teams/{id}/plan"
```

---

## Task 7: Server — scenario endpoint

**Files:**
- Create: `server/capacity_server/schemas.py`
- Modify: `server/capacity_server/routes.py` (add `POST /teams/{team_id}/scenario`)
- Test: `server/tests/test_scenario.py`

The endpoint accepts a list of typed changes, applies them via `apply_scenario` to a copy of the org, recomputes the team plan, and returns both the scenario plan and the per-metric deltas vs the baseline plan.

- [ ] **Step 1: Write the failing test**

File: `server/tests/test_scenario.py`
```python
def test_scenario_drop_ktlo_increases_net(client):
    base = client.get("/teams/msg/plan").json()
    payload = {"changes": [
        {"op": "set_reservation", "team_id": "msg", "name": "KTLO", "fraction": 0.4}
    ]}
    resp = client.post("/teams/msg/scenario", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    # lowering KTLO from 0.7 to 0.4 raises net PM
    assert body["plan"]["net_pm"] > base["net_pm"]
    assert body["delta"]["net_pm"] == __import__("pytest").approx(
        body["plan"]["net_pm"] - base["net_pm"], abs=1e-6
    )


def test_scenario_remove_engineer(client):
    payload = {"changes": [{"op": "remove_engineer", "engineer_id": "albert"}]}
    resp = client.post("/teams/msg/scenario", json=payload)
    assert resp.status_code == 200
    assert resp.json()["plan"]["gross_pm"] < client.get("/teams/msg/plan").json()["gross_pm"]


def test_scenario_unknown_op_400(client):
    resp = client.post("/teams/msg/scenario",
                       json={"changes": [{"op": "teleport"}]})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && . .venv/bin/activate && pytest tests/test_scenario.py -q`
Expected: FAIL — no scenario route.

- [ ] **Step 3: Write `server/capacity_server/schemas.py`**

```python
"""Request schemas and translation to engine Change objects."""
from capacity_engine.scenarios import (
    AddEngineer, Change, RemoveEngineer, SetAvailability, SetReservation,
)
from capacity_engine.store import org_from_dict  # for engineer payloads if needed
from capacity_engine.models import Engineer, Level, OnboardingState, TeamAssignment


def change_from_dict(d: dict) -> Change:
    """Translate one change descriptor into an engine Change. Raises ValueError
    on an unknown op or missing fields (handled as HTTP 400 by the caller)."""
    op = d.get("op")
    if op == "set_availability":
        return SetAvailability(
            engineer_id=d["engineer_id"], team_id=d["team_id"],
            availability=float(d["availability"]),
        )
    if op == "set_reservation":
        return SetReservation(
            team_id=d["team_id"], name=d["name"], fraction=float(d["fraction"]),
        )
    if op == "remove_engineer":
        return RemoveEngineer(engineer_id=d["engineer_id"])
    if op == "add_engineer":
        return AddEngineer(engineer=Engineer(
            id=d["id"], name=d["name"], level=Level(d["level"]),
            onboarding_state=OnboardingState(d.get("onboarding_state", "none")),
            assignments=[TeamAssignment(team_id=a["team_id"],
                                        availability=float(a["availability"]))
                         for a in d.get("assignments", [])],
        ))
    raise ValueError(f"unknown change op: {op!r}")
```

- [ ] **Step 4: Add the scenario route to `server/capacity_server/routes.py`**

Add imports:
```python
from capacity_engine.scenarios import apply_scenario
from capacity_server.schemas import change_from_dict
```
Add the handler:
```python
@router.post("/teams/{team_id}/scenario")
def post_scenario(team_id: str, payload: dict, request: Request) -> dict:
    org = _store(request).get()
    try:
        baseline = plan_team(org, team_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown team: {team_id}") from exc
    try:
        changes = [change_from_dict(c) for c in payload.get("changes", [])]
        scenario_org = apply_scenario(org, changes)
        scenario_plan = plan_team(scenario_org, team_id)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=f"invalid scenario: {exc}") from exc
    return {
        "plan": team_plan_to_dict(scenario_plan),
        "baseline": team_plan_to_dict(baseline),
        "delta": {
            "gross_pm": scenario_plan.gross_pm - baseline.gross_pm,
            "net_pm": scenario_plan.net_pm - baseline.net_pm,
            "expected_delta": scenario_plan.fit.expected_delta
            - baseline.fit.expected_delta,
        },
    }
```
Note: a `remove_engineer` for an engineer not on this team still recomputes the team plan correctly; `apply_scenario` raises `KeyError` for an unknown engineer id, surfaced as 400.

- [ ] **Step 5: Run to verify pass**

Run: `cd server && . .venv/bin/activate && pytest tests/test_scenario.py -q`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add server/capacity_server/schemas.py server/capacity_server/routes.py server/tests/test_scenario.py
git commit -m "feat(server): POST /teams/{id}/scenario with baseline deltas"
```

---

## Task 8: Server — group roll-up endpoint + full suite

**Files:**
- Modify: `server/capacity_server/routes.py` (add `GET /groups/{group_id}/rollup`)
- Test: `server/tests/test_rollup.py`

- [ ] **Step 1: Write the failing test**

File: `server/tests/test_rollup.py`
```python
import pytest


def test_rollup_exp_group_sums_both_teams(client):
    resp = client.get("/groups/exp/rollup")
    assert resp.status_code == 200
    body = resp.json()
    assert body["group_id"] == "exp"
    assert {tp["team_id"] for tp in body["team_plans"]} == {"msg", "email"}
    msg = client.get("/teams/msg/plan").json()
    email = client.get("/teams/email/plan").json()
    assert body["total_net_pm"] == pytest.approx(msg["net_pm"] + email["net_pm"], abs=1e-6)


def test_rollup_parent_group_includes_descendants(client):
    # "eng" is the parent of "exp"; its rollup should include msg + email too
    resp = client.get("/groups/eng/rollup")
    assert resp.status_code == 200
    assert {tp["team_id"] for tp in resp.json()["team_plans"]} == {"msg", "email"}


def test_rollup_unknown_group_404(client):
    assert client.get("/groups/ghost/rollup").status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && . .venv/bin/activate && pytest tests/test_rollup.py -q`
Expected: FAIL — no rollup route.

- [ ] **Step 3: Add the route to `server/capacity_server/routes.py`**

Add imports:
```python
from capacity_engine.planning import rollup_group
from capacity_server.serialize import rollup_to_dict
```
Add the handler:
```python
@router.get("/groups/{group_id}/rollup")
def get_group_rollup(group_id: str, request: Request) -> dict:
    try:
        rollup = rollup_group(_store(request).get(), group_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown group: {group_id}") from exc
    return rollup_to_dict(rollup)
```

- [ ] **Step 4: Run the FULL server suite**

Run: `cd server && . .venv/bin/activate && pytest -q`
Expected: PASS — all server tests (health, org, team_plan, scenario, rollup).

- [ ] **Step 5: Run the FULL engine suite too (confirm no regressions from Tasks 1–3)**

Run: `cd engine && . .venv/bin/activate && pytest -q`
Expected: PASS — all engine tests.

- [ ] **Step 6: Commit**

```bash
git add server/capacity_server/routes.py server/tests/test_rollup.py
git commit -m "feat(server): GET /groups/{id}/rollup aggregation"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** role-aware reads — manager (`/teams/{id}/plan`), director/VP (`/groups/{id}/rollup`) over the hierarchy added in Tasks 2–3; scenario exploration (`/teams/{id}/scenario`) usable by leadership too; app-as-source-of-truth with import seeding (`POST /org`, sample data). Numbers come exclusively from the engine via `plan_team`/`rollup_group` — the server serializes, never computes. Validation errors surface as HTTP 400; unknown ids as 404.
- **Placeholder scan:** none — every step has complete, runnable code.
- **Type consistency:** `plan_team`/`TeamPlan`, `rollup_group`/`GroupRollup`, `Group`, `change_from_dict`, the serialize helpers, and route handlers all reference names defined in this plan or the existing engine API.
- **Deferred (Plan 3 = React frontend; Plan 4 = Claude skill + exports):** the browser UI, charts, sliders, narratives, and Sheets/Slides export. The remaining risk rules and per-level baseline overrides remain deferred from Plan 1.

## Notes for the implementer

- Install order matters: `pip install -e ../engine` BEFORE `pip install -e ".[dev]"` in the server venv, so `capacity_engine` resolves.
- The server holds a single in-memory org (fine for a local single-user tool). Persistence to disk (`save_org`) is intentionally out of scope here; the frontend plan will decide when to persist.
- `add_engineer` scenario payloads accept only the fields listed in `change_from_dict`; richer engineer fields can be added later if the frontend needs them.
