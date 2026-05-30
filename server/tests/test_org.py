def test_get_org_returns_seeded(client):
    resp = client.get("/org")
    assert resp.status_code == 200
    body = resp.json()
    assert {t["id"] for t in body["teams"]} == {"msg", "email"}


def test_post_valid_org_replaces(client):
    new_org = {
        "teams": [{"id": "solo", "name": "Solo", "productive_weeks": 10,
                   "reservations": [], "ideal_reservations": []}],
        "engineers": [], "deliverables": [], "groups": [],
    }
    resp = client.post("/org", json=new_org)
    assert resp.status_code == 200
    assert {t["id"] for t in client.get("/org").json()["teams"]} == {"solo"}


def test_post_invalid_org_returns_400(client):
    bad = {  # reservation tagged individual -> validation error
        "teams": [{"id": "t", "name": "T", "productive_weeks": 12,
                   "reservations": [{"name": "Meetings", "level": "individual",
                                     "fraction": 0.1}],
                   "ideal_reservations": []}],
        "engineers": [], "deliverables": [], "groups": [],
    }
    resp = client.post("/org", json=bad)
    assert resp.status_code == 400
    assert "individual" in resp.json()["detail"]
