"""Input validation. Errors are plain-language so UI/skill can surface them."""
from capacity_engine.demand import normalize_estimate
from capacity_engine.models import Org, OverheadCategory, Team

# Engineers may be loaned across teams, but their total availability cannot
# exceed one full person — otherwise roll-ups would double-count them (the
# anti-double-counting guarantee from the design). A small epsilon absorbs
# float accumulation (e.g. 0.2 + 0.3 + 0.5).
_AVAILABILITY_SUM_EPSILON = 1e-9


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

    group_ids = {g.id for g in org.groups}

    for t in org.teams:
        if t.group_id is not None and t.group_id not in group_ids:
            raise ValidationError(
                f"team {t.name!r}: group_id {t.group_id!r} refers to an unknown group"
            )

    for g in org.groups:
        if g.parent_id is not None and g.parent_id not in group_ids:
            raise ValidationError(
                f"group {g.name!r}: parent_id {g.parent_id!r} refers to an unknown parent"
            )

    # Detect cycles by walking parent links from each group.
    parent_of = {g.id: g.parent_id for g in org.groups}
    for start in parent_of:
        seen = set()
        cur = start
        while cur is not None:
            if cur in seen:
                raise ValidationError(
                    f"group hierarchy has a cycle involving {start!r}"
                )
            seen.add(cur)
            cur = parent_of.get(cur)

    engineer_ids = {e.id for e in org.engineers}

    for e in org.engineers:
        total_availability = 0.0
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
            total_availability += a.availability
        if total_availability > 1.0 + _AVAILABILITY_SUM_EPSILON:
            raise ValidationError(
                f"engineer {e.name!r}: total availability across teams is "
                f"{total_availability:.2f}, which exceeds 1.0 (would double-count "
                "them in roll-ups)"
            )

    for d in org.deliverables:
        for oid in d.owner_ids:
            if oid not in engineer_ids:
                raise ValidationError(
                    f"deliverable {d.title!r}: owner {oid!r} is not a known engineer"
                )
        # A malformed estimate (missing required fields for its fidelity) must be
        # caught here, not deferred to a later compute-time ValueError.
        try:
            normalize_estimate(d.estimate)
        except ValueError as exc:
            raise ValidationError(
                f"deliverable {d.title!r}: invalid estimate ({exc})"
            ) from exc
