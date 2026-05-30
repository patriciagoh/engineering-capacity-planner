"""Demand side: normalize estimates of any fidelity onto person-month ranges."""
from dataclasses import dataclass

from capacity_engine.models import Deliverable, Estimate, Fidelity

TSHIRT_RANGES = {
    "S": (0.25, 0.5, 0.75),
    "M": (0.75, 1.0, 1.5),
    "L": (1.5, 2.0, 3.0),
    "XL": (3.0, 4.0, 6.0),
}


@dataclass
class DemandRange:
    low: float
    expected: float
    high: float


def normalize_estimate(est: Estimate) -> DemandRange:
    if est.fidelity is Fidelity.TSHIRT:
        if est.size not in TSHIRT_RANGES:
            raise ValueError(f"unknown t-shirt size: {est.size!r}")
        low, exp, high = TSHIRT_RANGES[est.size]
        return DemandRange(low, exp, high)

    if est.fidelity is Fidelity.PERSON_MONTHS:
        if est.expected is None:
            raise ValueError("person_months estimate requires `expected`")
        low = est.low if est.low is not None else est.expected
        high = est.high if est.high is not None else est.expected
        return DemandRange(low, est.expected, high)

    if est.fidelity is Fidelity.SPRINT_ALLOCATION:
        if est.sprint_person_months is None:
            raise ValueError("sprint_allocation estimate requires `sprint_person_months`")
        v = est.sprint_person_months
        return DemandRange(v, v, v)

    raise ValueError(f"unhandled fidelity: {est.fidelity!r}")


def total_demand(deliverables: list[Deliverable]) -> DemandRange:
    low = expected = high = 0.0
    for d in deliverables:
        r = normalize_estimate(d.estimate)
        low += r.low
        expected += r.expected
        high += r.high
    return DemandRange(low, expected, high)
