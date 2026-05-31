def test_team_plan_msg(client):
    resp = client.get("/teams/msg/plan")
    assert resp.status_code == 200
    body = resp.json()
    assert body["team_id"] == "msg"
    # roster msg: Maya 1.0, Priya 1.0, Tom 0.5 = 2.5 effective (L3/L2, none)
    # gross = 2.5 * 0.71 * 12 / 4 = 5.325 ; net = gross * (1 - 0.7)
    assert body["gross_pm"] == __import__("pytest").approx(5.325, abs=1e-3)
    assert body["net_pm"] == __import__("pytest").approx(5.325 * 0.30, abs=1e-3)
    assert "fit" in body and "risks" in body


def test_team_plan_unknown_team_404(client):
    resp = client.get("/teams/ghost/plan")
    assert resp.status_code == 404
