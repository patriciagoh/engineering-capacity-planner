import pytest
from capacity_engine.models import (
    Level, OnboardingState, TeamAssignment, Engineer, Team,
)
from capacity_engine.capacity import (
    DEFAULT_BASELINE_FACTOR, effective_capacity, gross_person_months,
)


def _eng(id, level, avail, onb=OnboardingState.NONE):
    return Engineer(
        id=id, name=id.title(), level=level,
        assignments=[TeamAssignment(team_id="t", availability=avail)],
        onboarding_state=onb,
    )


def test_effective_capacity_neutral_is_availability():
    # baseline_factor=1.0, L3 (1.0), none (1.0) -> equals availability
    e = _eng("a", Level.L3, 1.0)
    assert effective_capacity(e, "t", baseline_factor=1.0) == 1.0


def test_effective_capacity_applies_all_multipliers():
    e = _eng("a", Level.STAFF, 0.5, OnboardingState.MENTOR_M1)
    # 0.5 * 0.85 (staff) * 0.85 (mentor m1) * 1.0 baseline
    assert effective_capacity(e, "t", baseline_factor=1.0) == pytest.approx(0.36125)


def test_default_baseline_factor_value():
    assert DEFAULT_BASELINE_FACTOR == 0.71


def test_gross_person_months_neutral_matches_sheet_formula():
    # Extensibility roster: [1,1,1,1,0.5] over 12 productive weeks -> 13.5 PM
    team = Team(id="t", name="Ext", productive_weeks=12)
    roster = [
        _eng("a", Level.L3, 1.0), _eng("b", Level.L3, 1.0),
        _eng("c", Level.L3, 1.0), _eng("d", Level.L3, 1.0),
        _eng("e", Level.L3, 0.5),
    ]
    pm = gross_person_months(roster, team, baseline_factor=1.0)
    assert pm == pytest.approx(13.5)


from capacity_engine.models import OverheadCategory
from capacity_engine.capacity import net_person_months


def test_net_person_months_subtracts_team_reservations():
    team = Team(
        id="t", name="Msg", productive_weeks=12,
        reservations=[
            OverheadCategory(name="KTLO", level="team", fraction=0.70),
            OverheadCategory(name="PTO", level="team", fraction=0.05),
        ],
    )
    # gross 10.0 -> reserve 75% -> 2.5 net
    assert net_person_months(10.0, team) == pytest.approx(2.5)


def test_net_person_months_rejects_individual_category_in_reservations():
    team = Team(
        id="t", name="Bad", productive_weeks=12,
        reservations=[OverheadCategory(name="Meetings", level="individual", fraction=0.1)],
    )
    with pytest.raises(ValueError, match="individual"):
        net_person_months(10.0, team)
