import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScenarioPanel } from "./ScenarioPanel";
import type { ScenarioResult } from "../api/types";

test("runs a KTLO scenario and shows the net delta", async () => {
  const result: ScenarioResult = {
    plan: {} as ScenarioResult["plan"], baseline: {} as ScenarioResult["baseline"],
    delta: { gross_pm: 0, net_pm: 1.6, expected_delta: 1.6 },
  };
  const onRun = vi.fn().mockResolvedValue(result);
  render(<ScenarioPanel teamId="msg" onRun={onRun} />);
  await userEvent.click(screen.getByRole("button", { name: /apply/i }));
  expect(onRun).toHaveBeenCalledWith("msg", [
    { op: "set_reservation", team_id: "msg", name: "KTLO", fraction: expect.any(Number) },
  ]);
  expect(await screen.findByText(/\+1\.6 PM net/)).toBeInTheDocument();
});
