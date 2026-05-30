import pytest
from fastapi.testclient import TestClient

from capacity_server.app import create_app


@pytest.fixture
def client():
    return TestClient(create_app())
