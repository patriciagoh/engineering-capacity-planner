import type { AuthPort } from "./types";

export function createAuthPort(): AuthPort | null {
  if (import.meta.env.VITE_BACKEND !== "supabase") return null; // demo build: no auth
  return makeDeferredAuthPort();
}

// Dynamic-imports the adapter (and thus the SDK) only when first used, so the
// demo bundle ships no Supabase auth code.
function makeDeferredAuthPort(): AuthPort {
  let portP: Promise<AuthPort> | null = null;
  const get = () => (portP ??= import("./supabaseAuthAdapter").then((m) => m.createSupabaseAuthPort()));
  return {
    getSession: () => get().then((p) => p.getSession()),
    signIn: (email, password) => get().then((p) => p.signIn(email, password)),
    signOut: () => get().then((p) => p.signOut()),
    onAuthChange: (cb) => {
      let unsub = () => {};
      let cancelled = false;
      get()
        .then((p) => {
          if (!cancelled) unsub = p.onAuthChange(cb);
        })
        .catch(() => {
          /* import/env failure: no-op; gate's getSession path handles it */
        });
      return () => {
        cancelled = true;
        unsub();
      };
    },
  };
}
