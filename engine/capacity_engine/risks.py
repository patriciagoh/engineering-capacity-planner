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
