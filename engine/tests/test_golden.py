import json
from pathlib import Path

import pytest

from capacity_engine.models import Level, OnboardingState, TeamAssignment, Engineer, Team
from capacity_engine.capacity import gross_person_months

FIXTURE = Path(__file__).parent / "fixtures" / "golden_teams.json"


def _roster(team_id, availabilities):
    return [
        Engineer(
            id=f"{team_id}-{i}", name=f"{team_id}-{i}", level=Level.L3,
            assignments=[TeamAssignment(team_id, a)],
            onboarding_state=OnboardingState.NONE,
        )
        for i, a in enumerate(availabilities)
    ]


_CASES = json.loads(FIXTURE.read_text())["teams"]


@pytest.mark.parametrize("case", _CASES, ids=[c["id"] for c in _CASES])
def test_gross_pm_reproduces_sheet_total(case):
    # `expected_pm` is the exact value these availabilities must produce. Where the
    # sheet rounds for display (Channels: 21.75 vs displayed 21.8), the fixture also
    # records `sheet_displayed_pm` and a note. Tolerance is tight to catch real drift.
    team = Team(id=case["id"], name=case["name"], productive_weeks=case["productive_weeks"])
    roster = _roster(case["id"], case["availabilities"])
    pm = gross_person_months(roster, team, baseline_factor=1.0)
    assert pm == pytest.approx(case["expected_pm"], abs=0.001), (
        f"{case['name']}: engine {pm:.4f} PM != expected {case['expected_pm']} PM"
    )
