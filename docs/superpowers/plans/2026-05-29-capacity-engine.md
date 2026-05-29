# Capacity Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic Python capacity-planning engine — the single source of numeric truth that computes effective per-engineer capacity, team person-months, demand fit, scenarios, and risks, validated against the real Ada spreadsheet totals.

**Architecture:** A pure-Python library (`capacity_engine`) of small, focused, side-effect-free modules. Data lives as JSON loaded into dataclasses. No web/UI/skill concerns here — those consume this engine later. Every formula is unit-tested; a golden-file test proves the engine reproduces known person-month totals from the source sheets.

**Tech Stack:** Python 3.11+, dataclasses + enums (stdlib only for the library), `pytest` for tests, `json` (stdlib) for the store.

---

## File Structure

```
capacity-planning/
  engine/
    pyproject.toml                  # package metadata + pytest config
    capacity_engine/
      __init__.py                   # public exports
      models.py                     # dataclasses & enums (Engineer, Team, Deliverable, ...)
      multipliers.py                # level + onboarding multiplier tables
      capacity.py                   # effective capacity → gross/net person-months
      demand.py                     # estimate normalization + total demand (with uncertainty)
      fit.py                        # net PM vs demand → fit range
      scenarios.py                  # apply a scenario diff onto a baseline org
      risks.py                      # deterministic risk-detection rules
      validation.py                 # config validation (double-count, bad availability, ...)
      store.py                      # JSON load/save <-> dataclasses
    tests/
      conftest.py                   # shared fixtures (a sample org)
      test_multipliers.py
      test_capacity.py
      test_demand.py
      test_fit.py
      test_scenarios.py
      test_risks.py
      test_validation.py
      test_store.py
      test_golden.py                # reproduces real sheet totals
      fixtures/
        golden_teams.json           # rosters + weeks from the real sheets
```

**Responsibilities:** `models` holds data only (no logic). `multipliers` is pure lookup tables. `capacity` turns engineers + a team + a quarter into person-months. `demand` normalizes estimates onto a common person-month scale with low/expected/high. `fit` subtracts demand from net capacity. `scenarios` produces a modified copy of an org (never mutates). `risks` reads a computed plan and emits findings. `validation` guards inputs. `store` is the only module that touches the filesystem.

---

## Task 1: Project scaffold

**Files:**
- Create: `engine/pyproject.toml`
- Create: `engine/capacity_engine/__init__.py`
- Create: `engine/tests/conftest.py`

- [ ] **Step 1: Create `engine/pyproject.toml`**

```toml
[project]
name = "capacity_engine"
version = "0.1.0"
description = "Deterministic capacity-planning engine"
requires-python = ">=3.11"

[project.optional-dependencies]
dev = ["pytest>=8.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 2: Create empty `engine/capacity_engine/__init__.py`**

```python
"""Deterministic capacity-planning engine."""
```

- [ ] **Step 3: Create `engine/tests/conftest.py` (empty for now)**

```python
# Shared fixtures are added as tasks introduce them.
```

- [ ] **Step 4: Create and activate a virtualenv, install dev deps**

Run:
```bash
cd engine && python3 -m venv .venv && . .venv/bin/activate && pip install -q -e ".[dev]"
```
Expected: installs `capacity_engine` in editable mode and `pytest`.

- [ ] **Step 5: Verify pytest runs (collects 0 tests)**

Run: `cd engine && . .venv/bin/activate && pytest -q`
Expected: `no tests ran` (exit code 5) — confirms config works.

- [ ] **Step 6: Commit**

```bash
git add engine/pyproject.toml engine/capacity_engine/__init__.py engine/tests/conftest.py
git commit -m "chore: scaffold capacity_engine package"
```

---

## Task 2: Core data models

**Files:**
- Create: `engine/capacity_engine/models.py`
- Test: `engine/tests/test_store.py` (constructs models; full store added Task 10)

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_store.py`
```python
from capacity_engine.models import (
    Level, OnboardingState, Fidelity, DeliverableType,
    TeamAssignment, Engineer, OverheadCategory, Team, Quarter,
    Estimate, Deliverable,
)


def test_engineer_constructs_with_assignments():
    eng = Engineer(
        id="dia", name="Dia", level=Level.L3,
        assignments=[TeamAssignment(team_id="msgexp", availability=1.0)],
        onboarding_state=OnboardingState.NONE,
    )
    assert eng.assignments[0].availability == 1.0
    assert eng.level is Level.L3


def test_deliverable_with_tshirt_estimate():
    d = Deliverable(
        id="suncoc", title="SunCo CPaaS", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.TSHIRT, size="L"),
        priority=1,
    )
    assert d.estimate.fidelity is Fidelity.TSHIRT
    assert d.estimate.size == "L"


def test_overhead_category_level_enforced_as_enum():
    c = OverheadCategory(name="KTLO", level="team", fraction=0.7)
    assert c.level == "team"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_store.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.models'`.

- [ ] **Step 3: Write `engine/capacity_engine/models.py`**

```python
"""Data models. No business logic lives here."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal, Optional


class Level(str, Enum):
    INTERN = "Intern"
    L2 = "L2"
    L3 = "L3"
    STAFF = "Staff"
    PRINCIPAL = "Principal"


class OnboardingState(str, Enum):
    NONE = "none"
    NEW_HIRE_M1 = "new_hire_m1"
    NEW_HIRE_M2 = "new_hire_m2"
    NEW_HIRE_M3 = "new_hire_m3"
    MENTOR_M1 = "mentor_m1"
    MENTOR_M2 = "mentor_m2"
    MENTOR_M3 = "mentor_m3"


class Fidelity(str, Enum):
    TSHIRT = "tshirt"
    PERSON_MONTHS = "person_months"
    SPRINT_ALLOCATION = "sprint_allocation"


class DeliverableType(str, Enum):
    DELIVERABLE = "deliverable"
    TECH_DEBT = "tech_debt"
    KTLO = "ktlo"


OverheadLevel = Literal["individual", "team"]


@dataclass
class TeamAssignment:
    team_id: str
    availability: float  # 0..1 share of the person on this team


@dataclass
class Engineer:
    id: str
    name: str
    level: Level
    assignments: list[TeamAssignment] = field(default_factory=list)
    onboarding_state: OnboardingState = OnboardingState.NONE

    def availability_on(self, team_id: str) -> float:
        for a in self.assignments:
            if a.team_id == team_id:
                return a.availability
        return 0.0


@dataclass
class OverheadCategory:
    name: str
    level: OverheadLevel  # "individual" or "team"
    fraction: float       # 0..1


@dataclass
class Team:
    id: str
    name: str
    productive_weeks: float
    # Per-team reservations (Bucket C). Each must have level == "team".
    reservations: list[OverheadCategory] = field(default_factory=list)
    # Optional "ideal" reservations for current-vs-ideal comparison.
    ideal_reservations: list[OverheadCategory] = field(default_factory=list)


@dataclass
class Quarter:
    id: str
    label: str
    as_of: str  # ISO date string; the engine treats it as opaque


@dataclass
class Estimate:
    fidelity: Fidelity
    size: Optional[str] = None              # for TSHIRT: "S"|"M"|"L"|"XL"
    low: Optional[float] = None             # person-months
    expected: Optional[float] = None
    high: Optional[float] = None
    sprint_person_months: Optional[float] = None  # rolled up from sprint grid


@dataclass
class Deliverable:
    id: str
    title: str
    type: DeliverableType
    estimate: Estimate
    priority: int = 100
    target_sprint: Optional[str] = None
    owner_ids: list[str] = field(default_factory=list)
    jira_epic: Optional[str] = None


@dataclass
class Org:
    """Root container. Groups omitted at engine level; teams carry a group_id."""
    teams: list[Team] = field(default_factory=list)
    engineers: list[Engineer] = field(default_factory=list)
    deliverables: list[Deliverable] = field(default_factory=list)
    quarter: Optional[Quarter] = None

    def team(self, team_id: str) -> Team:
        for t in self.teams:
            if t.id == team_id:
                return t
        raise KeyError(f"unknown team: {team_id}")

    def engineers_on(self, team_id: str) -> list[Engineer]:
        return [e for e in self.engineers if e.availability_on(team_id) > 0]

    def deliverables_for(self, team_id: str) -> list[Deliverable]:
        # A deliverable belongs to a team if any owner is assigned to it,
        # else it is treated as unassigned and excluded from team demand.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_store.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/models.py engine/tests/test_store.py
git commit -m "feat: add core capacity data models"
```

---

## Task 3: Multiplier tables

**Files:**
- Create: `engine/capacity_engine/multipliers.py`
- Test: `engine/tests/test_multipliers.py`

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_multipliers.py`
```python
from capacity_engine.models import Level, OnboardingState
from capacity_engine.multipliers import level_multiplier, onboarding_multiplier


def test_level_multipliers_match_sheet():
    assert level_multiplier(Level.INTERN) == 0.70
    assert level_multiplier(Level.L2) == 1.00
    assert level_multiplier(Level.L3) == 1.00
    assert level_multiplier(Level.STAFF) == 0.85
    assert level_multiplier(Level.PRINCIPAL) == 0.70


def test_onboarding_multipliers_match_sheet():
    assert onboarding_multiplier(OnboardingState.NONE) == 1.00
    assert onboarding_multiplier(OnboardingState.NEW_HIRE_M1) == 0.25
    assert onboarding_multiplier(OnboardingState.NEW_HIRE_M2) == 0.50
    assert onboarding_multiplier(OnboardingState.NEW_HIRE_M3) == 0.75
    assert onboarding_multiplier(OnboardingState.MENTOR_M1) == 0.85
    assert onboarding_multiplier(OnboardingState.MENTOR_M2) == 0.90
    assert onboarding_multiplier(OnboardingState.MENTOR_M3) == 0.95
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_multipliers.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.multipliers'`.

- [ ] **Step 3: Write `engine/capacity_engine/multipliers.py`**

```python
"""Pure lookup tables for level and onboarding multipliers (from Sheet 1)."""
from capacity_engine.models import Level, OnboardingState

_LEVEL = {
    Level.INTERN: 0.70,
    Level.L2: 1.00,
    Level.L3: 1.00,
    Level.STAFF: 0.85,
    Level.PRINCIPAL: 0.70,
}

_ONBOARDING = {
    OnboardingState.NONE: 1.00,
    OnboardingState.NEW_HIRE_M1: 0.25,
    OnboardingState.NEW_HIRE_M2: 0.50,
    OnboardingState.NEW_HIRE_M3: 0.75,
    OnboardingState.MENTOR_M1: 0.85,
    OnboardingState.MENTOR_M2: 0.90,
    OnboardingState.MENTOR_M3: 0.95,
}


def level_multiplier(level: Level) -> float:
    return _LEVEL[level]


def onboarding_multiplier(state: OnboardingState) -> float:
    return _ONBOARDING[state]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_multipliers.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/multipliers.py engine/tests/test_multipliers.py
git commit -m "feat: add level and onboarding multiplier tables"
```

---

## Task 4: Effective capacity & gross person-months

**Files:**
- Create: `engine/capacity_engine/capacity.py`
- Test: `engine/tests/test_capacity.py`

**Constant:** `DEFAULT_BASELINE_FACTOR = 0.71`. Derived from Sheet 1 Bucket-A
categories only (meetings/rituals 10% + PR reviews 7% + baseline cross-func 5% +
L&D 5% + routine sick 2% = 29% → factor 0.71). Bucket-B items (PTO, holidays,
company events, offsites = 20%) are NOT here — they belong to `productive_weeks`.
The factor is a parameter so it can be configured per level later.

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_capacity.py`
```python
import pytest
from capacity_engine.models import (
    Level, OnboardingState, TeamAssignment, Engineer, Team,
)
from capacity_engine.capacity import (
    DEFAULT_BASELINE_FACTOR, effective_capacity, gross_person_months,
)


def _eng(id, level, avail, onb=OnboardingState.NONE):
    return Engineer(
        id=id, name=id.title(), level=level,
        assignments=[TeamAssignment(team_id="t", availability=avail)],
        onboarding_state=onb,
    )


def test_effective_capacity_neutral_is_availability():
    # baseline_factor=1.0, L3 (1.0), none (1.0) -> equals availability
    e = _eng("a", Level.L3, 1.0)
    assert effective_capacity(e, "t", baseline_factor=1.0) == 1.0


def test_effective_capacity_applies_all_multipliers():
    e = _eng("a", Level.STAFF, 0.5, OnboardingState.MENTOR_M1)
    # 0.5 * 0.85 (staff) * 0.85 (mentor m1) * 1.0 baseline
    assert effective_capacity(e, "t", baseline_factor=1.0) == pytest.approx(0.36125)


def test_default_baseline_factor_value():
    assert DEFAULT_BASELINE_FACTOR == 0.71


def test_gross_person_months_neutral_matches_sheet_formula():
    # Extensibility roster: [1,1,1,1,0.5] over 12 productive weeks -> 13.5 PM
    team = Team(id="t", name="Ext", productive_weeks=12)
    roster = [
        _eng("a", Level.L3, 1.0), _eng("b", Level.L3, 1.0),
        _eng("c", Level.L3, 1.0), _eng("d", Level.L3, 1.0),
        _eng("e", Level.L3, 0.5),
    ]
    pm = gross_person_months(roster, team, baseline_factor=1.0)
    assert pm == pytest.approx(13.5)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_capacity.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.capacity'`.

- [ ] **Step 3: Write `engine/capacity_engine/capacity.py`**

```python
"""Capacity math: effective per-engineer capacity and team person-months.

One person-month = 4 productive weeks of one full-time engineer.
"""
from capacity_engine.models import Engineer, Team
from capacity_engine.multipliers import level_multiplier, onboarding_multiplier

# Bucket-A always-on overhead -> baseline factor. See plan Task 4 note.
DEFAULT_BASELINE_FACTOR = 0.71

WEEKS_PER_PERSON_MONTH = 4.0


def effective_capacity(
    engineer: Engineer, team_id: str, baseline_factor: float = DEFAULT_BASELINE_FACTOR
) -> float:
    """Fraction of one full-time engineer's productive output on this team."""
    return (
        engineer.availability_on(team_id)
        * level_multiplier(engineer.level)
        * onboarding_multiplier(engineer.onboarding_state)
        * baseline_factor
    )


def gross_person_months(
    roster: list[Engineer], team: Team, baseline_factor: float = DEFAULT_BASELINE_FACTOR
) -> float:
    """Total person-months available before team reservations (Bucket C)."""
    total_effective = sum(
        effective_capacity(e, team.id, baseline_factor) for e in roster
    )
    return total_effective * team.productive_weeks / WEEKS_PER_PERSON_MONTH
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_capacity.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/capacity.py engine/tests/test_capacity.py
git commit -m "feat: add effective capacity and gross person-months"
```

---

## Task 5: Net roadmap person-months (apply reservations)

**Files:**
- Modify: `engine/capacity_engine/capacity.py` (append `net_person_months`)
- Modify: `engine/tests/test_capacity.py` (append tests)

- [ ] **Step 1: Write the failing test (append to `test_capacity.py`)**

```python
from capacity_engine.models import OverheadCategory
from capacity_engine.capacity import net_person_months


def test_net_person_months_subtracts_team_reservations():
    team = Team(
        id="t", name="Msg", productive_weeks=12,
        reservations=[
            OverheadCategory(name="KTLO", level="team", fraction=0.70),
            OverheadCategory(name="PTO", level="team", fraction=0.05),
        ],
    )
    # gross 10.0 -> reserve 75% -> 2.5 net
    assert net_person_months(10.0, team) == pytest.approx(2.5)


def test_net_person_months_rejects_individual_category_in_reservations():
    team = Team(
        id="t", name="Bad", productive_weeks=12,
        reservations=[OverheadCategory(name="Meetings", level="individual", fraction=0.1)],
    )
    with pytest.raises(ValueError, match="individual"):
        net_person_months(10.0, team)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_capacity.py -q`
Expected: FAIL — `ImportError: cannot import name 'net_person_months'`.

- [ ] **Step 3: Append to `engine/capacity_engine/capacity.py`**

```python
from capacity_engine.models import OverheadCategory  # add to imports at top


def net_person_months(gross_pm: float, team: Team) -> float:
    """Person-months left for roadmap deliverables after team reservations."""
    total_reserved = 0.0
    for cat in team.reservations:
        if cat.level != "team":
            raise ValueError(
                f"reservation {cat.name!r} has level {cat.level!r}; "
                "only 'team'-level categories may appear in reservations"
            )
        total_reserved += cat.fraction
    return gross_pm * (1.0 - total_reserved)
```

(Place the `OverheadCategory` import alongside the existing `from capacity_engine.models import ...` line rather than duplicating it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_capacity.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/capacity.py engine/tests/test_capacity.py
git commit -m "feat: add net person-months after team reservations"
```

---

## Task 6: Demand normalization (fidelity ladder)

**Files:**
- Create: `engine/capacity_engine/demand.py`
- Test: `engine/tests/test_demand.py`

**T-shirt → person-month ranges (low, expected, high):**
`S = (0.25, 0.5, 0.75)`, `M = (0.75, 1.0, 1.5)`, `L = (1.5, 2.0, 3.0)`,
`XL = (3.0, 4.0, 6.0)`. These are configurable defaults.

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_demand.py`
```python
import pytest
from capacity_engine.models import (
    Fidelity, DeliverableType, Estimate, Deliverable,
)
from capacity_engine.demand import normalize_estimate, total_demand, DemandRange


def _deliv(est, id="d"):
    return Deliverable(id=id, title=id, type=DeliverableType.DELIVERABLE, estimate=est)


def test_normalize_tshirt_L():
    r = normalize_estimate(Estimate(fidelity=Fidelity.TSHIRT, size="L"))
    assert (r.low, r.expected, r.high) == (1.5, 2.0, 3.0)


def test_normalize_person_months_passthrough():
    r = normalize_estimate(
        Estimate(fidelity=Fidelity.PERSON_MONTHS, low=1.0, expected=1.5, high=2.5)
    )
    assert (r.low, r.expected, r.high) == (1.0, 1.5, 2.5)


def test_normalize_person_months_defaults_low_high_to_expected():
    r = normalize_estimate(Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=2.0))
    assert (r.low, r.expected, r.high) == (2.0, 2.0, 2.0)


def test_normalize_sprint_allocation_uses_rolled_up_value():
    r = normalize_estimate(
        Estimate(fidelity=Fidelity.SPRINT_ALLOCATION, sprint_person_months=1.8)
    )
    assert (r.low, r.expected, r.high) == (1.8, 1.8, 1.8)


def test_total_demand_sums_ranges():
    delivs = [
        _deliv(Estimate(fidelity=Fidelity.TSHIRT, size="L"), "a"),       # 1.5/2.0/3.0
        _deliv(Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=1.0), "b"),  # 1/1/1
    ]
    d = total_demand(delivs)
    assert (d.low, d.expected, d.high) == pytest.approx((2.5, 3.0, 4.0))


def test_normalize_unknown_tshirt_size_raises():
    with pytest.raises(ValueError, match="size"):
        normalize_estimate(Estimate(fidelity=Fidelity.TSHIRT, size="XXL"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_demand.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.demand'`.

- [ ] **Step 3: Write `engine/capacity_engine/demand.py`**

```python
"""Demand side: normalize estimates of any fidelity onto person-month ranges."""
from dataclasses import dataclass

from capacity_engine.models import Deliverable, Estimate, Fidelity

TSHIRT_RANGES = {
    "S": (0.25, 0.5, 0.75),
    "M": (0.75, 1.0, 1.5),
    "L": (1.5, 2.0, 3.0),
    "XL": (3.0, 4.0, 6.0),
}


@dataclass
class DemandRange:
    low: float
    expected: float
    high: float


def normalize_estimate(est: Estimate) -> DemandRange:
    if est.fidelity is Fidelity.TSHIRT:
        if est.size not in TSHIRT_RANGES:
            raise ValueError(f"unknown t-shirt size: {est.size!r}")
        low, exp, high = TSHIRT_RANGES[est.size]
        return DemandRange(low, exp, high)

    if est.fidelity is Fidelity.PERSON_MONTHS:
        if est.expected is None:
            raise ValueError("person_months estimate requires `expected`")
        low = est.low if est.low is not None else est.expected
        high = est.high if est.high is not None else est.expected
        return DemandRange(low, est.expected, high)

    if est.fidelity is Fidelity.SPRINT_ALLOCATION:
        if est.sprint_person_months is None:
            raise ValueError("sprint_allocation estimate requires `sprint_person_months`")
        v = est.sprint_person_months
        return DemandRange(v, v, v)

    raise ValueError(f"unhandled fidelity: {est.fidelity!r}")


def total_demand(deliverables: list[Deliverable]) -> DemandRange:
    low = expected = high = 0.0
    for d in deliverables:
        r = normalize_estimate(d.estimate)
        low += r.low
        expected += r.expected
        high += r.high
    return DemandRange(low, expected, high)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_demand.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/demand.py engine/tests/test_demand.py
git commit -m "feat: add demand normalization across fidelity ladder"
```

---

## Task 7: Fit calculation

**Files:**
- Create: `engine/capacity_engine/fit.py`
- Test: `engine/tests/test_fit.py`

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_fit.py`
```python
import pytest
from capacity_engine.demand import DemandRange
from capacity_engine.fit import compute_fit, FitResult


def test_fit_headroom_and_oversubscription():
    # net 5.3 PM vs demand low/expected/high = 4.0/6.1/7.5
    fit = compute_fit(net_pm=5.3, demand=DemandRange(4.0, 6.1, 7.5))
    assert fit.expected_delta == pytest.approx(-0.8)   # oversubscribed
    assert fit.optimistic_delta == pytest.approx(1.3)  # net - low
    assert fit.pessimistic_delta == pytest.approx(-2.2)  # net - high
    assert fit.is_oversubscribed_expected is True


def test_fit_positive_when_demand_below_capacity():
    fit = compute_fit(net_pm=10.0, demand=DemandRange(6.0, 7.0, 8.0))
    assert fit.expected_delta == pytest.approx(3.0)
    assert fit.is_oversubscribed_expected is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_fit.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.fit'`.

- [ ] **Step 3: Write `engine/capacity_engine/fit.py`**

```python
"""Fit: compare net roadmap person-months against demand, carrying uncertainty."""
from dataclasses import dataclass

from capacity_engine.demand import DemandRange


@dataclass
class FitResult:
    net_pm: float
    demand: DemandRange
    optimistic_delta: float   # net - demand.low   (best case)
    expected_delta: float     # net - demand.expected
    pessimistic_delta: float  # net - demand.high   (worst case)

    @property
    def is_oversubscribed_expected(self) -> bool:
        return self.expected_delta < 0


def compute_fit(net_pm: float, demand: DemandRange) -> FitResult:
    return FitResult(
        net_pm=net_pm,
        demand=demand,
        optimistic_delta=net_pm - demand.low,
        expected_delta=net_pm - demand.expected,
        pessimistic_delta=net_pm - demand.high,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_fit.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/fit.py engine/tests/test_fit.py
git commit -m "feat: add fit calculation with uncertainty range"
```

---

## Task 8: Scenario engine (immutable diffs)

**Files:**
- Create: `engine/capacity_engine/scenarios.py`
- Test: `engine/tests/test_scenarios.py`

Scenarios are described by a list of typed changes applied to produce a **deep copy**
of the org. The baseline is never mutated.

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_scenarios.py`
```python
import pytest
from capacity_engine.models import (
    Level, OnboardingState, TeamAssignment, Engineer, Team, Org, OverheadCategory,
)
from capacity_engine.scenarios import (
    apply_scenario, SetAvailability, SetReservation, RemoveEngineer, AddEngineer,
)


def _org():
    team = Team(
        id="t", name="T", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.5)],
    )
    eng = Engineer(
        id="a", name="A", level=Level.L3,
        assignments=[TeamAssignment(team_id="t", availability=1.0)],
    )
    return Org(teams=[team], engineers=[eng])


def test_apply_does_not_mutate_baseline():
    base = _org()
    apply_scenario(base, [SetAvailability(engineer_id="a", team_id="t", availability=0.5)])
    assert base.engineers[0].availability_on("t") == 1.0  # unchanged


def test_set_availability():
    out = apply_scenario(_org(), [SetAvailability("a", "t", 0.5)])
    assert out.engineers[0].availability_on("t") == 0.5


def test_set_reservation_updates_existing():
    out = apply_scenario(_org(), [SetReservation(team_id="t", name="KTLO", fraction=0.4)])
    assert out.team("t").reservations[0].fraction == 0.4


def test_remove_engineer():
    out = apply_scenario(_org(), [RemoveEngineer(engineer_id="a")])
    assert out.engineers == []


def test_add_engineer():
    new = Engineer(
        id="b", name="B", level=Level.L2,
        assignments=[TeamAssignment(team_id="t", availability=1.0)],
        onboarding_state=OnboardingState.NEW_HIRE_M1,
    )
    out = apply_scenario(_org(), [AddEngineer(engineer=new)])
    assert {e.id for e in out.engineers} == {"a", "b"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_scenarios.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.scenarios'`.

- [ ] **Step 3: Write `engine/capacity_engine/scenarios.py`**

```python
"""Scenario engine. Each change is a small dataclass with an `apply(org)` method.
`apply_scenario` deep-copies the org first, so the baseline is never mutated.
"""
import copy
from dataclasses import dataclass

from capacity_engine.models import Engineer, Org, OverheadCategory, TeamAssignment


@dataclass
class SetAvailability:
    engineer_id: str
    team_id: str
    availability: float

    def apply(self, org: Org) -> None:
        for e in org.engineers:
            if e.id == self.engineer_id:
                for a in e.assignments:
                    if a.team_id == self.team_id:
                        a.availability = self.availability
                        return
                # Engineer has no prior assignment to this team: add one.
                e.assignments.append(
                    TeamAssignment(team_id=self.team_id, availability=self.availability)
                )
                return
        raise KeyError(f"unknown engineer: {self.engineer_id}")


@dataclass
class SetReservation:
    team_id: str
    name: str
    fraction: float

    def apply(self, org: Org) -> None:
        team = org.team(self.team_id)
        for cat in team.reservations:
            if cat.name == self.name:
                cat.fraction = self.fraction
                return
        team.reservations.append(
            OverheadCategory(name=self.name, level="team", fraction=self.fraction)
        )


@dataclass
class RemoveEngineer:
    engineer_id: str

    def apply(self, org: Org) -> None:
        org.engineers = [e for e in org.engineers if e.id != self.engineer_id]


@dataclass
class AddEngineer:
    engineer: Engineer

    def apply(self, org: Org) -> None:
        org.engineers.append(copy.deepcopy(self.engineer))


def apply_scenario(org: Org, changes: list) -> Org:
    """Return a modified deep copy of `org` with all `changes` applied in order."""
    out = copy.deepcopy(org)
    for change in changes:
        change.apply(out)
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_scenarios.py -q`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/scenarios.py engine/tests/test_scenarios.py
git commit -m "feat: add immutable scenario diff engine"
```

---

## Task 9: Risk detection

**Files:**
- Create: `engine/capacity_engine/risks.py`
- Test: `engine/tests/test_risks.py`

Two rules in this plan (oversubscription, single-point-of-failure). The remaining
rules from the spec (onboarding drag, KTLO creep, PTO clusters, optimistic
estimates) follow the identical pattern and are added in a later plan once the web
app surfaces them; this keeps Plan 1 shippable.

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_risks.py`
```python
from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
    Deliverable, DeliverableType, Estimate, Fidelity,
)
from capacity_engine.demand import DemandRange
from capacity_engine.fit import compute_fit
from capacity_engine.risks import detect_risks, Risk


def test_oversubscription_risk_emitted():
    fit = compute_fit(net_pm=5.3, demand=DemandRange(4.0, 6.1, 7.5))
    org = Org(teams=[Team(id="t", name="T", productive_weeks=12)], engineers=[])
    risks = detect_risks(org, team_id="t", fit=fit)
    kinds = {r.kind for r in risks}
    assert "oversubscription" in kinds


def test_no_oversubscription_when_headroom():
    fit = compute_fit(net_pm=10.0, demand=DemandRange(6.0, 7.0, 8.0))
    org = Org(teams=[Team(id="t", name="T", productive_weeks=12)], engineers=[])
    risks = detect_risks(org, team_id="t", fit=fit)
    assert all(r.kind != "oversubscription" for r in risks)


def test_spof_risk_when_single_owner_no_backup():
    team = Team(id="t", name="T", productive_weeks=12)
    eng = Engineer(id="leah", name="Leah", level=Level.L3,
                   assignments=[TeamAssignment("t", 1.0)])
    deliv = Deliverable(
        id="ard", title="Auto Reply Detection", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=1.8),
        owner_ids=["leah"],
    )
    org = Org(teams=[team], engineers=[eng], deliverables=[deliv])
    fit = compute_fit(net_pm=10.0, demand=DemandRange(1.8, 1.8, 1.8))
    risks = detect_risks(org, team_id="t", fit=fit)
    spof = [r for r in risks if r.kind == "single_point_of_failure"]
    assert len(spof) == 1
    assert "Leah" in spof[0].detail
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_risks.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.risks'`.

- [ ] **Step 3: Write `engine/capacity_engine/risks.py`**

```python
"""Deterministic risk detection over a computed plan. Each risk names specifics."""
from dataclasses import dataclass

from capacity_engine.fit import FitResult
from capacity_engine.models import Org


@dataclass
class Risk:
    kind: str       # machine key, e.g. "oversubscription"
    severity: str   # "low" | "medium" | "high"
    detail: str     # human-readable, names the engineer/deliverable


def _oversubscription(fit: FitResult) -> list[Risk]:
    risks = []
    if fit.expected_delta < 0:
        risks.append(Risk(
            kind="oversubscription", severity="high",
            detail=(f"Demand exceeds capacity by {abs(fit.expected_delta):.1f} PM "
                    f"(expected case); {abs(fit.pessimistic_delta):.1f} PM pessimistic."),
        ))
    elif fit.pessimistic_delta < 0:
        risks.append(Risk(
            kind="oversubscription", severity="medium",
            detail=(f"Within capacity at expected, but {abs(fit.pessimistic_delta):.1f} PM "
                    "oversubscribed in the pessimistic case."),
        ))
    return risks


def _single_point_of_failure(org: Org, team_id: str) -> list[Risk]:
    risks = []
    for d in org.deliverables_for(team_id):
        if len(d.owner_ids) == 1:
            owner = next((e for e in org.engineers if e.id == d.owner_ids[0]), None)
            who = owner.name if owner else d.owner_ids[0]
            risks.append(Risk(
                kind="single_point_of_failure", severity="medium",
                detail=f"{d.title!r} has a single owner ({who}) with no backup.",
            ))
    return risks


def detect_risks(org: Org, team_id: str, fit: FitResult) -> list[Risk]:
    return _oversubscription(fit) + _single_point_of_failure(org, team_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_risks.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/risks.py engine/tests/test_risks.py
git commit -m "feat: add oversubscription and SPOF risk detection"
```

---

## Task 10: JSON store (load/save)

**Files:**
- Create: `engine/capacity_engine/store.py`
- Modify: `engine/tests/test_store.py` (append round-trip test)

- [ ] **Step 1: Write the failing test (append to `test_store.py`)**

```python
from capacity_engine.models import Org
from capacity_engine.store import org_to_dict, org_from_dict


def test_org_round_trips_through_dict():
    eng = Engineer(
        id="dia", name="Dia", level=Level.L3,
        assignments=[TeamAssignment(team_id="msgexp", availability=1.0)],
        onboarding_state=OnboardingState.NONE,
    )
    team = Team(
        id="msgexp", name="Messaging Experience", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.7)],
    )
    deliv = Deliverable(
        id="suncoc", title="SunCo CPaaS", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=2.5),
        owner_ids=["dia"],
    )
    org = Org(teams=[team], engineers=[eng], deliverables=[deliv])

    restored = org_from_dict(org_to_dict(org))
    assert restored.team("msgexp").reservations[0].fraction == 0.7
    assert restored.engineers[0].level is Level.L3
    assert restored.deliverables[0].estimate.expected == 2.5
    assert restored.engineers[0].availability_on("msgexp") == 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_store.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.store'`.

- [ ] **Step 3: Write `engine/capacity_engine/store.py`**

```python
"""JSON (de)serialization for Org. The only module that touches the filesystem."""
import json
from pathlib import Path

from capacity_engine.models import (
    Level, OnboardingState, Fidelity, DeliverableType,
    TeamAssignment, Engineer, OverheadCategory, Team, Quarter,
    Estimate, Deliverable, Org,
)


def org_to_dict(org: Org) -> dict:
    return {
        "quarter": _quarter_to_dict(org.quarter) if org.quarter else None,
        "teams": [
            {
                "id": t.id, "name": t.name, "productive_weeks": t.productive_weeks,
                "reservations": [_cat_to_dict(c) for c in t.reservations],
                "ideal_reservations": [_cat_to_dict(c) for c in t.ideal_reservations],
            }
            for t in org.teams
        ],
        "engineers": [
            {
                "id": e.id, "name": e.name, "level": e.level.value,
                "onboarding_state": e.onboarding_state.value,
                "assignments": [
                    {"team_id": a.team_id, "availability": a.availability}
                    for a in e.assignments
                ],
            }
            for e in org.engineers
        ],
        "deliverables": [
            {
                "id": d.id, "title": d.title, "type": d.type.value,
                "priority": d.priority, "target_sprint": d.target_sprint,
                "owner_ids": list(d.owner_ids), "jira_epic": d.jira_epic,
                "estimate": _estimate_to_dict(d.estimate),
            }
            for d in org.deliverables
        ],
    }


def org_from_dict(data: dict) -> Org:
    teams = [
        Team(
            id=t["id"], name=t["name"], productive_weeks=t["productive_weeks"],
            reservations=[_cat_from_dict(c) for c in t.get("reservations", [])],
            ideal_reservations=[_cat_from_dict(c) for c in t.get("ideal_reservations", [])],
        )
        for t in data.get("teams", [])
    ]
    engineers = [
        Engineer(
            id=e["id"], name=e["name"], level=Level(e["level"]),
            onboarding_state=OnboardingState(e.get("onboarding_state", "none")),
            assignments=[
                TeamAssignment(team_id=a["team_id"], availability=a["availability"])
                for a in e.get("assignments", [])
            ],
        )
        for e in data.get("engineers", [])
    ]
    deliverables = [
        Deliverable(
            id=d["id"], title=d["title"], type=DeliverableType(d["type"]),
            priority=d.get("priority", 100), target_sprint=d.get("target_sprint"),
            owner_ids=list(d.get("owner_ids", [])), jira_epic=d.get("jira_epic"),
            estimate=_estimate_from_dict(d["estimate"]),
        )
        for d in data.get("deliverables", [])
    ]
    quarter = _quarter_from_dict(data["quarter"]) if data.get("quarter") else None
    return Org(teams=teams, engineers=engineers, deliverables=deliverables, quarter=quarter)


def load_org(path: str | Path) -> Org:
    return org_from_dict(json.loads(Path(path).read_text()))


def save_org(org: Org, path: str | Path) -> None:
    Path(path).write_text(json.dumps(org_to_dict(org), indent=2))


def _cat_to_dict(c: OverheadCategory) -> dict:
    return {"name": c.name, "level": c.level, "fraction": c.fraction}


def _cat_from_dict(d: dict) -> OverheadCategory:
    return OverheadCategory(name=d["name"], level=d["level"], fraction=d["fraction"])


def _estimate_to_dict(e: Estimate) -> dict:
    return {
        "fidelity": e.fidelity.value, "size": e.size, "low": e.low,
        "expected": e.expected, "high": e.high,
        "sprint_person_months": e.sprint_person_months,
    }


def _estimate_from_dict(d: dict) -> Estimate:
    return Estimate(
        fidelity=Fidelity(d["fidelity"]), size=d.get("size"), low=d.get("low"),
        expected=d.get("expected"), high=d.get("high"),
        sprint_person_months=d.get("sprint_person_months"),
    )


def _quarter_to_dict(q: Quarter) -> dict:
    return {"id": q.id, "label": q.label, "as_of": q.as_of}


def _quarter_from_dict(d: dict) -> Quarter:
    return Quarter(id=d["id"], label=d["label"], as_of=d["as_of"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_store.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/store.py engine/tests/test_store.py
git commit -m "feat: add JSON store with org round-trip"
```

---

## Task 11: Validation

**Files:**
- Create: `engine/capacity_engine/validation.py`
- Test: `engine/tests/test_validation.py`

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_validation.py`
```python
import pytest
from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
)
from capacity_engine.validation import validate_org, ValidationError


def _valid_org():
    team = Team(
        id="t", name="T", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.5)],
    )
    eng = Engineer(id="a", name="A", level=Level.L3,
                   assignments=[TeamAssignment("t", 1.0)])
    return Org(teams=[team], engineers=[eng])


def test_valid_org_passes():
    validate_org(_valid_org())  # no raise


def test_individual_category_in_reservations_rejected():
    org = _valid_org()
    org.teams[0].reservations.append(
        OverheadCategory(name="Meetings", level="individual", fraction=0.1)
    )
    with pytest.raises(ValidationError, match="individual"):
        validate_org(org)


def test_reservations_over_100_percent_rejected():
    org = _valid_org()
    org.teams[0].reservations.append(
        OverheadCategory(name="Support", level="team", fraction=0.6)
    )  # 0.5 + 0.6 > 1.0
    with pytest.raises(ValidationError, match="exceed"):
        validate_org(org)


def test_negative_productive_weeks_rejected():
    org = _valid_org()
    org.teams[0].productive_weeks = -1
    with pytest.raises(ValidationError, match="productive_weeks"):
        validate_org(org)


def test_availability_out_of_range_rejected():
    org = _valid_org()
    org.engineers[0].assignments[0].availability = 1.5
    with pytest.raises(ValidationError, match="availability"):
        validate_org(org)


def test_assignment_to_unknown_team_rejected():
    org = _valid_org()
    org.engineers[0].assignments.append(TeamAssignment("ghost", 0.5))
    with pytest.raises(ValidationError, match="unknown team"):
        validate_org(org)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_validation.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'capacity_engine.validation'`.

- [ ] **Step 3: Write `engine/capacity_engine/validation.py`**

```python
"""Input validation. Errors are plain-language so UI/skill can surface them."""
from capacity_engine.models import Org


class ValidationError(Exception):
    pass


def validate_org(org: Org) -> None:
    team_ids = {t.id for t in org.teams}

    for t in org.teams:
        if t.productive_weeks < 0:
            raise ValidationError(
                f"team {t.name!r}: productive_weeks must be >= 0, got {t.productive_weeks}"
            )
        reserved = 0.0
        for cat in t.reservations:
            if cat.level != "team":
                raise ValidationError(
                    f"team {t.name!r}: reservation {cat.name!r} is level "
                    f"{cat.level!r}; only 'team'-level categories may be reservations "
                    "(individual overhead belongs in the baseline factor)"
                )
            if not (0.0 <= cat.fraction <= 1.0):
                raise ValidationError(
                    f"team {t.name!r}: reservation {cat.name!r} fraction "
                    f"{cat.fraction} out of range 0..1"
                )
            reserved += cat.fraction
        if reserved > 1.0:
            raise ValidationError(
                f"team {t.name!r}: reservations sum to {reserved:.2f}, which exceed 100%"
            )

    for e in org.engineers:
        for a in e.assignments:
            if a.team_id not in team_ids:
                raise ValidationError(
                    f"engineer {e.name!r}: assigned to unknown team {a.team_id!r}"
                )
            if not (0.0 <= a.availability <= 1.0):
                raise ValidationError(
                    f"engineer {e.name!r}: availability {a.availability} on "
                    f"team {a.team_id!r} out of range 0..1"
                )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_validation.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/validation.py engine/tests/test_validation.py
git commit -m "feat: add org validation (double-count, ranges, unknown teams)"
```

---

## Task 12: Golden-file test against real sheet totals

**Files:**
- Create: `engine/tests/fixtures/golden_teams.json`
- Create: `engine/tests/test_golden.py`

This is the trust anchor: with neutral multipliers (baseline_factor=1.0, all L3,
no onboarding), `gross_person_months` must reproduce the "Total Person Months
Available" figures from Sheet 2. Values taken directly from the sheet:
Extensibility = 13.5, Email = 10.5, Messaging Experience = 7.5, Analytics = 12.0,
Channels & Handoffs (10 productive weeks) = 21.8 (±0.05 rounding).

- [ ] **Step 1: Create `engine/tests/fixtures/golden_teams.json`**

```json
{
  "teams": [
    {"id": "ext",   "name": "Extensibility",        "productive_weeks": 12, "availabilities": [1, 1, 1, 1, 0.5],            "expected_pm": 13.5},
    {"id": "email", "name": "Email",                 "productive_weeks": 12, "availabilities": [1, 1, 0.5, 1],               "expected_pm": 10.5},
    {"id": "msg",   "name": "Messaging Experience",  "productive_weeks": 12, "availabilities": [1, 1, 0.5],                  "expected_pm": 7.5},
    {"id": "an",    "name": "Analytics",             "productive_weeks": 12, "availabilities": [1, 1, 1, 1],                 "expected_pm": 12.0},
    {"id": "ch",    "name": "Channels and Handoffs", "productive_weeks": 10, "availabilities": [1, 1, 1, 1, 1, 1, 1, 0.2, 1, 0.5], "expected_pm": 21.8}
  ]
}
```

- [ ] **Step 2: Write the test**

File: `engine/tests/test_golden.py`
```python
import json
from pathlib import Path

import pytest

from capacity_engine.models import Level, OnboardingState, TeamAssignment, Engineer, Team
from capacity_engine.capacity import gross_person_months

FIXTURE = Path(__file__).parent / "fixtures" / "golden_teams.json"


def _roster(team_id, availabilities):
    return [
        Engineer(
            id=f"{team_id}-{i}", name=f"{team_id}-{i}", level=Level.L3,
            assignments=[TeamAssignment(team_id, a)],
            onboarding_state=OnboardingState.NONE,
        )
        for i, a in enumerate(availabilities)
    ]


@pytest.mark.parametrize("case", json.loads(FIXTURE.read_text())["teams"])
def test_gross_pm_reproduces_sheet_total(case):
    team = Team(id=case["id"], name=case["name"], productive_weeks=case["productive_weeks"])
    roster = _roster(case["id"], case["availabilities"])
    pm = gross_person_months(roster, team, baseline_factor=1.0)
    assert pm == pytest.approx(case["expected_pm"], abs=0.05), (
        f"{case['name']}: engine {pm:.2f} PM != sheet {case['expected_pm']} PM"
    )
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_golden.py -q`
Expected: PASS (5 passed) — the engine reproduces every sheet total.

- [ ] **Step 4: Commit**

```bash
git add engine/tests/fixtures/golden_teams.json engine/tests/test_golden.py
git commit -m "test: golden-file validation against real sheet person-month totals"
```

---

## Task 13: Public API surface + full suite

**Files:**
- Modify: `engine/capacity_engine/__init__.py`
- Create: `engine/tests/test_api.py`

- [ ] **Step 1: Write the failing test**

File: `engine/tests/test_api.py`
```python
def test_public_api_exports():
    import capacity_engine as ce
    # smoke test the curated surface used by the server/skill later
    for name in [
        "Org", "Team", "Engineer", "Deliverable", "Estimate",
        "effective_capacity", "gross_person_months", "net_person_months",
        "total_demand", "compute_fit", "apply_scenario", "detect_risks",
        "validate_org", "load_org", "save_org",
    ]:
        assert hasattr(ce, name), f"missing public export: {name}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && . .venv/bin/activate && pytest tests/test_api.py -q`
Expected: FAIL — `AssertionError: missing public export: Org`.

- [ ] **Step 3: Rewrite `engine/capacity_engine/__init__.py`**

```python
"""Deterministic capacity-planning engine — public API."""
from capacity_engine.models import (
    Level, OnboardingState, Fidelity, DeliverableType,
    TeamAssignment, Engineer, OverheadCategory, Team, Quarter,
    Estimate, Deliverable, Org,
)
from capacity_engine.capacity import (
    DEFAULT_BASELINE_FACTOR, effective_capacity, gross_person_months,
    net_person_months,
)
from capacity_engine.demand import normalize_estimate, total_demand, DemandRange
from capacity_engine.fit import compute_fit, FitResult
from capacity_engine.scenarios import (
    apply_scenario, SetAvailability, SetReservation, RemoveEngineer, AddEngineer,
)
from capacity_engine.risks import detect_risks, Risk
from capacity_engine.validation import validate_org, ValidationError
from capacity_engine.store import load_org, save_org, org_to_dict, org_from_dict

__all__ = [
    "Level", "OnboardingState", "Fidelity", "DeliverableType",
    "TeamAssignment", "Engineer", "OverheadCategory", "Team", "Quarter",
    "Estimate", "Deliverable", "Org",
    "DEFAULT_BASELINE_FACTOR", "effective_capacity", "gross_person_months",
    "net_person_months",
    "normalize_estimate", "total_demand", "DemandRange",
    "compute_fit", "FitResult",
    "apply_scenario", "SetAvailability", "SetReservation", "RemoveEngineer",
    "AddEngineer",
    "detect_risks", "Risk",
    "validate_org", "ValidationError",
    "load_org", "save_org", "org_to_dict", "org_from_dict",
]
```

- [ ] **Step 4: Run the FULL suite**

Run: `cd engine && . .venv/bin/activate && pytest -q`
Expected: PASS — all tests across every module (expect ~37 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/capacity_engine/__init__.py engine/tests/test_api.py
git commit -m "feat: curate public engine API; full suite green"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** unified pipeline (Tasks 4–5), three overhead buckets (baseline
  factor in Task 4; team reservations Task 5; calendar weeks in `productive_weeks`),
  fidelity ladder (Task 6), uncertainty (Tasks 6–7), scenarios as diffs (Task 8),
  risk detection (Task 9, two rules now + documented pattern for the rest),
  validation incl. no-double-count (Task 11), JSON store/audit (Task 10), golden
  validation against real totals (Task 12). Role-aware *views*, exports, narratives,
  and the web app are intentionally deferred to Plans 2 and 3.
- **Placeholder scan:** none — every code step is complete and runnable.
- **Type consistency:** names verified across tasks (`gross_person_months`,
  `net_person_months`, `compute_fit`, `apply_scenario`, `detect_risks`,
  `DemandRange`, `FitResult`, `OverheadCategory.level`).

## Deferred to later plans (explicitly out of scope here)

- Remaining risk rules (onboarding drag, KTLO creep, PTO clusters, optimistic
  estimates) — same `Risk` pattern, added when the app surfaces them.
- Per-level `individual_baseline_factor` overrides (single default `0.71` for now).
- Sprint-grid → person-month roll-up logic (the model field exists; the grid editor
  and roll-up arrive with the app in Plan 2).
- Group/hierarchy roll-ups for director/VP views (Plan 2).
