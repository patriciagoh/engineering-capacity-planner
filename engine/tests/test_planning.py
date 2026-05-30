import pytest
from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
    Deliverable, DeliverableType, Estimate, Fidelity,
)
from capacity_engine.planning import plan_team, TeamPlan


def _org():
    team = Team(
        id="msg", name="Messaging Experience", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.5)],
    )
    eng = Engineer(id="dia", name="Dia", level=Level.L3,
                   assignments=[TeamAssignment("msg", 1.0)])
    deliv = Deliverable(
        id="d1", title="SunCo", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=2.0),
        owner_ids=["dia"],
    )
    return Org(teams=[team], engineers=[eng], deliverables=[deliv])


def test_plan_team_composes_pipeline():
    plan = plan_team(_org(), "msg", baseline_factor=1.0)
    assert isinstance(plan, TeamPlan)
    assert plan.team_id == "msg"
    # gross = 1.0 * 12 / 4 = 3.0 ; net = 3.0 * (1 - 0.5) = 1.5
    assert plan.gross_pm == pytest.approx(3.0)
    assert plan.net_pm == pytest.approx(1.5)
    assert plan.demand.expected == pytest.approx(2.0)
    # net 1.5 - demand 2.0 = -0.5 expected -> oversubscribed
    assert plan.fit.expected_delta == pytest.approx(-0.5)
    assert any(r.kind == "oversubscription" for r in plan.risks)


def test_plan_team_unknown_team_raises():
    with pytest.raises(KeyError):
        plan_team(_org(), "ghost")
