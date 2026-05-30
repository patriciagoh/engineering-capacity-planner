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
    risks: tuple[Risk, ...]  # tuple so the frozen result is truly immutable


def plan_team(
    org: Org, team_id: str, baseline_factor: float = DEFAULT_BASELINE_FACTOR
) -> TeamPlan:
    """Compute the full plan for one team: capacity, demand, fit, and risks.

    `baseline_factor` is the 0..1 individual always-on-overhead factor (default
    `DEFAULT_BASELINE_FACTOR`). Raises `KeyError` if `team_id` is not in `org`.
    """
    team = org.team(team_id)  # raises KeyError if unknown
    roster = org.engineers_on(team_id)
    gross = gross_person_months(roster, team, baseline_factor)
    net = net_person_months(gross, team)
    demand = total_demand(org.deliverables_for(team_id))
    fit = compute_fit(net, demand)
    risks = tuple(detect_risks(org, team_id, fit))
    return TeamPlan(
        team_id=team_id,
        team_name=team.name,
        gross_pm=gross,
        net_pm=net,
        demand=demand,
        fit=fit,
        risks=risks,
    )
