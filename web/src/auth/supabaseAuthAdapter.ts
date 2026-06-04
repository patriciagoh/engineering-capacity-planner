import type { AuthPort, AuthSession } from "./types";
import { getClient } from "../storage/client";

type RawUser = { id: string; email?: string | null } | undefined;
type RawSession = { user?: RawUser } | null;

function toSession(s: RawSession): AuthSession | null {
  if (!s?.user) return null;
  return { userId: s.user.id, email: s.user.email ?? null };
}

// Thin network binding over supabase.auth. Logic lives in AuthGate/AuthPort;
// this is not unit-tested (same convention as SupabaseRowStore).
class SupabaseAuthAdapter implements AuthPort {
  async getSession(): Promise<AuthSession | null> {
    const c = await getClient();
    const { data } = await c.auth.getSession();
    return toSession(data.session as RawSession);
  }
  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const c = await getClient();
    const { error } = await c.auth.signInWithPassword({ email, password });
    return { error: error ? "Invalid email or password" : null };
  }
  async signOut(): Promise<void> {
    const c = await getClient();
    await c.auth.signOut();
  }
  onAuthChange(cb: (s: AuthSession | null) => void): () => void {
    let unsub = () => {};
    let cancelled = false;
    getClient()
      .then((c) => {
        if (cancelled) return;
        const { data } = c.auth.onAuthStateChange((_event, session) => cb(toSession(session as RawSession)));
        unsub = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        // Env/SDK-load failure: can't subscribe. The AuthGate's getSession path
        // surfaces the unauthenticated state; avoid an unhandled rejection here.
      });
    return () => {
      cancelled = true;
      unsub();
    };
  }
}

export function createSupabaseAuthPort(): AuthPort {
  return new SupabaseAuthAdapter();
}
