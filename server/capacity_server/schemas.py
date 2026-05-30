"""Request schemas and translation to engine Change objects."""
from capacity_engine.scenarios import (
    AddEngineer, Change, RemoveEngineer, SetAvailability, SetReservation,
)
from capacity_engine.models import Engineer, Level, OnboardingState, TeamAssignment


def change_from_dict(d: dict) -> Change:
    """Translate one change descriptor into an engine Change. Raises ValueError
    on an unknown op or missing fields (handled as HTTP 400 by the caller)."""
    op = d.get("op")
    if op == "set_availability":
        return SetAvailability(
            engineer_id=d["engineer_id"], team_id=d["team_id"],
            availability=float(d["availability"]),
        )
    if op == "set_reservation":
        return SetReservation(
            team_id=d["team_id"], name=d["name"], fraction=float(d["fraction"]),
        )
    if op == "remove_engineer":
        return RemoveEngineer(engineer_id=d["engineer_id"])
    if op == "add_engineer":
        return AddEngineer(engineer=Engineer(
            id=d["id"], name=d["name"], level=Level(d["level"]),
            onboarding_state=OnboardingState(d.get("onboarding_state", "none")),
            assignments=[TeamAssignment(team_id=a["team_id"],
                                        availability=float(a["availability"]))
                         for a in d.get("assignments", [])],
        ))
    raise ValueError(f"unknown change op: {op!r}")
