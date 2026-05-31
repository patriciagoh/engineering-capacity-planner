import pytest


def test_rollup_exp_group_sums_both_teams(client):
    resp = client.get("/groups/exp/rollup")
    assert resp.status_code == 200
    body = resp.json()
    assert body["group_id"] == "exp"
    assert body["group_name"] == "Product"
    assert {tp["team_id"] for tp in body["team_plans"]} == {"msg", "email"}
    msg = client.get("/teams/msg/plan").json()
    email = client.get("/teams/email/plan").json()
    assert body["total_net_pm"] == pytest.approx(msg["net_pm"] + email["net_pm"], abs=1e-6)


def test_rollup_parent_group_includes_descendants(client):
    # "eng" is the parent of "exp" and has NO direct teams; its rollup must still
    # include msg + email (transitive descent) and sum their net PM — a bug that
    # summed only direct children would pass the team-set check but total 0.
    resp = client.get("/groups/eng/rollup")
    assert resp.status_code == 200
    body = resp.json()
    assert {tp["team_id"] for tp in body["team_plans"]} == {"msg", "email"}
    msg = client.get("/teams/msg/plan").json()
    email = client.get("/teams/email/plan").json()
    assert body["total_net_pm"] == pytest.approx(msg["net_pm"] + email["net_pm"], abs=1e-6)
    assert body["total_net_pm"] > 0


def test_rollup_unknown_group_404(client):
    assert client.get("/groups/ghost/rollup").status_code == 404
