export type AuthSession = { userId: string; email: string | null };

export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  // Subscribe to auth changes; returns an unsubscribe function.
  onAuthChange(cb: (session: AuthSession | null) => void): () => void;
}
