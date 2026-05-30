from capacity_engine.models import (
    Level, OnboardingState, Fidelity, DeliverableType,
    TeamAssignment, Engineer, OverheadCategory, Team, Quarter,
    Estimate, Deliverable, Org,
)
from capacity_engine.store import org_to_dict, org_from_dict


def test_engineer_constructs_with_assignments():
    eng = Engineer(
        id="dia", name="Dia", level=Level.L3,
        assignments=[TeamAssignment(team_id="msgexp", availability=1.0)],
        onboarding_state=OnboardingState.NONE,
    )
    assert eng.assignments[0].availability == 1.0
    assert eng.level is Level.L3


def test_deliverable_with_tshirt_estimate():
    d = Deliverable(
        id="suncoc", title="SunCo CPaaS", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.TSHIRT, size="L"),
        priority=1,
    )
    assert d.estimate.fidelity is Fidelity.TSHIRT
    assert d.estimate.size == "L"


def test_overhead_category_level_enforced_as_enum():
    c = OverheadCategory(name="KTLO", level="team", fraction=0.7)
    assert c.level == "team"


def test_org_round_trips_through_dict():
    eng = Engineer(
        id="dia", name="Dia", level=Level.L3,
        assignments=[TeamAssignment(team_id="msgexp", availability=1.0)],
        onboarding_state=OnboardingState.NEW_HIRE_M2,
    )
    team = Team(
        id="msgexp", name="Messaging Experience", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.7)],
        ideal_reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.4)],
    )
    deliv = Deliverable(
        id="suncoc", title="SunCo CPaaS", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=2.5),
        owner_ids=["dia"], jira_epic="MSG-123",
    )
    org = Org(
        teams=[team], engineers=[eng], deliverables=[deliv],
        quarter=Quarter(id="q2-2026", label="Q2 2026", as_of="2026-05-29"),
    )

    restored = org_from_dict(org_to_dict(org))
    # values
    assert restored.team("msgexp").reservations[0].fraction == 0.7
    assert restored.team("msgexp").ideal_reservations[0].fraction == 0.4
    assert restored.deliverables[0].estimate.expected == 2.5
    assert restored.engineers[0].availability_on("msgexp") == 1.0
    assert restored.deliverables[0].jira_epic == "MSG-123"
    assert restored.quarter.label == "Q2 2026"
    assert restored.quarter.as_of == "2026-05-29"
    # enum identity must survive the round trip (not raw strings)
    assert restored.engineers[0].level is Level.L3
    assert restored.engineers[0].onboarding_state is OnboardingState.NEW_HIRE_M2
    assert restored.deliverables[0].type is DeliverableType.DELIVERABLE
    assert restored.deliverables[0].estimate.fidelity is Fidelity.PERSON_MONTHS


def test_org_round_trips_groups_and_group_id():
    from capacity_engine.models import Group
    org = Org(
        teams=[Team(id="msg", name="Messaging Experience", productive_weeks=12,
                    group_id="exp")],
        engineers=[],
        groups=[
            Group(id="eng", name="Engineering", parent_id=None),
            Group(id="exp", name="Experiences", parent_id="eng"),
        ],
    )
    restored = org_from_dict(org_to_dict(org))
    assert restored.team("msg").group_id == "exp"
    assert {g.id for g in restored.groups} == {"eng", "exp"}
    assert restored.group("exp").parent_id == "eng"
