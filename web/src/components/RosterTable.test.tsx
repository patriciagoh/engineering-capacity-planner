import { render, screen } from "@testing-library/react";
import { RosterTable } from "./RosterTable";
import type { RosterRow } from "../api/types";

const rows: RosterRow[] = [
  { engineer_id: "dia", name: "Dia", level: "L3", onboarding_state: "none", availability: 1, effective_capacity: 0.71 },
  { engineer_id: "albert", name: "Albert", level: "L2", onboarding_state: "none", availability: 0.5, effective_capacity: 0.355 },
];

test("renders each engineer with effective capacity", () => {
  render(<RosterTable rows={rows} />);
  expect(screen.getByText("Dia")).toBeInTheDocument();
  expect(screen.getByText("Albert")).toBeInTheDocument();
  expect(screen.getByText("0.71")).toBeInTheDocument();
  expect(screen.getByText("0.36")).toBeInTheDocument(); // 0.355 rounded
});
