import { useStore } from "../state/store";
import { useAuth } from "../auth/AuthContext";
import { SegmentedToggle } from "./SegmentedToggle";
import { ExportMenu } from "./ExportMenu";
import { ViewSwitcher } from "./ViewSwitcher";
import type { Window } from "../engine/types";

export function TopBar() {
  const { state, dispatch } = useStore();
  const auth = useAuth();
  const team = state.teams[state.cur];
  return (
    <header className="sticky top-0 z-10 bg-oat/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-[1180px] px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <div className="font-serif text-2xl text-ink">{team.name}</div>
          <div className="font-mono text-xs text-muted">sample data · Q3 capacity</div>
        </div>
        <SegmentedToggle
          ariaLabel="Planning window"
          options={[{ value: "month", label: "Monthly" }, { value: "quarter", label: "Quarterly" }]}
          value={team.window}
          onChange={(w: Window) => dispatch({ type: "SET_WINDOW", team: state.cur, window: w })}
        />
        <div className="flex items-center gap-3">
          {state.saveError && (
            <span role="status" className="text-xs text-muted">Couldn’t save — retrying on next edit</span>
          )}
          {auth && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{auth.session.email}</span>
              <button onClick={auth.signOut} className="text-xs text-ink underline">Sign out</button>
            </div>
          )}
          <ExportMenu />
        </div>
      </div>
      <div className="mx-auto max-w-[1180px] px-6 pb-3"><ViewSwitcher /></div>
    </header>
  );
}
