"""Fit: compare net roadmap person-months against demand, carrying uncertainty."""
from dataclasses import dataclass

from capacity_engine.demand import DemandRange


@dataclass(frozen=True)
class FitResult:
    net_pm: float
    demand: DemandRange
    optimistic_delta: float   # net - demand.low        (best case)
    expected_delta: float     # net - demand.expected   (expected case)
    pessimistic_delta: float  # net - demand.high        (worst case)

    @property
    def is_oversubscribed_expected(self) -> bool:
        return self.expected_delta < 0


def compute_fit(net_pm: float, demand: DemandRange) -> FitResult:
    return FitResult(
        net_pm=net_pm,
        demand=demand,
        optimistic_delta=net_pm - demand.low,
        expected_delta=net_pm - demand.expected,
        pessimistic_delta=net_pm - demand.high,
    )
