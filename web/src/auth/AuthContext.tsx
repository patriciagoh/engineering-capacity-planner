/* eslint-disable react-refresh/only-export-components --
   Co-locates the context, provider, and hook; the rule only concerns HMR. */
import { createContext, useContext, type ReactNode } from "react";
import type { AuthSession } from "./types";

export interface AuthContextValue {
  session: AuthSession;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Returns null when rendered outside an AuthProvider (the demo build) — callers
// treat null as "no auth", so it deliberately does NOT throw.
export function useAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
