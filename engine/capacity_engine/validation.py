"""Input validation. Errors are plain-language so UI/skill can surface them."""
from capacity_engine.models import Org, OverheadCategory, Team


class ValidationError(Exception):
    pass


def _validate_category_list(
    team: Team, label: str, categories: list[OverheadCategory]
) -> None:
    """Validate a team's reservation list (real or ideal): every category must be
    team-level, each fraction in 0..1, and the total must not exceed 100%."""
    total = 0.0
    for cat in categories:
        if cat.level != "team":
            raise ValidationError(
                f"team {team.name!r}: {label} {cat.name!r} is level "
                f"{cat.level!r}; only 'team'-level categories may be reservations "
                "(individual overhead belongs in the baseline factor)"
            )
        if not (0.0 <= cat.fraction <= 1.0):
            raise ValidationError(
                f"team {team.name!r}: {label} {cat.name!r} fraction "
                f"{cat.fraction} out of range 0..1"
            )
        total += cat.fraction
    if total > 1.0:
        raise ValidationError(
            f"team {team.name!r}: {label} sum to {total:.2f}, which exceeds 100%"
        )


def validate_org(org: Org) -> None:
    team_ids = {t.id for t in org.teams}

    for t in org.teams:
        if t.productive_weeks < 0:
            raise ValidationError(
                f"team {t.name!r}: productive_weeks must be >= 0, got {t.productive_weeks}"
            )
        _validate_category_list(t, "reservation", t.reservations)
        _validate_category_list(t, "ideal reservation", t.ideal_reservations)

    for e in org.engineers:
        for a in e.assignments:
            if a.team_id not in team_ids:
                raise ValidationError(
                    f"engineer {e.name!r}: assigned to unknown team {a.team_id!r}"
                )
            if not (0.0 <= a.availability <= 1.0):
                raise ValidationError(
                    f"engineer {e.name!r}: availability {a.availability} on "
                    f"team {a.team_id!r} out of range 0..1"
                )
