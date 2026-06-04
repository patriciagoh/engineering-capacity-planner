import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import "vitest-axe/extend-expect";
import { Manager } from "../screens/Manager";
import { Director } from "../screens/Director";
import { PM } from "../screens/PM";
import { renderSeeded } from "./renderSeeded";
expect.extend(matchers);

describe("a11y", () => {
  for (const [name, Screen] of [["Manager", Manager], ["Director", Director], ["PM", PM]] as const) {
    it(`${name} has no obvious a11y violations`, async () => {
      const { container } = await renderSeeded(<Screen />);
      expect(await axe(container)).toHaveNoViolations();
    });
  }
});
