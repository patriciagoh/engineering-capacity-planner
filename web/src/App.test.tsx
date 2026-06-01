import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("renders the title and a Manager/Director toggle, Manager active by default", () => {
  render(<App />);
  expect(screen.getByText("Capacity Planning")).toBeInTheDocument();
  const manager = screen.getByRole("button", { name: "Manager" });
  const director = screen.getByRole("button", { name: "Director" });
  expect(manager).toHaveAttribute("aria-pressed", "true");
  expect(director).toHaveAttribute("aria-pressed", "false");
});

test("clicking Director switches the active tab", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Director" }));
  expect(screen.getByRole("button", { name: "Director" })).toHaveAttribute("aria-pressed", "true");
});
