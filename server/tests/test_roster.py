def test_roster_msg_effective_capacity(client):
    resp = client.get("/teams/msg/roster")
    assert resp.status_code == 200
    body = resp.json()
    rows = {r["engineer_id"]: r for r in body["roster"]}
    assert set(rows) == {"dia", "claudia", "albert"}
    # Dia: L3 (1.0) x none (1.0) x avail 1.0 x 0.71 baseline = 0.71
    assert rows["dia"]["effective_capacity"] == __import__("pytest").approx(0.71, abs=1e-3)
    # Albert: L2 (1.0) x avail 0.5 x 0.71 = 0.355
    assert rows["albert"]["effective_capacity"] == __import__("pytest").approx(0.355, abs=1e-3)
    assert rows["dia"]["level"] == "L3"
    assert rows["albert"]["availability"] == __import__("pytest").approx(0.5)


def test_roster_unknown_team_404(client):
    assert client.get("/teams/ghost/roster").status_code == 404
