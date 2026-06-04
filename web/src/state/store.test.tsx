import { describe, it, expect } from "vitest";
import { reducer, initialState } from "./store";
import type { State } from "./store";

const s0: State = initialState();

describe("reducer", () => {
  it("SET_VIEW switches the active lens", () => {
    expect(reducer(s0, { type: "SET_VIEW", view: "director" }).view).toBe("director");
  });

  it("SET_WINDOW is stored per team", () => {
    const s = reducer(s0, { type: "SET_WINDOW", team: 2, window: "month" });
    expect(s.teams[2].window).toBe("month");
    expect(s.teams[0].window).toBe("quarter");
  });

  it("EDIT_ENGINEER updates a single field", () => {
    const s = reducer(s0, { type: "EDIT_ENGINEER", team: 2, index: 0, field: "level", value: "Staff" });
    expect(s.teams[2].roster[0].level).toBe("Staff");
  });

  it("TOGGLE_ASSIGNMENT adds/removes a member id from a project's team[]", () => {
    const memberId = s0.teams[2].roster[4].id;
    const add = reducer(s0, { type: "TOGGLE_ASSIGNMENT", team: 2, project: 0, member: memberId });
    expect(add.teams[2].projects[0].team).toContain(memberId);
    const remove = reducer(add, { type: "TOGGLE_ASSIGNMENT", team: 2, project: 0, member: memberId });
    expect(remove.teams[2].projects[0].team).not.toContain(memberId);
  });

  it("REMOVE_ENGINEER removes the engineer from the roster", () => {
    // Task 3 will also strip the removed engineer's id from project team[].
    // For now REMOVE_ENGINEER only mutates the roster (project teams unchanged).
    const removedId = s0.teams[2].roster[0].id;
    const s = reducer(s0, { type: "REMOVE_ENGINEER", team: 2, index: 0 });
    expect(s.teams[2].roster).toHaveLength(4);
    expect(s.teams[2].roster.find((r) => r.id === removedId)).toBeUndefined();
  });

  it("ADD_ENGINEER appends a default engineer", () => {
    const s = reducer(s0, { type: "ADD_ENGINEER", team: 2 });
    expect(s.teams[2].roster).toHaveLength(6);
  });

  it("SET_OVERHEAD and SET_KTLO update current %, SET_IDEAL updates ideal", () => {
    let s = reducer(s0, { type: "SET_OVERHEAD", team: 2, index: 4, current: 12 });
    expect(s.teams[2].overhead[4].current).toBe(12);
    s = reducer(s, { type: "SET_KTLO", team: 2, index: 1, current: 8 });
    expect(s.teams[2].ktlo[1].current).toBe(8);
    s = reducer(s, { type: "SET_KTLO_IDEAL", team: 2, index: 1, ideal: 3 });
    expect(s.teams[2].ktlo[1].ideal).toBe(3);
  });

  it("MOVE_ENGINEER moves a person between rosters", () => {
    // Task 3 will also strip the moved engineer's id from their old team's projects.
    const s = reducer(s0, { type: "MOVE_ENGINEER", from: 2, index: 2, to: 3 }); // Jordan Lee Aurora->Mobile
    expect(s.teams[2].roster.find((r) => r.name === "Jordan Lee")).toBeUndefined();
    expect(s.teams[3].roster.find((r) => r.name === "Jordan Lee")).toBeDefined();
  });

  it("ADD_PROJECT / REMOVE_PROJECT / EDIT_PROJECT mutate demand rows", () => {
    let s = reducer(s0, { type: "ADD_PROJECT", team: 2 });
    expect(s.teams[2].projects).toHaveLength(4);
    s = reducer(s, { type: "EDIT_PROJECT", team: 2, index: 3, field: "est", value: 2 });
    expect(s.teams[2].projects[3].est).toBe(2);
    s = reducer(s, { type: "REMOVE_PROJECT", team: 2, index: 3 });
    expect(s.teams[2].projects).toHaveLength(3);
  });

  it("OPEN_TEAM sets cur and switches to manager", () => {
    const s = reducer({ ...s0, view: "director" }, { type: "OPEN_TEAM", team: 4 });
    expect(s.cur).toBe(4);
    expect(s.view).toBe("manager");
  });
});
