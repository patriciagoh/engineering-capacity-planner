import type { AuthPort, AuthSession } from "./types";

// In-memory AuthPort for tests. Configure `failWith` to make signIn fail.
export class FakeAuthPort implements AuthPort {
  private session: AuthSession | null;
  private listeners = new Set<(s: AuthSession | null) => void>();
  failWith: string | null = null;

  constructor(initial: AuthSession | null = null) {
    this.session = initial;
  }
  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }
  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    void password;
    if (this.failWith) return { error: this.failWith };
    this.session = { userId: "user-1", email };
    this.emit();
    return { error: null };
  }
  async signOut(): Promise<void> {
    this.session = null;
    this.emit();
  }
  onAuthChange(cb: (s: AuthSession | null) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  // test-only: simulate an external auth change (expiry / other tab)
  push(session: AuthSession | null): void {
    this.session = session;
    this.emit();
  }
  private emit(): void {
    this.listeners.forEach((l) => l(this.session));
  }
}
