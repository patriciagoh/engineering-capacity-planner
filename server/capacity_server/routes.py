"""Endpoint handlers. The store is read from app.state."""
from fastapi import APIRouter, HTTPException, Request

from capacity_engine.planning import plan_team
from capacity_engine.store import org_from_dict, org_to_dict
from capacity_engine.validation import ValidationError, validate_org
from capacity_server.serialize import team_plan_to_dict
from capacity_server.state import OrgStore

router = APIRouter()


def _store(request: Request) -> OrgStore:
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
    except (KeyError, ValueError, TypeError) as exc:
        # TypeError: user JSON with a wrong-typed field (engine is stdlib, not
        # Pydantic, so it doesn't coerce) — still a malformed-input 400, not a 500.
        raise HTTPException(status_code=400, detail=f"malformed org: {exc}") from exc
    _store(request).set(org)
    return {"status": "ok", "teams": len(org.teams)}


@router.get("/teams/{team_id}/plan")
def get_team_plan(team_id: str, request: Request) -> dict:
    try:
        plan = plan_team(_store(request).get(), team_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown team: {team_id}") from exc
    return team_plan_to_dict(plan)
