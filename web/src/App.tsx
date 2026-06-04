import { useMemo } from "react";
import { StoreProvider, useStore } from "./state/store";
import { createAuthPort } from "./auth/createAuthPort";
import { AuthGate } from "./auth/AuthGate";
import { TopBar } from "./components/TopBar";
import { Manager } from "./screens/Manager";
import { Director } from "./screens/Director";
import { PM } from "./screens/PM";
import { Loading } from "./components/Loading";
import { LoadError } from "./components/LoadError";
import { EmptyState } from "./components/EmptyState";

function ActiveView() {
  const { state } = useStore();
  if (state.view === "director") return <Director />;
  if (state.view === "pm") return <PM />;
  return <Manager />;
}

export function Shell() {
  const { state } = useStore();
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <LoadError onRetry={() => location.reload()} />;
  if (state.teams.length === 0) return <EmptyState />;
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <ActiveView />
      </main>
    </>
  );
}

export function App() {
  // Created once; null in the local/demo build (no auth), a deferred port in the supabase build.
  const authPort = useMemo(() => createAuthPort(), []);
  const dataApp = (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
  return authPort ? <AuthGate port={authPort}>{dataApp}</AuthGate> : dataApp;
}
