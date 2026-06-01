import type { OrgDeliverable } from "../api/types";

export function DeliverablesList({ deliverables }: { deliverables: OrgDeliverable[] }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: ".95rem" }}>Deliverables</h3>
      <table>
        <thead><tr><th>Title</th><th>Type</th><th>Estimate</th><th>Priority</th></tr></thead>
        <tbody>
          {deliverables.map((d) => (
            <tr key={d.id}>
              <td>{d.title}</td>
              <td><span className="chip">{d.type}</span></td>
              <td className="num">{String(d.estimate.fidelity)}{d.estimate.size ? ` ${d.estimate.size}` : ""}{d.estimate.expected != null ? ` (${d.estimate.expected} PM)` : ""}</td>
              <td className="num">{d.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
