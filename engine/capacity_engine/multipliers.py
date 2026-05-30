"""Pure lookup tables for level and onboarding multipliers (from Sheet 1)."""
from capacity_engine.models import Level, OnboardingState

_LEVEL = {
    Level.INTERN: 0.70,
    Level.L2: 1.00,
    Level.L3: 1.00,
    Level.STAFF: 0.85,
    Level.PRINCIPAL: 0.70,
}

_ONBOARDING = {
    OnboardingState.NONE: 1.00,
    OnboardingState.NEW_HIRE_M1: 0.25,
    OnboardingState.NEW_HIRE_M2: 0.50,
    OnboardingState.NEW_HIRE_M3: 0.75,
    OnboardingState.MENTOR_M1: 0.85,
    OnboardingState.MENTOR_M2: 0.90,
    OnboardingState.MENTOR_M3: 0.95,
}


def level_multiplier(level: Level) -> float:
    return _LEVEL[level]


def onboarding_multiplier(state: OnboardingState) -> float:
    return _ONBOARDING[state]
