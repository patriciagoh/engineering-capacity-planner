import pytest
from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
    Deliverable, DeliverableType, Estimate, Fidelity,
)
from capacity_engine.planning import plan_team, TeamPlan


def _org():
    team = Team(
        id="msg", name="Checkout", productive_weeks=12,
        reservations=[OverheadCategory(name="KTLO", level="team", fraction=0.5)],
    )
    eng = Engineer(id="maya", name="Maya", level=Level.L3,
                   assignments=[TeamAssignment("msg", 1.0)])
    deliv = Deliverable(
        id="d1", title="Checkout Redesign", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=2.0),
        owner_ids=["maya"],
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
    assert isinstance(plan.risks, tuple)  # truly immutable result


def test_plan_team_default_baseline_factor_threads_through():
    # The server uses the default (0.71), so verify it propagates: gross =
    # 1.0 effective * 0.71 * 12 / 4 = 2.13
    plan = plan_team(_org(), "msg")
    assert plan.gross_pm == pytest.approx(3.0 * 0.71)


def test_plan_team_unknown_team_raises():
    with pytest.raises(KeyError):
        plan_team(_org(), "ghost")


from capacity_engine.models import Group
from capacity_engine.planning import rollup_group, GroupRollup


def _two_team_org():
    g = Group(id="exp", name="Experiences", parent_id=None)
    msg = Team(id="msg", name="Msg", productive_weeks=12, group_id="exp")
    email = Team(id="email", name="Notifications", productive_weeks=12, group_id="exp")
    engs = [
        Engineer(id="maya", name="Maya", level=Level.L3,
                 assignments=[TeamAssignment("msg", 1.0)]),
        Engineer(id="sara", name="Sara", level=Level.L3,
                 assignments=[TeamAssignment("email", 1.0)]),
    ]
    return Org(teams=[msg, email], engineers=engs, groups=[g])


def test_rollup_group_aggregates_member_teams():
    org = _two_team_org()
    rollup = rollup_group(org, "exp", baseline_factor=1.0)
    assert isinstance(rollup, GroupRollup)
    assert rollup.group_id == "exp"
    assert {tp.team_id for tp in rollup.team_plans} == {"msg", "email"}
    # each team gross = 1.0 * 12 / 4 = 3.0 ; total 6.0
    assert rollup.total_gross_pm == pytest.approx(6.0)
    assert rollup.total_net_pm == pytest.approx(6.0)  # no reservations
    assert rollup.total_demand.expected == pytest.approx(0.0)  # no deliverables
