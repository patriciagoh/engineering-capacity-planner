import { useStore, type View } from "../state/store";

const VIEWS: { value: View; label: string; tag: string }[] = [
  { value: "manager", label: "EM Manager", tag: "one team" },
  { value: "director", label: "VP Director", tag: "across teams" },
  { value: "pm", label: "PM", tag: "will it land?" },
];

export function ViewSwitcher() {
  const { state, dispatch } = useStore();
  return (
    <div className="flex gap-2 ecp-no-print" role="group" aria-label="Choose a view">
      {VIEWS.map((v) => {
        const on = state.view === v.value;
        return (
          <button
            key={v.value}
            onClick={() => dispatch({ type: "SET_VIEW", view: v.value })}
            className={`rounded-pill px-4 py-1.5 text-sm transition-colors ${on ? "bg-ink text-paper" : "bg-paper text-ink-2 border border-line"}`}
          >
            {v.label} <span className="font-mono text-xs opacity-70">· {v.tag}</span>
          </button>
        );
      })}
    </div>
  );
}
