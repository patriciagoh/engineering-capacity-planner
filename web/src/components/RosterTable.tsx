import type { RosterRow } from "../api/types";

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  const max = Math.max(...rows.map((r) => r.effective_capacity), 1);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: ".95rem" }}>Roster · effective capacity</h3>
      <table>
        <thead><tr><th>Engineer</th><th>Level</th><th>Avail</th><th>Effective</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.engineer_id}>
              <td>{r.name}</td>
              <td>{r.level}{r.onboarding_state !== "none" ? <span className="chip" style={{ marginLeft: 6 }}>{r.onboarding_state}</span> : null}</td>
              <td className="num">{r.availability.toFixed(2)}</td>
              <td className="num">{(Math.round(r.effective_capacity * 100) / 100).toFixed(2)}</td>
              <td style={{ width: "32%" }}>
                <div className="bar-track"><div className="bar" style={{ width: `${(r.effective_capacity / max) * 100}%` }} /></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
