"""Endpoint handlers. The store is read from app.state."""
from fastapi import APIRouter, HTTPException, Request

from capacity_engine.store import org_from_dict, org_to_dict
from capacity_engine.validation import ValidationError, validate_org

router = APIRouter()


def _store(request: Request):
    return request.app.state.store


@router.get("/org")
def get_org(request: Request) -> dict:
    return org_to_dict(_store(request).get())


@router.post("/org")
def put_org(payload: dict, request: Request) -> dict:
    try:
        org = org_from_dict(payload)
        validate_org(org)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"malformed org: {exc}") from exc
    _store(request).set(org)
    return {"status": "ok", "teams": len(org.teams)}
