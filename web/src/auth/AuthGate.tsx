import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthPort, AuthSession } from "./types";
import { AuthProvider } from "./AuthContext";
import { Login } from "../screens/Login";
import { Loading } from "../components/Loading";

type Status = "checking" | "unauthenticated" | "authenticated";

export function AuthGate({ port, children }: { port: AuthPort; children: ReactNode }) {
  const portRef = useRef<AuthPort | null>(null);
  if (portRef.current === null) portRef.current = port;
  const [status, setStatus] = useState<Status>("checking");
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const p = portRef.current!;
    let cancelled = false;
    let settledByEvent = false;
    const apply = (s: AuthSession | null, fromEvent: boolean) => {
      if (cancelled) return;
      // onAuthChange is authoritative: once an event has spoken, a late initial
      // getSession seed must not clobber the newer state.
      if (!fromEvent && settledByEvent) return;
      if (fromEvent) settledByEvent = true;
      setSession(s);
      setStatus(s ? "authenticated" : "unauthenticated");
    };
    const unsub = p.onAuthChange((s) => apply(s, true));
    p.getSession()
      .then((s) => apply(s, false))
      .catch(() => { if (!cancelled && !settledByEvent) setStatus("unauthenticated"); });
    return () => { cancelled = true; unsub(); };
  }, []);

  // Render-time consumers use the `port` prop directly; portRef (captured once,
  // never reassigned) is dereferenced only inside the effect — matching how
  // Phase 1's StoreProvider touches its ref only in effects, satisfying
  // react-hooks/refs (no ref access during render). Safe because the port prop
  // is stable for the gate's lifetime (App mounts the gate once); a changing
  // port would not re-subscribe.
  if (status === "checking") return <Loading />;
  // !session also narrows session to non-null for AuthProvider below; an authenticated status always implies a session.
  if (status === "unauthenticated" || !session) return <Login port={port} />;
  return (
    <AuthProvider value={{ session, signOut: () => { void port.signOut(); } }}>
      {children}
    </AuthProvider>
  );
}
