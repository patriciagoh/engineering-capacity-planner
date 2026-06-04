import type { RowStore } from "./types";

// In-memory RowStore for tests. Optionally seeded with an initial row.
export class FakeRowStore implements RowStore {
  private row: unknown | null;
  constructor(row: unknown | null = null) {
    this.row = row;
  }
  async getRow(): Promise<unknown | null> {
    return this.row;
  }
  async putRow(data: unknown): Promise<void> {
    this.row = data;
  }
  peek(): unknown | null {
    return this.row;
  }
}
