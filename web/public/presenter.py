"""Runs inside Pyodide on top of the capacity_engine wheel. Holds one org and
exposes JSON-returning functions mirroring the FastAPI responses. Kept in sync
with capacity_server/serialize.py (test_presenter asserts equality)."""
import json

from capacity_engine import (
    org_from_dict, org_to_dict, plan_team, rollup_group, apply_scenario,
    validate_org, effective_capacity, DEFAULT_BASELINE_FACTOR,
    SetAvailability, SetReservation, RemoveEngineer, AddEngineer,
    Engineer, Level, OnboardingState, TeamAssignment,
)

_ORG = None


def load_org(org_json: str) -> None:
    global _ORG
    org = org_from_dict(json.loads(org_json))
    validate_org(org)  # parity with the server's POST /org
    _ORG = org


def _org():
    if _ORG is None:
        raise RuntimeError("no org loaded; call load_org() first")
    return _ORG


def get_org() -> str:
    return json.dumps(org_to_dict(_org()))


def _demand(d):
    return {"low": d.low, "expected": d.expected, "high": d.high}


def _fit(f):
    return {
        "net_pm": f.net_pm, "demand": _demand(f.demand),
        "optimistic_delta": f.optimistic_delta, "expected_delta": f.expected_delta,
        "pessimistic_delta": f.pessimistic_delta,
        "is_oversubscribed_expected": f.is_oversubscribed_expected,
    }


def _risk(r):
    return {"kind": r.kind, "severity": r.severity.value, "detail": r.detail}


def _team_plan(p):
    return {
        "team_id": p.team_id, "team_name": p.team_name, "gross_pm": p.gross_pm,
        "net_pm": p.net_pm, "demand": _demand(p.demand), "fit": _fit(p.fit),
        "risks": [_risk(r) for r in p.risks],
    }


def get_team_plan(team_id: str) -> str:
    return json.dumps(_team_plan(plan_team(_org(), team_id)))


def get_team_roster(team_id: str) -> str:
    org = _org()
    team = org.team(team_id)
    rows = [{
        "engineer_id": e.id, "name": e.name, "level": e.level.value,
        "onboarding_state": e.onboarding_state.value,
        "availability": e.availability_on(team_id),
        "effective_capacity": effective_capacity(e, team_id, DEFAULT_BASELINE_FACTOR),
    } for e in org.engineers_on(team_id)]
    return json.dumps({"team_id": team.id, "team_name": team.name, "roster": rows})


def get_group_rollup(group_id: str) -> str:
    r = rollup_group(_org(), group_id)
    return json.dumps({
        "group_id": r.group_id, "group_name": r.group_name,
        "total_gross_pm": r.total_gross_pm, "total_net_pm": r.total_net_pm,
        "total_demand": _demand(r.total_demand), "fit": _fit(r.fit),
        "team_plans": [_team_plan(p) for p in r.team_plans],
    })


def _change(d):
    if not isinstance(d, dict):
        raise ValueError(f"each change must be an object, got {type(d).__name__}")
    op = d.get("op")
    if op == "set_availability":
        return SetAvailability(d["engineer_id"], d["team_id"], float(d["availability"]))
    if op == "set_reservation":
        return SetReservation(d["team_id"], d["name"], float(d["fraction"]))
    if op == "remove_engineer":
        return RemoveEngineer(d["engineer_id"])
    if op == "add_engineer":
        return AddEngineer(Engineer(
            id=d["id"], name=d["name"], level=Level(d["level"]),
            onboarding_state=OnboardingState(d.get("onboarding_state", "none")),
            assignments=[TeamAssignment(a["team_id"], float(a["availability"]))
                         for a in d.get("assignments", [])]))
    raise ValueError(f"unknown change op: {op!r}")


def post_scenario(team_id: str, changes_json: str) -> str:
    org = _org()
    baseline = plan_team(org, team_id)
    changes = [_change(c) for c in json.loads(changes_json)]
    scen = plan_team(apply_scenario(org, changes), team_id)
    return json.dumps({
        "plan": _team_plan(scen), "baseline": _team_plan(baseline),
        "delta": {
            "gross_pm": scen.gross_pm - baseline.gross_pm,
            "net_pm": scen.net_pm - baseline.net_pm,
            "expected_delta": scen.fit.expected_delta - baseline.fit.expected_delta,
        },
    })
