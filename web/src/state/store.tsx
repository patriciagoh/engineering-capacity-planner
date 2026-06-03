import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { Team, Engineer, Window } from "../engine/types";
import { makeSeedTeams, CUR } from "../data/seed";

export type View = "manager" | "director" | "pm";

export interface State {
  teams: Team[];
  cur: number;
  view: View;
}

export const initialState = (): State => ({ teams: makeSeedTeams(), cur: CUR, view: "manager" });

const NEW_ENGINEER: Engineer = {
  name: "New engineer", tenure: "< 4 months", level: "L3", onboarding: "Not Applicable", alloc: 1,
};

export type Action =
  | { type: "SET_VIEW"; view: View }
  | { type: "OPEN_TEAM"; team: number }
  | { type: "SET_WINDOW"; team: number; window: Window }
  | { type: "EDIT_ENGINEER"; team: number; index: number; field: keyof Engineer; value: string | number }
  | { type: "ADD_ENGINEER"; team: number }
  | { type: "REMOVE_ENGINEER"; team: number; index: number }
  | { type: "MOVE_ENGINEER"; from: number; index: number; to: number }
  | { type: "TOGGLE_ASSIGNMENT"; team: number; project: number; member: number }
  | { type: "SET_OVERHEAD"; team: number; index: number; current: number }
  | { type: "SET_OVERHEAD_IDEAL"; team: number; index: number; ideal: number }
  | { type: "SET_KTLO"; team: number; index: number; current: number }
  | { type: "SET_KTLO_IDEAL"; team: number; index: number; ideal: number }
  | { type: "ADD_PROJECT"; team: number }
  | { type: "REMOVE_PROJECT"; team: number; index: number }
  | { type: "EDIT_PROJECT"; team: number; index: number; field: "name" | "est"; value: string | number };

// Drop a removed roster index from a project team[], reindexing higher indices down by one.
const reindexAfterRemoval = (team: number[], removed: number): number[] =>
  team.filter((i) => i !== removed).map((i) => (i > removed ? i - 1 : i));

const mapTeam = (state: State, idx: number, fn: (t: Team) => Team): State => ({
  ...state,
  teams: state.teams.map((t, i) => (i === idx ? fn(t) : t)),
});

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "OPEN_TEAM":
      return { ...state, cur: action.team, view: "manager" };
    case "SET_WINDOW":
      return mapTeam(state, action.team, (t) => ({ ...t, window: action.window }));
    case "EDIT_ENGINEER":
      return mapTeam(state, action.team, (t) => ({
        ...t,
        roster: t.roster.map((e, i) => (i === action.index ? { ...e, [action.field]: action.value } : e)),
      }));
    case "ADD_ENGINEER":
      return mapTeam(state, action.team, (t) => ({ ...t, roster: [...t.roster, { ...NEW_ENGINEER }] }));
    case "REMOVE_ENGINEER":
      return mapTeam(state, action.team, (t) => ({
        ...t,
        roster: t.roster.filter((_, i) => i !== action.index),
        projects: t.projects.map((p) => ({ ...p, team: reindexAfterRemoval(p.team, action.index) })),
      }));
    case "MOVE_ENGINEER": {
      if (action.from === action.to) return state;
      const person = state.teams[action.from].roster[action.index];
      if (!person) return state;
      let next = mapTeam(state, action.from, (t) => ({
        ...t,
        roster: t.roster.filter((_, i) => i !== action.index),
        projects: t.projects.map((p) => ({ ...p, team: reindexAfterRemoval(p.team, action.index) })),
      }));
      next = mapTeam(next, action.to, (t) => ({ ...t, roster: [...t.roster, { ...person }] }));
      return next;
    }
    case "TOGGLE_ASSIGNMENT":
      return mapTeam(state, action.team, (t) => ({
        ...t,
        projects: t.projects.map((p, i) => {
          if (i !== action.project) return p;
          const has = p.team.includes(action.member);
          return { ...p, team: has ? p.team.filter((m) => m !== action.member) : [...p.team, action.member] };
        }),
      }));
    case "SET_OVERHEAD":
      return mapTeam(state, action.team, (t) => ({
        ...t, overhead: t.overhead.map((f, i) => (i === action.index ? { ...f, current: action.current } : f)),
      }));
    case "SET_OVERHEAD_IDEAL":
      return mapTeam(state, action.team, (t) => ({
        ...t, overhead: t.overhead.map((f, i) => (i === action.index ? { ...f, ideal: action.ideal } : f)),
      }));
    case "SET_KTLO":
      return mapTeam(state, action.team, (t) => ({
        ...t, ktlo: t.ktlo.map((f, i) => (i === action.index ? { ...f, current: action.current } : f)),
      }));
    case "SET_KTLO_IDEAL":
      return mapTeam(state, action.team, (t) => ({
        ...t, ktlo: t.ktlo.map((f, i) => (i === action.index ? { ...f, ideal: action.ideal } : f)),
      }));
    case "ADD_PROJECT":
      return mapTeam(state, action.team, (t) => ({ ...t, projects: [...t.projects, { name: "New project", est: 0.5, team: [] }] }));
    case "REMOVE_PROJECT":
      return mapTeam(state, action.team, (t) => ({ ...t, projects: t.projects.filter((_, i) => i !== action.index) }));
    case "EDIT_PROJECT":
      return mapTeam(state, action.team, (t) => ({
        ...t,
        projects: t.projects.map((p, i) => (i === action.index ? { ...p, [action.field]: action.value } : p)),
      }));
    default:
      return state;
  }
}

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
