from capacity_engine.models import (
    Level, TeamAssignment, Engineer, Team, Org, OverheadCategory,
    Deliverable, DeliverableType, Estimate, Fidelity,
)
from capacity_engine.demand import DemandRange
from capacity_engine.fit import compute_fit
from capacity_engine.risks import detect_risks, Risk


def test_oversubscription_risk_emitted():
    fit = compute_fit(net_pm=5.3, demand=DemandRange(4.0, 6.1, 7.5))
    org = Org(teams=[Team(id="t", name="T", productive_weeks=12)], engineers=[])
    risks = detect_risks(org, team_id="t", fit=fit)
    kinds = {r.kind for r in risks}
    assert "oversubscription" in kinds


def test_no_oversubscription_when_headroom():
    fit = compute_fit(net_pm=10.0, demand=DemandRange(6.0, 7.0, 8.0))
    org = Org(teams=[Team(id="t", name="T", productive_weeks=12)], engineers=[])
    risks = detect_risks(org, team_id="t", fit=fit)
    assert all(r.kind != "oversubscription" for r in risks)


def test_spof_risk_when_single_owner_no_backup():
    team = Team(id="t", name="T", productive_weeks=12)
    eng = Engineer(id="leah", name="Leah", level=Level.L3,
                   assignments=[TeamAssignment("t", 1.0)])
    deliv = Deliverable(
        id="ard", title="Auto Reply Detection", type=DeliverableType.DELIVERABLE,
        estimate=Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=1.8),
        owner_ids=["leah"],
    )
    org = Org(teams=[team], engineers=[eng], deliverables=[deliv])
    fit = compute_fit(net_pm=10.0, demand=DemandRange(1.8, 1.8, 1.8))
    risks = detect_risks(org, team_id="t", fit=fit)
    spof = [r for r in risks if r.kind == "single_point_of_failure"]
    assert len(spof) == 1
    assert "Leah" in spof[0].detail
