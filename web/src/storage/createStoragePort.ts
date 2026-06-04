import type { StoragePort } from "./types";
import { LocalPort } from "./localPort";

export function createStoragePort(): StoragePort {
  if (import.meta.env.VITE_BACKEND === "supabase") {
    // Dynamic import keeps the Supabase SDK out of the local/demo bundle.
    return makeDeferredSupabasePort();
  }
  return new LocalPort();
}

function makeDeferredSupabasePort(): StoragePort {
  let portP: Promise<StoragePort> | null = null;
  const get = () => (portP ??= import("./supabasePort").then((m) => m.createSupabasePort()));
  return {
    load: () => get().then((p) => p.load()),
    save: (s) => get().then((p) => p.save(s)),
  };
}
