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


@dataclass(frozen=True)
class GroupRollup:
    group_id: str
    group_name: str
    team_plans: tuple[TeamPlan, ...]
    total_gross_pm: float
    total_net_pm: float
    total_demand: DemandRange
    fit: FitResult  # computed from total_net_pm vs total_demand


def rollup_group(
    org: Org, group_id: str, baseline_factor: float = DEFAULT_BASELINE_FACTOR
) -> "GroupRollup":
    """Aggregate plans across every team in a group's subtree.

    Summing per-team person-months is correct even for loaned engineers: each
    engineer's per-team availability is validated to sum to <= 1.0, so a 0.5/0.5
    split contributes 0.5 to each team and is never double-counted.
    """
    group = org.group(group_id)  # raises KeyError if unknown
    teams = org.teams_in_group(group_id)
    plans = tuple(plan_team(org, t.id, baseline_factor) for t in teams)
    total_gross = sum(p.gross_pm for p in plans)
    total_net = sum(p.net_pm for p in plans)
    agg_demand = DemandRange(
        low=sum(p.demand.low for p in plans),
        expected=sum(p.demand.expected for p in plans),
        high=sum(p.demand.high for p in plans),
    )
    return GroupRollup(
        group_id=group_id,
        group_name=group.name,
        team_plans=plans,
        total_gross_pm=total_gross,
        total_net_pm=total_net,
        total_demand=agg_demand,
        fit=compute_fit(total_net, agg_demand),
    )


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
