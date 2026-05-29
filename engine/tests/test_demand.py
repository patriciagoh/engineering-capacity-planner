import pytest
from capacity_engine.models import (
    Fidelity, DeliverableType, Estimate, Deliverable,
)
from capacity_engine.demand import normalize_estimate, total_demand, DemandRange


def _deliv(est, id="d"):
    return Deliverable(id=id, title=id, type=DeliverableType.DELIVERABLE, estimate=est)


def test_normalize_tshirt_L():
    r = normalize_estimate(Estimate(fidelity=Fidelity.TSHIRT, size="L"))
    assert (r.low, r.expected, r.high) == (1.5, 2.0, 3.0)


def test_normalize_person_months_passthrough():
    r = normalize_estimate(
        Estimate(fidelity=Fidelity.PERSON_MONTHS, low=1.0, expected=1.5, high=2.5)
    )
    assert (r.low, r.expected, r.high) == (1.0, 1.5, 2.5)


def test_normalize_person_months_defaults_low_high_to_expected():
    r = normalize_estimate(Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=2.0))
    assert (r.low, r.expected, r.high) == (2.0, 2.0, 2.0)


def test_normalize_sprint_allocation_uses_rolled_up_value():
    r = normalize_estimate(
        Estimate(fidelity=Fidelity.SPRINT_ALLOCATION, sprint_person_months=1.8)
    )
    assert (r.low, r.expected, r.high) == (1.8, 1.8, 1.8)


def test_total_demand_sums_ranges():
    delivs = [
        _deliv(Estimate(fidelity=Fidelity.TSHIRT, size="L"), "a"),       # 1.5/2.0/3.0
        _deliv(Estimate(fidelity=Fidelity.PERSON_MONTHS, expected=1.0), "b"),  # 1/1/1
    ]
    d = total_demand(delivs)
    assert (d.low, d.expected, d.high) == pytest.approx((2.5, 3.0, 4.0))


def test_normalize_unknown_tshirt_size_raises():
    with pytest.raises(ValueError, match="size"):
        normalize_estimate(Estimate(fidelity=Fidelity.TSHIRT, size="XXL"))
