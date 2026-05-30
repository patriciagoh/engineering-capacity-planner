import pytest
from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
    Deliverable, DeliverableType, Estimate, Fidelity,
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


def test_cross_team_availability_over_one_rejected():
    org = _valid_org()
    org.teams.append(Team(id="t2", name="T2", productive_weeks=12))
    # engineer "a" is at 1.0 on t; add 0.5 on t2 -> 1.5 total
    org.engineers[0].assignments.append(TeamAssignment("t2", 0.5))
    with pytest.raises(ValidationError, match="exceeds 1.0"):
        validate_org(org)


def test_cross_team_availability_exactly_one_passes():
    org = _valid_org()
    org.teams.append(Team(id="t2", name="T2", productive_weeks=12))
    org.engineers[0].assignments[0].availability = 0.5
    org.engineers[0].assignments.append(TeamAssignment("t2", 0.5))  # 0.5 + 0.5 = 1.0
    validate_org(org)  # no raise


def test_deliverable_unknown_owner_rejected():
    org = _valid_org()
    org.deliverables.append(Deliverable(
        id="d", title="Ghosted", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=1.0),
        owner_ids=["nobody"],
    ))
    with pytest.raises(ValidationError, match="not a known engineer"):
        validate_org(org)


def test_deliverable_malformed_estimate_rejected():
    org = _valid_org()
    org.deliverables.append(Deliverable(
        id="d", title="No Size", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.TSHIRT),  # missing size
        owner_ids=["a"],
    ))
    with pytest.raises(ValidationError, match="invalid estimate"):
        validate_org(org)


def test_valid_org_with_deliverable_passes():
    org = _valid_org()
    org.deliverables.append(Deliverable(
        id="d", title="Real Work", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=1.5),
        owner_ids=["a"],
    ))
    validate_org(org)  # no raise


from capacity_engine.models import Group


def test_team_unknown_group_rejected():
    org = _valid_org()
    org.teams[0].group_id = "ghost"
    with pytest.raises(ValidationError, match="unknown group"):
        validate_org(org)


def test_group_unknown_parent_rejected():
    org = _valid_org()
    org.groups.append(Group(id="g1", name="G1", parent_id="missing"))
    with pytest.raises(ValidationError, match="unknown parent"):
        validate_org(org)


def test_group_cycle_rejected():
    org = _valid_org()
    org.groups.append(Group(id="a", name="A", parent_id="b"))
    org.groups.append(Group(id="b", name="B", parent_id="a"))
    with pytest.raises(ValidationError, match="cycle"):
        validate_org(org)
