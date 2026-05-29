from capacity_engine.models import (
    Level, OnboardingState, Fidelity, DeliverableType,
    TeamAssignment, Engineer, OverheadCategory, Team, Quarter,
    Estimate, Deliverable,
)


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
