import pytest
from capacity_engine.models import (
    Level, OnboardingState, TeamAssignment, Engineer, Team, Org, OverheadCategory,
)
from capacity_engine.scenarios import (
    apply_scenario, SetAvailability, SetReservation, RemoveEngineer, AddEngineer,
)


def _org():
    team = Team(
        id="t", name="T", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.5)],
    )
    eng = Engineer(
        id="a", name="A", level=Level.L3,
        assignments=[TeamAssignment(team_id="t", availability=1.0)],
    )
    return Org(teams=[team], engineers=[eng])


def test_apply_does_not_mutate_baseline():
    base = _org()
    apply_scenario(base, [SetAvailability(engineer_id="a", team_id="t", availability=0.5)])
    assert base.engineers[0].availability_on("t") == 1.0  # unchanged


def test_set_availability():
    out = apply_scenario(_org(), [SetAvailability("a", "t", 0.5)])
    assert out.engineers[0].availability_on("t") == 0.5


def test_set_reservation_updates_existing():
    out = apply_scenario(_org(), [SetReservation(team_id="t", name="KTLO", fraction=0.4)])
    assert out.team("t").reservations[0].fraction == 0.4


def test_remove_engineer():
    out = apply_scenario(_org(), [RemoveEngineer(engineer_id="a")])
    assert out.engineers == []


def test_add_engineer():
    new = Engineer(
        id="b", name="B", level=Level.L2,
        assignments=[TeamAssignment(team_id="t", availability=1.0)],
        onboarding_state=OnboardingState.NEW_HIRE_M1,
    )
    out = apply_scenario(_org(), [AddEngineer(engineer=new)])
    assert {e.id for e in out.engineers} == {"a", "b"}
