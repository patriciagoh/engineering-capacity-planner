import type { StoragePort, RowStore, PersistedState } from "./types";
import { sanitize, serialize } from "./sanitize";
import { getClient } from "./client";

export class SupabasePort implements StoragePort {
  private rows: RowStore;
  constructor(rows: RowStore) {
    this.rows = rows;
  }
  async load(): Promise<PersistedState | null> {
    return sanitize(await this.rows.getRow());
  }
  async save(state: PersistedState): Promise<void> {
    await this.rows.putRow(serialize(state));
  }
}

// Thin network binding. Logic lives in SupabasePort/sanitize (tested via FakeRowStore).
class SupabaseRowStore implements RowStore {
  async getRow(): Promise<unknown | null> {
    const c = await getClient();
    const { data: auth } = await c.auth.getUser();
    if (!auth.user) return null; // no session yet (login arrives in Phase 2)
    const { data, error } = await c.from("app_data").select("data").eq("owner", auth.user.id).maybeSingle();
    if (error) throw error;
    return (data as { data?: unknown } | null)?.data ?? null;
  }
  async putRow(data: unknown): Promise<void> {
    const c = await getClient();
    const { data: auth } = await c.auth.getUser();
    if (!auth.user) throw new Error("Not authenticated");
    const { error } = await c.from("app_data").upsert({ owner: auth.user.id, data, updated_at: new Date().toISOString() }, { onConflict: "owner" });
    if (error) throw error;
  }
}

export function createSupabasePort(): StoragePort {
  return new SupabasePort(new SupabaseRowStore());
}
