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
    """Root container. Group/hierarchy roll-ups (director/VP scope) are deferred to
    Plan 2; the engine operates over a flat set of teams for now."""
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
