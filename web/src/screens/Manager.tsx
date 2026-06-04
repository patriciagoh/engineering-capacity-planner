import type { Engineer, KtloFactor, Level, Onboarding, Tenure } from "../engine/types";
import type { Alloc } from "../engine/types";
import {
  effFTE,
  engEff,
  productive,
  grossPM,
  ktloFrac,
  netPM,
  demand,
  fit,
  headcount,
  personLoads,
} from "../engine/selectors";
import { LEVELS, ONBOARD, TENURE, ALLOCS } from "../engine/constants";
import { useStore } from "../state/store";
import { EditableField } from "../components/EditableField";
import { Slider } from "../components/Slider";
import { FitBar } from "../components/FitBar";
import { LoadBar } from "../components/LoadBar";
import { StatRow } from "../components/StatRow";
import { Pills } from "../components/Pills";
import { DarkPanel } from "../components/DarkPanel";
import { Tooltip } from "../components/Tooltip";
import { Icon } from "../components/Icon";

const fmt = (n: number, d = 1) => Number(n.toFixed(d)).toString();

const LEVEL_KEYS = Object.keys(LEVELS) as Level[];
const ONBOARD_KEYS = Object.keys(ONBOARD) as Onboarding[];

export function Manager() {
  const { state, dispatch } = useStore();
  const team = state.teams[state.cur];
  const ti = state.cur;

  const eff = effFTE(team.roster);
  const prod = productive(team.overhead);
  const gross = grossPM(team);
  const ktloF = ktloFrac(team.ktlo);
  const net = netPM(team);
  const dem = demand(team);
  const fitVal = fit(team);
  const heads = headcount(team.roster);
  const loads = personLoads(team);

  const overheadTotal = team.overhead.reduce((s, f) => s + f.current, 0);
  const ktloTotal = team.ktlo.reduce((s, f) => s + f.current, 0);
  const idealKtlo = team.ktlo.reduce((s, f) => s + f.ideal, 0);
  const overPts = ktloTotal - idealKtlo;

  const remain = fitVal;

  // Free/reserved bar widths
  const totalPM = gross;
  const reservedPM = gross * ktloF;
  const freePM = net;
  const freePct = totalPM > 0 ? Math.round((freePM / totalPM) * 100) : 0;
  const resPct = totalPM > 0 ? Math.round((reservedPM / totalPM) * 100) : 0;

  return (
    <div className="grid grid-cols-[1fr_392px] items-start">
      {/* ===== INPUTS ===== */}
      <div className="pr-6 pb-20 flex flex-col gap-5 min-w-0">

        {/* Card 1: Team roster */}
        <section className="bg-paper border border-line rounded-xl overflow-hidden shadow-[var(--shadow-hairline)]">
          <header className="px-5 py-4 border-b border-line">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9.5px] font-bold tracking-[.14em] uppercase text-matcha-deep">1 · Supply</span>
              <h3 className="text-base font-bold tracking-tight m-0">Team roster</h3>
            </div>
            <p className="mt-2 text-xs text-muted leading-relaxed max-w-[62ch]">
              Each person&apos;s <strong>level</strong> and <strong>onboarding stage</strong> decide how much of a &ldquo;full&rdquo; engineer they count as right now — a ramping new hire delivers less than a settled senior. Multiply them to get <strong>effective FTE</strong>.
            </p>
          </header>
          <div className="px-5 pt-2 pb-5">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-left px-2 py-3 border-b border-line-2 whitespace-nowrap">Engineer</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-left px-2 py-3 border-b border-line-2 whitespace-nowrap">Tenure</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-left px-2 py-3 border-b border-line-2 whitespace-nowrap">Level</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-right px-2 py-3 border-b border-line-2 whitespace-nowrap">lvl ×</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-left px-2 py-3 border-b border-line-2 whitespace-nowrap">Onboarding role</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-right px-2 py-3 border-b border-line-2 whitespace-nowrap">onb ×</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-right px-2 py-3 border-b border-line-2 whitespace-nowrap">Alloc</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-right px-2 py-3 border-b border-line-2 whitespace-nowrap">Eff. FTE</th>
                  <th className="px-2 py-3 border-b border-line-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {team.roster.map((eng: Engineer, i: number) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-2 py-2 align-middle">
                      <EditableField
                        value={eng.name}
                        onCommit={(v) => dispatch({ type: "EDIT_ENGINEER", team: ti, index: i, field: "name", value: v })}
                        ariaLabel={`Engineer name ${i + 1}`}
                        className="text-sm font-semibold w-32"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <select
                        aria-label={`Tenure ${i + 1}`}
                        value={eng.tenure}
                        onChange={(e) => dispatch({ type: "EDIT_ENGINEER", team: ti, index: i, field: "tenure", value: e.target.value as Tenure })}
                        className="text-xs border border-line-2 rounded-lg px-2 py-1.5 bg-paper text-ink"
                      >
                        {TENURE.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <select
                        aria-label={`Level ${i + 1}`}
                        value={eng.level}
                        onChange={(e) => dispatch({ type: "EDIT_ENGINEER", team: ti, index: i, field: "level", value: e.target.value as Level })}
                        className="text-xs border border-line-2 rounded-lg px-2 py-1.5 bg-paper text-ink"
                      >
                        {LEVEL_KEYS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-middle text-right">
                      <span className="font-mono text-[11px] text-muted">{LEVELS[eng.level].toFixed(2)}</span>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <select
                        aria-label={`Onboarding ${i + 1}`}
                        value={eng.onboarding}
                        onChange={(e) => dispatch({ type: "EDIT_ENGINEER", team: ti, index: i, field: "onboarding", value: e.target.value as Onboarding })}
                        className="text-xs border border-line-2 rounded-lg px-2 py-1.5 bg-paper text-ink"
                      >
                        {ONBOARD_KEYS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-middle text-right">
                      <span className="font-mono text-[11px] text-muted">{ONBOARD[eng.onboarding].toFixed(2)}</span>
                    </td>
                    <td className="px-2 py-2 align-middle text-right">
                      <select
                        aria-label={`Allocation ${i + 1}`}
                        value={eng.alloc}
                        onChange={(e) => dispatch({ type: "EDIT_ENGINEER", team: ti, index: i, field: "alloc", value: Number(e.target.value) as Alloc })}
                        className="text-xs border border-line-2 rounded-lg px-2 py-1.5 bg-paper text-ink"
                      >
                        {ALLOCS.map((a) => <option key={a} value={a}>{a === 1 ? "Full" : `${a * 100}%`}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-middle text-right">
                      <span className="font-mono text-sm font-bold text-matcha-deep">{fmt(engEff(eng), 2)}</span>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <button
                        aria-label={`Remove engineer ${i + 1}`}
                        onClick={() => dispatch({ type: "REMOVE_ENGINEER", team: ti, index: i })}
                        className="text-muted hover:text-bad hover:bg-bad-tint rounded-md p-1 transition-colors"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              aria-label="Add engineer"
              onClick={() => dispatch({ type: "ADD_ENGINEER", team: ti })}
              className="mt-3 flex items-center gap-2 text-xs font-semibold text-matcha-deep bg-matcha-tint border border-dashed border-matcha-tint-border rounded-lg px-3 py-2 cursor-pointer hover:bg-[color:var(--addrow-hover)] transition-colors"
            >
              <Icon name="plus" size={14} />
              + Add engineer
            </button>
          </div>
        </section>

        {/* Card 2: Where the week goes */}
        <section className="bg-paper border border-line rounded-xl overflow-hidden shadow-[var(--shadow-hairline)]">
          <header className="px-5 py-4 border-b border-line">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9.5px] font-bold tracking-[.14em] uppercase text-matcha-deep">2 · Per-engineer baseline</span>
              <h3 className="text-base font-bold tracking-tight m-0">Where the week goes</h3>
            </div>
            <p className="mt-2 text-xs text-muted leading-relaxed max-w-[62ch]">
              The slice of a normal week that never reaches project work — meetings, code review, time off. We count <strong>each overhead once</strong>. Drag toward your team&apos;s <strong>ideal</strong> to see capacity free up.
            </p>
          </header>
          <div className="px-5 pt-2 pb-5">
            {team.overhead.map((factor, i) => (
              <div key={factor.key} className="grid grid-cols-[1fr_176px_104px] gap-4 items-center py-3 border-b border-line last:border-0">
                <div>
                  <strong className="block text-[13px] font-semibold">{factor.key}</strong>
                  <span className="text-[11px] text-muted leading-tight">{factor.desc}</span>
                </div>
                <Slider
                  value={factor.current}
                  max={30}
                  ariaLabel={`${factor.key} overhead`}
                  onChange={(v) => dispatch({ type: "SET_OVERHEAD", team: ti, index: i, current: v })}
                />
                <div className="flex items-baseline justify-end gap-2">
                  <span className="font-mono text-sm font-bold">{factor.current}%</span>
                  <span className={`font-mono text-[10px] ${factor.current > factor.ideal ? "text-bad" : "text-muted"}`}>
                    ideal:&nbsp;
                    <EditableField
                      value={String(factor.ideal)}
                      onCommit={(v) => dispatch({ type: "SET_OVERHEAD_IDEAL", team: ti, index: i, ideal: Math.max(0, parseInt(v) || 0) })}
                      ariaLabel={`${factor.key} ideal overhead`}
                      numeric
                      className="inline w-8 font-mono text-[10px]"
                    />
                    %
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between mt-2 px-4 py-3 bg-sunk rounded-lg">
              <span className="font-mono text-[9.5px] font-bold tracking-[.1em] uppercase text-ink-2">Total overhead</span>
              <span className="font-mono text-sm font-bold">{overheadTotal}% → <strong>{fmt(prod * 100, 1)}% productive</strong></span>
            </div>
          </div>
        </section>

        {/* Card 3: KTLO & recurring work */}
        <section className="bg-paper border border-line rounded-xl overflow-hidden shadow-[var(--shadow-hairline)]">
          <header className="px-5 py-4 border-b border-line">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9.5px] font-bold tracking-[.14em] uppercase text-matcha-deep">3 · Team reservations</span>
              <h3 className="text-base font-bold tracking-tight m-0">KTLO &amp; recurring work</h3>
            </div>
            <p className="mt-2 text-xs text-muted leading-relaxed max-w-[62ch]">
              <Tooltip
                label={<strong>KTLO</strong>}
                definition='"Keep The Lights On" — recurring upkeep that happens no matter what projects are running.'
              />{" "}
              is work reserved <strong>before</strong> any project: support tickets, incidents, interviews, onboarding others. Whatever&apos;s left is real project capacity.
            </p>
          </header>
          <div className="px-5 pt-2 pb-5">
            {team.ktlo.map((factor: KtloFactor, i: number) => (
              <div key={factor.key} className="grid grid-cols-[1fr_176px_104px] gap-4 items-center py-3 border-b border-line last:border-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: `var(${factor.swatch})` }}
                    aria-hidden
                  />
                  <strong className="text-[13px] font-semibold">{factor.key}</strong>
                </div>
                <Slider
                  value={factor.current}
                  max={50}
                  ariaLabel={`${factor.key} reserved`}
                  onChange={(v) => dispatch({ type: "SET_KTLO", team: ti, index: i, current: v })}
                />
                <div className="flex items-baseline justify-end gap-2">
                  <span className="font-mono text-sm font-bold">{factor.current}%</span>
                  <span className={`font-mono text-[10px] ${factor.current > factor.ideal ? "text-bad" : "text-muted"}`}>
                    ideal:&nbsp;
                    <EditableField
                      value={String(factor.ideal)}
                      onCommit={(v) => dispatch({ type: "SET_KTLO_IDEAL", team: ti, index: i, ideal: Math.max(0, parseInt(v) || 0) })}
                      ariaLabel={`${factor.key} ideal reserved`}
                      numeric
                      className="inline w-8 font-mono text-[10px]"
                    />
                    %
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between mt-2 px-4 py-3 bg-sunk rounded-lg">
              <span className="font-mono text-[9.5px] font-bold tracking-[.1em] uppercase text-ink-2">Total reserved</span>
              <span className="font-mono text-sm font-bold">{ktloTotal}%</span>
            </div>
          </div>
        </section>

        {/* Card 4: Projects this quarter */}
        <section
          role="region"
          aria-label="Projects this quarter"
          className="bg-paper border border-line rounded-xl overflow-hidden shadow-[var(--shadow-hairline)]"
        >
          <header className="px-5 py-4 border-b border-line">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9.5px] font-bold tracking-[.14em] uppercase text-matcha-deep">4 · Demand</span>
              <h3 className="text-base font-bold tracking-tight m-0">Projects this quarter</h3>
            </div>
            <p className="mt-2 text-xs text-muted leading-relaxed max-w-[62ch]">
              Estimate each project in <strong>person-months</strong> and tap who&apos;s on it. Demand stacks against the net capacity above — the result panel shows what <strong>fits</strong> and what&apos;s <strong>over</strong>.
            </p>
          </header>
          <div className="px-5 pt-2 pb-5">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-left px-2 py-3 border-b border-line-2">Project</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-left px-2 py-3 border-b border-line-2">Assigned to</th>
                  <th className="font-mono text-[9px] font-bold tracking-[.1em] uppercase text-muted text-right px-2 py-3 border-b border-line-2">Estimate</th>
                  <th className="px-2 py-3 border-b border-line-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {team.projects.map((project, pi) => (
                  <tr key={pi} className="border-b border-line last:border-0">
                    <td className="px-2 py-2 align-middle">
                      <EditableField
                        value={project.name}
                        onCommit={(v) => dispatch({ type: "EDIT_PROJECT", team: ti, index: pi, field: "name", value: v })}
                        ariaLabel={`Project name ${pi + 1}`}
                        className="text-sm font-semibold w-40"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Pills
                        items={team.roster.map((e) => ({ id: e.id, label: e.name }))}
                        selected={project.team}
                        onToggle={(id) => dispatch({ type: "TOGGLE_ASSIGNMENT", team: ti, project: pi, member: id })}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle text-right">
                      <EditableField
                        value={String(project.est)}
                        onCommit={(v) => dispatch({ type: "EDIT_PROJECT", team: ti, index: pi, field: "est", value: parseFloat(v) || 0 })}
                        ariaLabel={`Estimate for project ${pi + 1}`}
                        numeric
                        className="font-mono text-sm font-bold text-matcha-deep w-16 text-right"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <button
                        aria-label={`Remove project ${pi + 1}`}
                        onClick={() => dispatch({ type: "REMOVE_PROJECT", team: ti, index: pi })}
                        className="text-muted hover:text-bad hover:bg-bad-tint rounded-md p-1 transition-colors"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-2 px-4 py-3 bg-sunk rounded-lg">
              <span className="font-mono text-[9.5px] font-bold tracking-[.1em] uppercase text-ink-2">Total demand</span>
              <span className="font-mono text-sm font-bold">{fmt(dem)} pm</span>
            </div>
            <button
              aria-label="Add project"
              onClick={() => dispatch({ type: "ADD_PROJECT", team: ti })}
              className="mt-3 flex items-center gap-2 text-xs font-semibold text-matcha-deep bg-matcha-tint border border-dashed border-matcha-tint-border rounded-lg px-3 py-2 cursor-pointer hover:bg-[color:var(--addrow-hover)] transition-colors"
            >
              <Icon name="plus" size={14} />
              + Add project
            </button>
          </div>
        </section>

        {/* Card 5: Who's quietly overloaded */}
        <section className="bg-paper border border-line rounded-xl overflow-hidden shadow-[var(--shadow-hairline)]">
          <header className="px-5 py-4 border-b border-line">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9.5px] font-bold tracking-[.14em] uppercase text-matcha-deep">Check · per person</span>
              <h3 className="text-base font-bold tracking-tight m-0">Who&apos;s quietly overloaded</h3>
            </div>
            <p className="mt-2 text-xs text-muted leading-relaxed max-w-[62ch]">
              The team total can fit while <strong>one person</strong> is buried. This spreads each project&apos;s estimate across whoever&apos;s assigned and compares it to that person&apos;s own capacity — over <strong>100%</strong> means overcommitted, even if the team &ldquo;fits.&rdquo;
            </p>
          </header>
          <div className="px-5 pt-2 pb-5">
            {loads.map((load) => (
              <LoadBar key={load.id} name={load.name} pct={load.pct} over={load.over} />
            ))}
            {loads.some((l) => l.over) && (
              <p className="mt-3 text-xs text-bad">
                One or more engineers are overcommitted. Consider reassigning projects or adding capacity.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ===== RESULTS RAIL ===== */}
      <aside className="ecp-rail sticky top-28 h-[calc(100vh-7rem)] overflow-auto border-l border-line bg-oat px-6 pb-12">
        <span className="font-mono text-[10px] font-bold tracking-[.14em] uppercase text-muted">Result · updates live</span>

        <DarkPanel className="mt-4">
          <div className="font-mono text-[9.5px] font-bold tracking-[.12em] uppercase text-yolk">Net capacity this quarter</div>
          <div className="font-mono text-[52px] font-bold leading-none mt-2 mb-0.5 tracking-tight text-white">{fmt(net)}</div>
          <div className="text-[13px]" style={{ color: "var(--hero-unit)" }}>person-months free for project work</div>
          <div className="mt-4 pt-4 border-t border-white/10 font-serif italic text-[17px] leading-snug" style={{ color: "var(--hero-verdict)" }}>
            That&apos;s about <strong className="not-italic font-medium text-white border-b-2 border-yolk">one engineer for {fmt(net)} months</strong> — what&apos;s truly free once everything else is paid for.
          </div>
        </DarkPanel>

        {/* Free vs reserved bar */}
        <div className="mt-5">
          <div className="flex justify-between mb-2">
            <span className="font-mono text-[9.5px] font-bold tracking-[.08em] uppercase text-muted">Free for projects</span>
            <span className="font-mono text-[9.5px] font-bold tracking-[.08em] uppercase text-muted">Reserved (KTLO)</span>
          </div>
          <div
            role="img"
            aria-label={`${freePct}% free for projects, ${resPct}% reserved for KTLO`}
            className="h-7 rounded-lg overflow-hidden flex border border-line-2 bg-sunk"
          >
            <div className="h-full transition-[width]" style={{ width: `${freePct}%`, background: "var(--good-fill)" }} />
            <div
              className="h-full transition-[width]"
              style={{
                width: `${resPct}%`,
                background: "repeating-linear-gradient(45deg, var(--reserved-fill), var(--reserved-fill) 5px, var(--yolk) 5px, var(--yolk) 10px)",
              }}
            />
          </div>
        </div>

        {/* Stat list */}
        <div className="mt-5">
          <StatRow
            term="Headcount"
            value={fmt(heads, heads % 1 ? 1 : 0)}
            info={
              <Tooltip
                label={<Icon name="info" size={12} />}
                definition="People on the team, weighted by how much time each is allocated here."
                dotted={false}
              />
            }
          />
          <StatRow
            term="Effective FTE"
            value={fmt(eff)}
            info={
              <Tooltip
                label={<Icon name="info" size={12} />}
                definition="How many &ldquo;full-time&rdquo; engineers you really have once level and ramp-up are accounted for. A first-month hire ≈ 0.25."
                dotted={false}
              />
            }
          />
          <StatRow
            term="Person-months available"
            value={fmt(gross)}
            info={
              <Tooltip
                label={<Icon name="info" size={12} />}
                definition="One person working one month = 1 person-month. 6 pm = one engineer for six months, or three for two."
                dotted={false}
              />
            }
          />
          <StatRow term="Reserved (KTLO)" value={`${Math.round(ktloF * 100)}%`} />
          <StatRow term="Net capacity" value={`${fmt(net)} pm`} />
        </div>

        {/* Projects vs capacity */}
        <div className="mt-5 p-4 border border-line rounded-xl bg-paper">
          <div className="font-mono text-[9.5px] font-bold tracking-[.12em] uppercase text-muted">Projects vs capacity</div>
          <FitBar supply={net} demand={dem} />
          <div className="flex justify-between text-xs text-ink-2 py-1">
            <span>Net capacity (supply)</span>
            <strong className="font-mono font-bold">{fmt(net)} pm</strong>
          </div>
          <div className="flex justify-between text-xs text-ink-2 py-1">
            <span>Committed to projects</span>
            <strong className="font-mono font-bold">{fmt(dem)} pm</strong>
          </div>
          <div className="flex justify-between text-xs text-ink-2 py-1 border-t border-line mt-1 pt-2">
            <span>{remain >= 0 ? "Spare for more work" : "Over by"}</span>
            <strong className="font-mono font-bold">{fmt(Math.abs(remain))} pm</strong>
          </div>
        </div>

        {/* Plain-words paragraph */}
        <p className="mt-5 text-xs text-ink-2 leading-relaxed">
          {team.name}&apos;s <strong className="font-mono font-bold text-ink">{fmt(heads, heads % 1 ? 1 : 0)}</strong> people work out to{" "}
          <strong className="font-mono font-bold text-ink">{fmt(eff)}</strong> effective engineers. Over the{" "}
          {team.window === "month" ? "month" : "quarter"} that&apos;s{" "}
          <strong className="font-mono font-bold text-ink">{fmt(gross)}</strong> person-months of real time; with{" "}
          <strong className="font-mono font-bold text-ink">{Math.round(ktloF * 100)}%</strong> reserved to keep the lights on,{" "}
          <strong className="font-mono font-bold text-ink">{fmt(net)} pm</strong> is free for projects — which need{" "}
          <strong className="font-mono font-bold text-ink">{fmt(dem)}</strong>, leaving{" "}
          <strong className="font-mono font-bold text-ink">{fmt(Math.abs(remain))}</strong>{" "}
          {remain >= 0 ? "spare" : "short"}.
        </p>

        {/* Why this matters callout */}
        <div className="mt-5 rounded-xl p-4 bg-yolk-tint border border-[color:var(--yolk-border)]">
          <div className="font-mono text-[9px] font-bold tracking-[.12em] uppercase text-yolk-deep">Why this matters</div>
          {overPts > 4 ? (
            <p className="mt-2 text-xs text-yolk-deep leading-relaxed">
              You&apos;re reserving <strong>{overPts} points more</strong> than your ideal for KTLO. Trimming escalations &amp; onboarding toward target would free roughly{" "}
              <strong>{fmt(gross * overPts / 100)} more person-months</strong> for projects.
            </p>
          ) : (
            <p className="mt-2 text-xs text-yolk-deep leading-relaxed">
              Reservations are close to ideal — so <strong>{fmt(net)} person-months</strong> is a number you can commit to with confidence.
            </p>
          )}
        </div>

        {/* Reserved by bucket legend */}
        <div className="mt-5">
          <div className="font-mono text-[9.5px] font-bold tracking-[.12em] uppercase text-muted mb-2">Reserved capacity, by bucket</div>
          <div className="flex flex-col gap-2">
            {team.ktlo.map((factor: KtloFactor) => (
              <div key={factor.key} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: `var(${factor.swatch})` }}
                  aria-hidden
                />
                <span className="text-xs text-ink-2 flex-1">{factor.key}</span>
                <span className="font-mono text-[11px] font-bold">{factor.current}%</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
