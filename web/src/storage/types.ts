import type { Team } from "../engine/types";

export type PersistedState = { cur: number; teams: Team[] };

export interface StoragePort {
  load(): Promise<PersistedState | null>; // null = brand-new user, no document yet
  save(state: PersistedState): Promise<void>;
}

export interface RowStore {
  getRow(): Promise<unknown | null>; // raw jsonb for the current user, or null
  putRow(data: unknown): Promise<void>;
}

export const DOC_VERSION = 1;
