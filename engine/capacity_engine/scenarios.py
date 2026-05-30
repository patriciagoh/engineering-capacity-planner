"""Scenario engine. Each change is a small dataclass with an `apply(org)` method.
`apply_scenario` deep-copies the org first, so the baseline is never mutated.
"""
import copy
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from capacity_engine.models import Engineer, Org, OverheadCategory, TeamAssignment


@runtime_checkable
class Change(Protocol):
    """A scenario change applies itself to an Org in place."""

    def apply(self, org: Org) -> None: ...


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
        before = len(org.engineers)
        org.engineers = [e for e in org.engineers if e.id != self.engineer_id]
        if len(org.engineers) == before:
            raise KeyError(f"unknown engineer: {self.engineer_id}")


@dataclass
class AddEngineer:
    engineer: Engineer

    def apply(self, org: Org) -> None:
        org.engineers.append(copy.deepcopy(self.engineer))


def apply_scenario(org: Org, changes: list[Change]) -> Org:
    """Return a modified deep copy of `org` with all `changes` applied in order.

    Changes may raise `KeyError` for unknown engineer/team IDs.
    """
    out = copy.deepcopy(org)
    for change in changes:
        change.apply(out)
    return out
