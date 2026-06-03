import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreProvider, useStore } from "../state/store";
import { ViewSwitcher } from "./ViewSwitcher";

function ViewProbe() {
  const { state } = useStore();
  return <span data-testid="view">{state.view}</span>;
}

describe("ViewSwitcher", () => {
  it("switches the active view via the store", async () => {
    render(<StoreProvider><ViewSwitcher /><ViewProbe /></StoreProvider>);
    expect(screen.getByTestId("view")).toHaveTextContent("manager");
    await userEvent.click(screen.getByRole("button", { name: /director/i }));
    expect(screen.getByTestId("view")).toHaveTextContent("director");
  });
});
