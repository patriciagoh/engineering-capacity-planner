import { render, screen } from "@testing-library/react";
import { DeliverablesList } from "./DeliverablesList";
import type { OrgDeliverable } from "../api/types";

const delivs: OrgDeliverable[] = [
  { id: "sunco", title: "Checkout Redesign", type: "deliverable", priority: 1, owner_ids: ["maya"],
    estimate: { fidelity: "person_months", expected: 2.5 } },
  { id: "tw", title: "Search v2", type: "deliverable", priority: 2, owner_ids: ["priya"],
    estimate: { fidelity: "tshirt", size: "L" } },
];

test("renders deliverable titles and fidelity", () => {
  render(<DeliverablesList deliverables={delivs} />);
  expect(screen.getByText("Checkout Redesign")).toBeInTheDocument();
  expect(screen.getByText(/person_months/)).toBeInTheDocument();
  expect(screen.getByText(/tshirt/)).toBeInTheDocument();
});
