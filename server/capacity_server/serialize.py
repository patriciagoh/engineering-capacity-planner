"""Convert engine result objects into JSON-able dicts for responses."""
from capacity_engine.capacity import DEFAULT_BASELINE_FACTOR, effective_capacity
from capacity_engine.demand import DemandRange
from capacity_engine.fit import FitResult
from capacity_engine.models import Engineer, Org
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


def engineer_capacity_to_dict(eng: Engineer, team_id: str) -> dict:
    return {
        "engineer_id": eng.id,
        "name": eng.name,
        "level": eng.level.value,
        "onboarding_state": eng.onboarding_state.value,
        "availability": eng.availability_on(team_id),
        "effective_capacity": effective_capacity(eng, team_id, DEFAULT_BASELINE_FACTOR),
    }


def roster_to_dict(org: Org, team_id: str) -> dict:
    team = org.team(team_id)  # raises KeyError if unknown
    return {
        "team_id": team.id,
        "team_name": team.name,
        "roster": [
            engineer_capacity_to_dict(e, team_id) for e in org.engineers_on(team_id)
        ],
    }
