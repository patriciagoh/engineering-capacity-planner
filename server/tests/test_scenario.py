import pytest


def test_scenario_drop_ktlo_increases_net(client):
    base = client.get("/teams/msg/plan").json()
    payload = {"changes": [
        {"op": "set_reservation", "team_id": "msg", "name": "KTLO", "fraction": 0.4}
    ]}
    resp = client.post("/teams/msg/scenario", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    # lowering KTLO from 0.7 to 0.4 raises net PM
    assert body["plan"]["net_pm"] > base["net_pm"]
    # concrete expectation: gross (5.325) * (0.7 - 0.4) freed up = 1.5975 more net PM
    assert body["delta"]["net_pm"] == pytest.approx(5.325 * (0.7 - 0.4), abs=1e-3)
    # and the reported delta equals scenario.net - baseline.net the server returned
    assert body["delta"]["net_pm"] == pytest.approx(
        body["plan"]["net_pm"] - body["baseline"]["net_pm"], abs=1e-6
    )


def test_scenario_remove_engineer(client):
    payload = {"changes": [{"op": "remove_engineer", "engineer_id": "albert"}]}
    resp = client.post("/teams/msg/scenario", json=payload)
    assert resp.status_code == 200
    assert resp.json()["plan"]["gross_pm"] < client.get("/teams/msg/plan").json()["gross_pm"]


def test_scenario_unknown_op_400(client):
    resp = client.post("/teams/msg/scenario",
                       json={"changes": [{"op": "teleport"}]})
    assert resp.status_code == 400
