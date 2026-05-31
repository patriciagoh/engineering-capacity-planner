from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
    Deliverable, DeliverableType, Estimate, Fidelity,
)
from capacity_engine.demand import DemandRange
from capacity_engine.fit import compute_fit
from capacity_engine.risks import detect_risks, Risk, Severity


def test_oversubscription_risk_emitted_high_when_expected_negative():
    fit = compute_fit(net_pm=5.3, demand=DemandRange(4.0, 6.1, 7.5))
    org = Org(teams=[Team(id="t", name="T", productive_weeks=12)], engineers=[])
    risks = detect_risks(org, team_id="t", fit=fit)
    over = [r for r in risks if r.kind == "oversubscription"]
    assert len(over) == 1
    assert over[0].severity is Severity.HIGH


def test_oversubscription_medium_when_only_pessimistic_negative():
    # expected_delta = 7.0 - 6.5 = +0.5 (ok); pessimistic_delta = 7.0 - 8.0 = -1.0 (risk)
    fit = compute_fit(net_pm=7.0, demand=DemandRange(4.0, 6.5, 8.0))
    org = Org(teams=[Team(id="t", name="T", productive_weeks=12)], engineers=[])
    over = [r for r in detect_risks(org, team_id="t", fit=fit)
            if r.kind == "oversubscription"]
    assert len(over) == 1
    assert over[0].severity is Severity.MEDIUM


def test_no_oversubscription_when_headroom():
    fit = compute_fit(net_pm=10.0, demand=DemandRange(6.0, 7.0, 8.0))
    org = Org(teams=[Team(id="t", name="T", productive_weeks=12)], engineers=[])
    risks = detect_risks(org, team_id="t", fit=fit)
    assert all(r.kind != "oversubscription" for r in risks)


def test_spof_risk_when_single_owner_no_backup():
    team = Team(id="t", name="T", productive_weeks=12)
    eng = Engineer(id="sara", name="Sara", level=Level.L3,
                   assignments=[TeamAssignment("t", 1.0)])
    deliv = Deliverable(
        id="ard", title="Smart Replies", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=1.8),
        owner_ids=["sara"],
    )
    org = Org(teams=[team], engineers=[eng], deliverables=[deliv])
    fit = compute_fit(net_pm=10.0, demand=DemandRange(1.8, 1.8, 1.8))
    risks = detect_risks(org, team_id="t", fit=fit)
    spof = [r for r in risks if r.kind == "single_point_of_failure"]
    assert len(spof) == 1
    assert "Sara" in spof[0].detail
