import pytest
from capacity_engine.demand import DemandRange
from capacity_engine.fit import compute_fit, FitResult


def test_fit_headroom_and_oversubscription():
    # net 5.3 PM vs demand low/expected/high = 4.0/6.1/7.5
    fit = compute_fit(net_pm=5.3, demand=DemandRange(4.0, 6.1, 7.5))
    assert fit.expected_delta == pytest.approx(-0.8)   # oversubscribed
    assert fit.optimistic_delta == pytest.approx(1.3)  # net - low
    assert fit.pessimistic_delta == pytest.approx(-2.2)  # net - high
    assert fit.is_oversubscribed_expected is True


def test_fit_positive_when_demand_below_capacity():
    fit = compute_fit(net_pm=10.0, demand=DemandRange(6.0, 7.0, 8.0))
    assert fit.expected_delta == pytest.approx(3.0)
    assert fit.is_oversubscribed_expected is False
