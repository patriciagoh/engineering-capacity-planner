import type { StoragePort, PersistedState } from "./types";
import { makeSeedTeams, CUR } from "../data/seed";

// The public demo: seeded, ephemeral, login-free. Saves go nowhere.
export class LocalPort implements StoragePort {
  async load(): Promise<PersistedState> {
    return { cur: CUR, teams: makeSeedTeams() };
  }
  async save(state: PersistedState): Promise<void> {
    void state; // intentional no-op: the demo discards saves
  }
}
