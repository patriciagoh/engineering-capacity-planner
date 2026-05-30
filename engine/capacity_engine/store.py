"""JSON (de)serialization for Org. The only module that touches the filesystem."""
import json
from pathlib import Path

from capacity_engine.models import (
    Level, OnboardingState, Fidelity, DeliverableType,
    TeamAssignment, Engineer, OverheadCategory, Team, Quarter,
    Estimate, Deliverable, Org,
)


def org_to_dict(org: Org) -> dict:
    return {
        "quarter": _quarter_to_dict(org.quarter) if org.quarter else None,
        "teams": [
            {
                "id": t.id, "name": t.name, "productive_weeks": t.productive_weeks,
                "reservations": [_cat_to_dict(c) for c in t.reservations],
                "ideal_reservations": [_cat_to_dict(c) for c in t.ideal_reservations],
            }
            for t in org.teams
        ],
        "engineers": [
            {
                "id": e.id, "name": e.name, "level": e.level.value,
                "onboarding_state": e.onboarding_state.value,
                "assignments": [
                    {"team_id": a.team_id, "availability": a.availability}
                    for a in e.assignments
                ],
            }
            for e in org.engineers
        ],
        "deliverables": [
            {
                "id": d.id, "title": d.title, "type": d.type.value,
                "priority": d.priority, "target_sprint": d.target_sprint,
                "owner_ids": list(d.owner_ids), "jira_epic": d.jira_epic,
                "estimate": _estimate_to_dict(d.estimate),
            }
            for d in org.deliverables
        ],
    }


def org_from_dict(data: dict) -> Org:
    teams = [
        Team(
            id=t["id"], name=t["name"], productive_weeks=t["productive_weeks"],
            reservations=[_cat_from_dict(c) for c in t.get("reservations", [])],
            ideal_reservations=[_cat_from_dict(c) for c in t.get("ideal_reservations", [])],
        )
        for t in data.get("teams", [])
    ]
    engineers = [
        Engineer(
            id=e["id"], name=e["name"], level=Level(e["level"]),
            onboarding_state=OnboardingState(e.get("onboarding_state", "none")),
            assignments=[
                TeamAssignment(team_id=a["team_id"], availability=a["availability"])
                for a in e.get("assignments", [])
            ],
        )
        for e in data.get("engineers", [])
    ]
    deliverables = [
        Deliverable(
            id=d["id"], title=d["title"], type=DeliverableType(d["type"]),
            priority=d.get("priority", 100), target_sprint=d.get("target_sprint"),
            owner_ids=list(d.get("owner_ids", [])), jira_epic=d.get("jira_epic"),
            estimate=_estimate_from_dict(d["estimate"]),
        )
        for d in data.get("deliverables", [])
    ]
    quarter = _quarter_from_dict(data["quarter"]) if data.get("quarter") else None
    return Org(teams=teams, engineers=engineers, deliverables=deliverables, quarter=quarter)


def load_org(path: str | Path) -> Org:
    return org_from_dict(json.loads(Path(path).read_text()))


def save_org(org: Org, path: str | Path) -> None:
    Path(path).write_text(json.dumps(org_to_dict(org), indent=2))


def _cat_to_dict(c: OverheadCategory) -> dict:
    return {"name": c.name, "level": c.level, "fraction": c.fraction}


def _cat_from_dict(d: dict) -> OverheadCategory:
    return OverheadCategory(name=d["name"], level=d["level"], fraction=d["fraction"])


def _estimate_to_dict(e: Estimate) -> dict:
    return {
        "fidelity": e.fidelity.value, "size": e.size, "low": e.low,
        "expected": e.expected, "high": e.high,
        "sprint_person_months": e.sprint_person_months,
    }


def _estimate_from_dict(d: dict) -> Estimate:
    return Estimate(
        fidelity=Fidelity(d["fidelity"]), size=d.get("size"), low=d.get("low"),
        expected=d.get("expected"), high=d.get("high"),
        sprint_person_months=d.get("sprint_person_months"),
    )


def _quarter_to_dict(q: Quarter) -> dict:
    return {"id": q.id, "label": q.label, "as_of": q.as_of}


def _quarter_from_dict(d: dict) -> Quarter:
    return Quarter(id=d["id"], label=d["label"], as_of=d["as_of"])
