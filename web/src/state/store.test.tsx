import { describe, it, expect } from "vitest";
import { reducer } from "./store";
import type { State } from "./store";
import { makeSeedTeams, CUR } from "../data/seed";

const seeded = (): State => ({ teams: makeSeedTeams(), cur: CUR, view: "manager", status: "ready", saveError: false });

const s0: State = seeded();

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

  it("REMOVE_ENGINEER drops that engineer's id from project assignments only", () => {
    let s = seeded();
    const team = 2; // Aurora
    const roster = s.teams[team].roster;
    const removedId = roster[0].id;     // Alex (assigned to "Search revamp")
    const keptId = roster[1].id;        // Sam   (also on "Search revamp")
    s = reducer(s, { type: "REMOVE_ENGINEER", team, index: 0 });
    const search = s.teams[team].projects.find((p) => p.name === "Search revamp")!;
    expect(search.team).not.toContain(removedId);
    expect(search.team).toContain(keptId);
    expect(s.teams[team].roster.some((e) => e.id === removedId)).toBe(false);
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

  it("MOVE_ENGINEER preserves the engineer's identity and removes them from the source team", () => {
    let s = seeded();
    const fromTeam = 2, toTeam = 0;
    const movedId = s.teams[fromTeam].roster[2].id; // Jordan
    s = reducer(s, { type: "MOVE_ENGINEER", from: fromTeam, engineerId: movedId, to: toTeam });
    expect(s.teams[fromTeam].roster.some((e) => e.id === movedId)).toBe(false);
    expect(s.teams[toTeam].roster.some((e) => e.id === movedId)).toBe(true);
    expect(s.teams[fromTeam].projects.some((p) => p.team.includes(movedId))).toBe(false);
  });

  it("MOVE_ENGINEER is a no-op when from === to", () => {
    const s0 = seeded();
    const id = s0.teams[2].roster[0].id;
    expect(reducer(s0, { type: "MOVE_ENGINEER", from: 2, engineerId: id, to: 2 })).toBe(s0);
  });
  it("MOVE_ENGINEER is a no-op when engineerId is unknown", () => {
    const s0 = seeded();
    expect(reducer(s0, { type: "MOVE_ENGINEER", from: 2, engineerId: "does-not-exist", to: 0 })).toBe(s0);
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
