"""Holds the active Org for the server process."""
from capacity_engine.models import Org


class OrgStore:
    def __init__(self, org: Org | None = None):
        self._org = org if org is not None else Org()

    def get(self) -> Org:
        return self._org

    def set(self, org: Org) -> None:
        self._org = org
