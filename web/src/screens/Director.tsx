import { useState } from "react";
import { rollup, teamFit, fit, engEff } from "../engine/selectors";
import type { FitStatus } from "../engine/selectors";
import { useStore } from "../state/store";
import { FitBar } from "../components/FitBar";
import { Icon } from "../components/Icon";

const fmt = (n: number, d = 1) => Number(n.toFixed(d)).toString();
const sign = (v: number) => (v >= 0 ? "+" : "") + fmt(v);

function statusFill(status: FitStatus): string {
  if (status === "ok") return "var(--good-fill)";
  if (status === "tight") return "var(--reserved-fill)";
  return "var(--over-fill)";
}

export function Director() {
  const { state, dispatch } = useStore();
  const [selectedTile, setSelectedTile] = useState<number | null>(null);

  // Move engineer local state
  const [mvFrom, setMvFrom] = useState(0);
  const [mvWho, setMvWho] = useState(0);
  const [mvTo, setMvTo] = useState(state.cur === 0 ? 1 : 0);

  // Before-state fit snapshot for before/after display
  const [beforeFit, setBeforeFit] = useState<{ fromFit: number; toFit: number; fromName: string; toName: string; whoName: string } | null>(null);

  const { teams: teamFits, groupNet } = rollup(state.teams);
  const groupNetPositive = groupNet >= 0;

  const fromRoster = state.teams[mvFrom]?.roster ?? [];

  function handleMove() {
    if (mvFrom === mvTo) return;
    const fromTeam = state.teams[mvFrom];
    const toTeam = state.teams[mvTo];
    if (!fromTeam || !toTeam) return;
    const person = fromTeam.roster[mvWho];
    if (!person) return;

    // Capture before fits
    const fromFitBefore = fit(fromTeam);
    const toFitBefore = fit(toTeam);

    dispatch({ type: "MOVE_ENGINEER", from: mvFrom, index: mvWho, to: mvTo });

    setBeforeFit({
      fromFit: fromFitBefore,
      toFit: toFitBefore,
      fromName: fromTeam.name,
      toName: toTeam.name,
      whoName: person.name,
    });

    // Reset who select (roster will be shorter)
    setMvWho(0);
  }

  // After move, read current fits for display
  const afterFromFit = beforeFit ? fit(state.teams[mvFrom]) : null;
  const afterToFit = beforeFit ? fit(state.teams[mvTo]) : null;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mb-6">
        <div className="font-mono text-[11px] font-bold tracking-[.16em] uppercase text-matcha-deep">Director · Platform group</div>
        <h2 className="font-serif font-normal text-[30px] tracking-tight mt-2 mb-0">Every team&apos;s fit at a glance</h2>
        <p className="mt-2 text-sm text-ink-2 leading-relaxed max-w-[64ch]">
          Supply vs demand for each team you own — green has slack, amber is tight, red is over.{" "}
          Group net{" "}
          <strong
            className="font-mono font-bold"
            style={{ color: groupNetPositive ? "var(--good-fill)" : "var(--over-fill)" }}
          >
            {sign(groupNet)} pm
          </strong>{" "}
          across {state.teams.length} teams.
        </p>
      </div>

      {/* Tile grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {teamFits.map((tf, i) => {
          const isOpen = i === state.cur;
          const isSel = selectedTile === i;
          const over = tf.status === "over";
          return (
            <button
              key={tf.name}
              aria-label={`${tf.name}${isOpen ? " open" : ""}`}
              aria-pressed={isSel}
              onClick={() => setSelectedTile(isSel ? null : i)}
              className={`text-left bg-paper border rounded-xl p-4 shadow-[var(--shadow-hairline)] transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-matcha ${
                over ? "border-[color:var(--bad-border)]" : "border-line"
              } ${isSel ? "outline-2 outline outline-matcha outline-offset-1" : ""}`}
            >
              {/* Team name row */}
              <div className="flex items-center gap-2 text-sm font-bold">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: statusFill(tf.status) }}
                  aria-hidden
                />
                {tf.name}
                {isOpen && (
                  <span className="font-mono text-[8px] font-bold tracking-[.08em] uppercase text-matcha-deep bg-matcha-tint border border-matcha-tint-border rounded-full px-1.5 py-0.5 ml-1">
                    open
                  </span>
                )}
              </div>

              {/* FitBar */}
              <div className="mt-3 mb-2">
                <FitBar supply={tf.supply} demand={tf.demand} />
              </div>

              {/* Supply / demand row */}
              <div className="flex justify-between text-[11.5px] text-muted">
                <span>supply {fmt(tf.supply)}</span>
                <span>demand {fmt(tf.demand)}</span>
              </div>

              {/* Signed fit */}
              <div
                className="font-mono font-bold text-base mt-2"
                style={{ color: over ? "var(--over-fill)" : "var(--good-fill)" }}
              >
                {sign(tf.fit)} pm
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedTile !== null && (() => {
        const team = state.teams[selectedTile];
        const tf = teamFit(team);
        const over = tf.fit < 0;
        const isOpen = selectedTile === state.cur;
        return (
          <div className="mt-4 bg-paper border border-line rounded-xl p-5 shadow-[var(--shadow-hairline)]">
            <div className="flex justify-between items-baseline">
              <span className="text-[15px] font-bold">
                {team.name}{isOpen ? " · open" : ""}
              </span>
              <span
                className="font-mono font-bold text-base"
                style={{ color: over ? "var(--over-fill)" : "var(--good-fill)" }}
              >
                {sign(tf.fit)} pm
              </span>
            </div>
            <div className="flex gap-4 text-xs text-muted mt-1.5 mb-4">
              <span>supply {fmt(tf.supply)}</span>
              <span>demand {fmt(tf.demand)}</span>
              <span>{team.roster.length} people</span>
            </div>

            {/* Roster list */}
            <div className="flex flex-col gap-1.5 mb-1">
              {team.roster.map((eng, i) => (
                <div key={i} className="flex justify-between text-sm text-ink-2 border-b border-line pb-1.5 last:border-0">
                  <span>{eng.name}</span>
                  <span className="font-mono font-bold">{eng.level} · {fmt(engEff(eng), 2)} FTE</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => dispatch({ type: "OPEN_TEAM", team: selectedTile })}
              className="mt-4 font-sans text-sm font-bold text-paper bg-matcha-deep border-0 rounded-lg px-4 py-2 cursor-pointer hover:bg-matcha transition-colors"
            >
              Open {team.name} in Manager view →
            </button>
          </div>
        );
      })()}

      {/* Move engineer + Why this matters panels */}
      <div className="grid md:grid-cols-[1.3fr_1fr] gap-4 mt-6">
        {/* Move engineer panel */}
        <div className="bg-paper border border-line rounded-xl p-5">
          <h3 className="text-[15px] font-bold m-0 mb-4">Move an engineer, see both sides</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* From team */}
            <select
              aria-label="Move from team"
              value={mvFrom}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setMvFrom(idx);
                setMvWho(0);
                setBeforeFit(null);
              }}
              className="flex-1 min-w-[104px] font-sans text-xs text-ink bg-paper border border-line-2 rounded-lg px-2 py-2"
            >
              {state.teams.map((t, i) => (
                <option key={i} value={i}>{t.name}</option>
              ))}
            </select>

            {/* Engineer select */}
            <select
              aria-label="Engineer to move"
              value={mvWho}
              onChange={(e) => { setMvWho(Number(e.target.value)); setBeforeFit(null); }}
              className="flex-1 min-w-[104px] font-sans text-xs text-ink bg-paper border border-line-2 rounded-lg px-2 py-2"
            >
              {fromRoster.map((eng, i) => (
                <option key={i} value={i}>{eng.name}</option>
              ))}
            </select>

            <span className="font-mono font-bold" style={{ color: "var(--good-fill)" }}>
              <Icon name="arrow" size={16} />
            </span>

            {/* To team */}
            <select
              aria-label="Move to team"
              value={mvTo}
              onChange={(e) => { setMvTo(Number(e.target.value)); setBeforeFit(null); }}
              className="flex-1 min-w-[104px] font-sans text-xs text-ink bg-paper border border-line-2 rounded-lg px-2 py-2"
            >
              {state.teams.map((t, i) => (
                <option key={i} value={i}>{t.name}</option>
              ))}
            </select>

            <button
              onClick={handleMove}
              disabled={mvFrom === mvTo || fromRoster.length === 0}
              className="font-sans text-sm font-bold text-paper bg-matcha-deep border-0 rounded-lg px-4 py-2 cursor-pointer hover:bg-matcha transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Move
            </button>
          </div>

          {/* Before / after fit display */}
          {beforeFit && afterFromFit !== null && afterToFit !== null && (
            <div className="flex gap-3 mt-4">
              <div className="flex-1 border border-line-2 rounded-lg p-3">
                <div className="text-xs font-bold">{beforeFit.fromName} · − {beforeFit.whoName.split(" ")[0]}</div>
                <div className="font-mono text-[15px] font-bold mt-1.5" style={{ color: "var(--good-fill)" }}>
                  {sign(beforeFit.fromFit)} → {sign(afterFromFit)} pm
                </div>
              </div>
              <div className="flex-1 border border-matcha-tint-border rounded-lg p-3 bg-matcha-tint">
                <div className="text-xs font-bold">{beforeFit.toName} · + {beforeFit.whoName.split(" ")[0]}</div>
                <div className="font-mono text-[15px] font-bold mt-1.5" style={{ color: "var(--good-fill)" }}>
                  {sign(beforeFit.toFit)} → {sign(afterToFit)} pm
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Why this matters panel */}
        <div className="bg-matcha-tint border border-matcha-tint-border rounded-xl p-5">
          <h3 className="text-[15px] font-bold m-0 mb-3">Why this matters</h3>
          <p className="m-0 text-sm text-ink-2 leading-relaxed">
            Reallocation is the lever a director actually pulls. Loaning from a team with slack to one in the red shows the cost on <strong>both</strong> sides — and never double-counts the engineer.
          </p>
        </div>
      </div>
    </div>
  );
}
