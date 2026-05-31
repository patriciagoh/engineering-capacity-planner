from fastapi.testclient import TestClient
from capacity_server.app_seeded import create_seeded_app


def test_seeded_app_has_sample_org():
    c = TestClient(create_seeded_app())
    body = c.get("/org").json()
    assert {t["id"] for t in body["teams"]} == {"msg", "email"}
    assert c.get("/teams/msg/plan").status_code == 200
