"""Scenario engine. Each change is a small dataclass with an `apply(org)` method.
`apply_scenario` deep-copies the org first, so the baseline is never mutated.
"""
import copy
from dataclasses import dataclass

from capacity_engine.models import Engineer, Org, OverheadCategory


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
                e.assignments.append(
                    type(e.assignments[0])(self.team_id, self.availability)
                    if e.assignments else None
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
