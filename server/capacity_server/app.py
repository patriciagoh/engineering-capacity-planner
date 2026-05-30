"""FastAPI application factory."""
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Capacity Planning API", version="0.1.0")

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app
