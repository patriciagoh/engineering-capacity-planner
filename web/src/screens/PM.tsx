import { useState } from "react";
import { pmVerdict, fit } from "../engine/selectors";
import { useStore } from "../state/store";

const fmt = (n: number, d = 1) => Number(n.toFixed(d)).toString();

export function PM() {
  const { state } = useStore();

  const [projectName, setProjectName] = useState("Fraud rules");
  const [estRaw, setEstRaw] = useState("1.0");
  const [teamIdx, setTeamIdx] = useState(state.cur);

  const est = Math.max(0, parseFloat(estRaw) || 0);
  const team = state.teams[teamIdx] ?? state.teams[state.cur];
  const verdict = pmVerdict(team, est);
  const spare = fit(team);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-xs text-muted uppercase tracking-wide mb-1">PM · demand-first</div>
        <h2 className="font-serif text-2xl text-ink mb-2">Will my project land this quarter?</h2>
        <p className="text-sm text-ink-2">
          You don&apos;t build the roster — just ask. Enter the project and pick the team; you&apos;ll get a straight answer, and if it doesn&apos;t fit, what it would take.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-[340px_1fr] items-start">
        {/* Left card: inputs */}
        <div className="bg-paper border border-line rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="pm-name" className="text-sm text-ink-2 font-medium">
              Project
            </label>
            <input
              id="pm-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-oat border border-line rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-matcha"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="pm-est" className="text-sm text-ink-2 font-medium">
              Estimate · person-months
            </label>
            <input
              id="pm-est"
              type="number"
              step="0.1"
              min="0"
              value={estRaw}
              onChange={(e) => setEstRaw(e.target.value)}
              className="bg-oat border border-line rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-matcha"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="pm-team" className="text-sm text-ink-2 font-medium">
              Which team?
            </label>
            <select
              id="pm-team"
              value={teamIdx}
              onChange={(e) => setTeamIdx(Number(e.target.value))}
              className="bg-oat border border-line rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-matcha"
            >
              {state.teams.map((t, i) => (
                <option key={t.name} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right card: live verdict */}
        <div className="bg-paper border border-line rounded-xl p-5">
          {verdict.lands ? (
            <>
              <div className="font-serif text-2xl leading-snug text-matcha-deep mb-3">
                Yes — &ldquo;{projectName}&rdquo; lands on {team.name}.
              </div>
              <p className="text-sm text-ink-2 leading-relaxed">
                {team.name} has <strong>{spare >= 0 ? "+" : ""}{fmt(spare)} pm</strong> spare and this needs{" "}
                <strong>{fmt(est)}</strong>. You&apos;d have{" "}
                <strong>{fmt(verdict.leftover)} pm</strong> left over.
              </p>
            </>
          ) : (
            <>
              <div className="font-serif text-2xl leading-snug text-bad mb-3">
                Not as-is — short by {fmt(verdict.gap)} pm on {team.name}.
              </div>
              <p className="text-xs text-muted mb-2">It lands if you:</p>
              <ul className="flex flex-col gap-2">
                <li className="flex gap-2 items-start text-sm text-ink-2 leading-relaxed">
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "var(--yolk)" }}
                    aria-hidden
                  />
                  Free <strong className="whitespace-nowrap ml-1 mr-1">~{fmt(verdict.gap)} pm</strong>{" "}
                  by trimming KTLO / reserved work on {team.name}
                </li>
                <li className="flex gap-2 items-start text-sm text-ink-2 leading-relaxed">
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "var(--yolk)" }}
                    aria-hidden
                  />
                  Push another project (~{fmt(verdict.gap)} pm) to next quarter
                </li>
                <li className="flex gap-2 items-start text-sm text-ink-2 leading-relaxed">
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "var(--yolk)" }}
                    aria-hidden
                  />
                  Loan an engineer (~{fmt(verdict.gap)} pm) from a team with slack — see the Director view
                </li>
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
