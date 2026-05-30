"""FastAPI application factory."""
from fastapi import FastAPI

from capacity_engine.models import Org
from capacity_server.routes import router
from capacity_server.state import OrgStore


def create_app(org: Org | None = None) -> FastAPI:
    app = FastAPI(title="Capacity Planning API", version="0.1.0")
    app.state.store = OrgStore(org)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(router)
    return app
