import pytest
from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
)
from capacity_engine.validation import validate_org, ValidationError


def _valid_org():
    team = Team(
        id="t", name="T", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.5)],
    )
    eng = Engineer(id="a", name="A", level=Level.L3,
                   assignments=[TeamAssignment("t", 1.0)])
    return Org(teams=[team], engineers=[eng])


def test_valid_org_passes():
    validate_org(_valid_org())  # no raise


def test_individual_category_in_reservations_rejected():
    org = _valid_org()
    org.teams[0].reservations.append(
        OverheadCategory(name="Meetings", level="individual", fraction=0.1)
    )
    with pytest.raises(ValidationError, match="individual"):
        validate_org(org)


def test_reservations_over_100_percent_rejected():
    org = _valid_org()
    org.teams[0].reservations.append(
        OverheadCategory(name="Support", level="team", fraction=0.6)
    )  # 0.5 + 0.6 > 1.0
    with pytest.raises(ValidationError, match="exceed"):
        validate_org(org)


def test_negative_productive_weeks_rejected():
    org = _valid_org()
    org.teams[0].productive_weeks = -1
    with pytest.raises(ValidationError, match="productive_weeks"):
        validate_org(org)


def test_availability_out_of_range_rejected():
    org = _valid_org()
    org.engineers[0].assignments[0].availability = 1.5
    with pytest.raises(ValidationError, match="availability"):
        validate_org(org)


def test_assignment_to_unknown_team_rejected():
    org = _valid_org()
    org.engineers[0].assignments.append(TeamAssignment("ghost", 0.5))
    with pytest.raises(ValidationError, match="unknown team"):
        validate_org(org)


def test_negative_reservation_fraction_rejected():
    org = _valid_org()
    org.teams[0].reservations.append(
        OverheadCategory(name="Weird", level="team", fraction=-0.1)
    )
    with pytest.raises(ValidationError, match="out of range"):
        validate_org(org)


def test_individual_category_in_ideal_reservations_rejected():
    org = _valid_org()
    org.teams[0].ideal_reservations.append(
        OverheadCategory(name="Meetings", level="individual", fraction=0.1)
    )
    with pytest.raises(ValidationError, match="individual"):
        validate_org(org)


def test_ideal_reservations_over_100_percent_rejected():
    org = _valid_org()
    org.teams[0].ideal_reservations.append(
        OverheadCategory(name="KTLO", level="team", fraction=0.7)
    )
    org.teams[0].ideal_reservations.append(
        OverheadCategory(name="Support", level="team", fraction=0.5)
    )  # 1.2 > 1.0
    with pytest.raises(ValidationError, match="exceeds"):
        validate_org(org)
