from capacity_engine.models import Level, OnboardingState
from capacity_engine.multipliers import level_multiplier, onboarding_multiplier


def test_level_multipliers_match_sheet():
    assert level_multiplier(Level.INTERN) == 0.70
    assert level_multiplier(Level.L2) == 1.00
    assert level_multiplier(Level.L3) == 1.00
    assert level_multiplier(Level.STAFF) == 0.85
    assert level_multiplier(Level.PRINCIPAL) == 0.70


def test_onboarding_multipliers_match_sheet():
    assert onboarding_multiplier(OnboardingState.NONE) == 1.00
    assert onboarding_multiplier(OnboardingState.NEW_HIRE_M1) == 0.25
    assert onboarding_multiplier(OnboardingState.NEW_HIRE_M2) == 0.50
    assert onboarding_multiplier(OnboardingState.NEW_HIRE_M3) == 0.75
    assert onboarding_multiplier(OnboardingState.MENTOR_M1) == 0.85
    assert onboarding_multiplier(OnboardingState.MENTOR_M2) == 0.90
    assert onboarding_multiplier(OnboardingState.MENTOR_M3) == 0.95
