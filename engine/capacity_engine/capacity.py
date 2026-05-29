"""Capacity math: effective per-engineer capacity and team person-months.

One person-month = 4 productive weeks of one full-time engineer.
"""
from capacity_engine.models import Engineer, Team
from capacity_engine.multipliers import level_multiplier, onboarding_multiplier

# Bucket-A always-on overhead -> baseline factor. See plan Task 4 note.
DEFAULT_BASELINE_FACTOR = 0.71

WEEKS_PER_PERSON_MONTH = 4.0


def effective_capacity(
    engineer: Engineer, team_id: str, baseline_factor: float = DEFAULT_BASELINE_FACTOR
) -> float:
    """Fraction of one full-time engineer's productive output on this team."""
    return (
        engineer.availability_on(team_id)
        * level_multiplier(engineer.level)
        * onboarding_multiplier(engineer.onboarding_state)
        * baseline_factor
    )


def gross_person_months(
    roster: list[Engineer], team: Team, baseline_factor: float = DEFAULT_BASELINE_FACTOR
) -> float:
    """Total person-months available before team reservations (Bucket C)."""
    total_effective = sum(
        effective_capacity(e, team.id, baseline_factor) for e in roster
    )
    return total_effective * team.productive_weeks / WEEKS_PER_PERSON_MONTH
