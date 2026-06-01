import json, sys
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"
sys.path.insert(0, str(PUBLIC))
import presenter  # noqa: E402

SAMPLE = Path(__file__).resolve().parents[2] / "server" / "data" / "sample_org.json"


def setup_module(_):
    presenter.load_org(SAMPLE.read_text())


def test_get_team_plan_shape_and_values():
    plan = json.loads(presenter.get_team_plan("msg"))
    assert plan["team_id"] == "msg"
    assert plan["gross_pm"] == __import__("pytest").approx(5.325, abs=1e-3)
    assert "fit" in plan and "risks" in plan


def test_get_team_roster_effective_capacity():
    body = json.loads(presenter.get_team_roster("msg"))
    rows = {r["engineer_id"]: r for r in body["roster"]}
    assert rows["maya"]["effective_capacity"] == __import__("pytest").approx(0.71, abs=1e-3)


def test_get_group_rollup_sums_teams():
    r = json.loads(presenter.get_group_rollup("eng"))
    assert {tp["team_id"] for tp in r["team_plans"]} == {"msg", "email"}


def test_post_scenario_returns_delta():
    out = json.loads(presenter.post_scenario("msg", json.dumps(
        [{"op": "set_reservation", "team_id": "msg", "name": "KTLO", "fraction": 0.4}])))
    assert out["delta"]["net_pm"] > 0


def test_matches_server_serializer():
    # presenter dicts must equal capacity_server.serialize output for the same org
    from capacity_engine.store import load_org
    from capacity_engine.planning import plan_team
    from capacity_server.serialize import team_plan_to_dict
    org = load_org(SAMPLE)
    assert json.loads(presenter.get_team_plan("msg")) == team_plan_to_dict(plan_team(org, "msg"))
