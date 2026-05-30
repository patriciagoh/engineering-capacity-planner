import pytest


def test_rollup_exp_group_sums_both_teams(client):
    resp = client.get("/groups/exp/rollup")
    assert resp.status_code == 200
    body = resp.json()
    assert body["group_id"] == "exp"
    assert {tp["team_id"] for tp in body["team_plans"]} == {"msg", "email"}
    msg = client.get("/teams/msg/plan").json()
    email = client.get("/teams/email/plan").json()
    assert body["total_net_pm"] == pytest.approx(msg["net_pm"] + email["net_pm"], abs=1e-6)


def test_rollup_parent_group_includes_descendants(client):
    # "eng" is the parent of "exp"; its rollup should include msg + email too
    resp = client.get("/groups/eng/rollup")
    assert resp.status_code == 200
    assert {tp["team_id"] for tp in resp.json()["team_plans"]} == {"msg", "email"}


def test_rollup_unknown_group_404(client):
    assert client.get("/groups/ghost/rollup").status_code == 404
