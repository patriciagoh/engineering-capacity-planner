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
    const apply = (s: AuthSession | null) => {
      if (cancelled) return;
      setSession(s);
      setStatus(s ? "authenticated" : "unauthenticated");
    };
    // onAuthChange is authoritative; getSession seeds the initial state.
    const unsub = p.onAuthChange(apply);
    p.getSession().then(apply).catch(() => { if (!cancelled) setStatus("unauthenticated"); });
    return () => { cancelled = true; unsub(); };
  }, []);

  // Render-time consumers use the `port` prop directly; portRef (captured once,
  // never reassigned) is dereferenced only inside the effect — matching how
  // Phase 1's StoreProvider touches its ref only in effects, satisfying
  // react-hooks/refs (no ref access during render).
  if (status === "checking") return <Loading />;
  if (status === "unauthenticated" || !session) return <Login port={port} />;
  return (
    <AuthProvider value={{ session, signOut: () => { void port.signOut(); } }}>
      {children}
    </AuthProvider>
  );
}
