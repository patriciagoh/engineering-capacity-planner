import { StoreProvider, useStore } from "./state/store";
import { TopBar } from "./components/TopBar";
import { Manager } from "./screens/Manager";
import { Director } from "./screens/Director";
import { PM } from "./screens/PM";

function ActiveView() {
  const { state } = useStore();
  if (state.view === "director") return <Director />;
  if (state.view === "pm") return <PM />;
  return <Manager />;
}

export function App() {
  return (
    <StoreProvider>
      <TopBar />
      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <ActiveView />
      </main>
    </StoreProvider>
  );
}
