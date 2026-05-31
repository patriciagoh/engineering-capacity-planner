"""Factory that serves the bundled sample org — for local frontend dev:
    uvicorn 'capacity_server.app_seeded:create_seeded_app' --factory --port 8000
"""
from pathlib import Path

from fastapi.middleware.cors import CORSMiddleware

from capacity_engine.store import load_org
from capacity_server.app import create_app

SAMPLE = Path(__file__).parent.parent / "data" / "sample_org.json"


def create_seeded_app():
    app = create_app(org=load_org(SAMPLE))
    # The Vite dev server proxies the API, but allow direct cross-origin dev too.
    app.add_middleware(
        CORSMiddleware, allow_origins=["http://localhost:5173"],
        allow_methods=["*"], allow_headers=["*"],
    )
    return app
