import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from capacity_engine.store import load_org
from capacity_server.app import create_app

SAMPLE = Path(__file__).parent.parent / "data" / "sample_org.json"


@pytest.fixture
def client():
    app = create_app(org=load_org(SAMPLE))
    return TestClient(app)
