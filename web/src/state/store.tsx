/* eslint-disable react-refresh/only-export-components --
   This module intentionally co-locates the store: the reducer, action types,
   the StoreProvider component, and the useStore hook live together. The rule
   only concerns HMR fast-refresh, not correctness. */
import { createContext, useContext, useReducer, useEffect, useRef, type Dispatch, type ReactNode } from "react";
import type { Team, Engineer, Window } from "../engine/types";
import { newId } from "../engine/ids";
import { createStoragePort } from "../storage/createStoragePort";
import type { StoragePort } from "../storage/types";

export type View = "manager" | "director" | "pm";

export type LoadStatus = "loading" | "ready" | "error";

export interface State {
  teams: Team[];
  cur: number;
  view: View;
  status: LoadStatus;
  saveError: boolean;
}

export const initialState = (): State => ({ teams: [], cur: 0, view: "manager", status: "loading", saveError: false });

const newEngineer = (): Engineer => ({
  id: newId(), name: "New engineer", tenure: "< 4 months", level: "L3", onboarding: "Not Applicable", alloc: 1,
});

export type Action =
  | { type: "HYDRATE"; cur: number; teams: Team[] }
  | { type: "LOAD_ERROR" }
  | { type: "SET_SAVE_ERROR"; value: boolean }
  | { type: "SET_VIEW"; view: View }
  | { type: "OPEN_TEAM"; team: number }
  | { type: "SET_WINDOW"; team: number; window: Window }
  | { type: "EDIT_ENGINEER"; team: number; index: number; field: keyof Engineer; value: string | number }
  | { type: "ADD_ENGINEER"; team: number }
  | { type: "REMOVE_ENGINEER"; team: number; index: number }
  | { type: "MOVE_ENGINEER"; from: number; engineerId: string; to: number }
  | { type: "TOGGLE_ASSIGNMENT"; team: number; project: number; member: string }
  | { type: "SET_OVERHEAD"; team: number; index: number; current: number }
  | { type: "SET_OVERHEAD_IDEAL"; team: number; index: number; ideal: number }
  | { type: "SET_KTLO"; team: number; index: number; current: number }
  | { type: "SET_KTLO_IDEAL"; team: number; index: number; ideal: number }
  | { type: "ADD_PROJECT"; team: number }
  | { type: "REMOVE_PROJECT"; team: number; index: number }
  | { type: "EDIT_PROJECT"; team: number; index: number; field: "name" | "est"; value: string | number };

const mapTeam = (state: State, idx: number, fn: (t: Team) => Team): State => ({
  ...state,
  teams: state.teams.map((t, i) => (i === idx ? fn(t) : t)),
});

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, cur: action.cur, teams: action.teams, status: "ready" };
    case "LOAD_ERROR":
      return { ...state, status: "error" };
    case "SET_SAVE_ERROR":
      return { ...state, saveError: action.value };
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
      return mapTeam(state, action.team, (t) => ({ ...t, roster: [...t.roster, newEngineer()] }));
    case "REMOVE_ENGINEER": {
      const removedId = state.teams[action.team]?.roster[action.index]?.id;
      if (!removedId) return state;
      return mapTeam(state, action.team, (t) => ({
        ...t,
        roster: t.roster.filter((_, i) => i !== action.index),
        projects: t.projects.map((p) => ({ ...p, team: p.team.filter((id) => id !== removedId) })),
      }));
    }
    case "MOVE_ENGINEER": {
      if (action.from === action.to) return state;
      const person = state.teams[action.from]?.roster.find((e) => e.id === action.engineerId);
      if (!person) return state;
      let next = mapTeam(state, action.from, (t) => ({
        ...t,
        roster: t.roster.filter((e) => e.id !== action.engineerId),
        projects: t.projects.map((p) => ({ ...p, team: p.team.filter((id) => id !== action.engineerId) })),
      }));
      next = mapTeam(next, action.to, (t) => ({ ...t, roster: [...t.roster, person] }));
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
      return mapTeam(state, action.team, (t) => ({ ...t, projects: [...t.projects, { id: newId(), name: "New project", est: 0.5, team: [] }] }));
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

export function StoreProvider({ children, port }: { children: ReactNode; port?: StoragePort }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const portRef = useRef<StoragePort | null>(null);
  if (portRef.current === null) portRef.current = port ?? createStoragePort();

  useEffect(() => {
    let cancelled = false;
    const activePort = portRef.current!;
    activePort
      .load()
      .then((loaded) => {
        if (cancelled) return;
        dispatch({ type: "HYDRATE", cur: loaded?.cur ?? 0, teams: loaded?.teams ?? [] });
      })
      .catch(() => { if (!cancelled) dispatch({ type: "LOAD_ERROR" }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    const handle = setTimeout(() => {
      portRef.current!
        .save({ cur: state.cur, teams: state.teams })
        .then(() => dispatch({ type: "SET_SAVE_ERROR", value: false }))
        .catch(() => dispatch({ type: "SET_SAVE_ERROR", value: true }));
    }, 600);
    return () => clearTimeout(handle);
  }, [state.teams, state.cur, state.status]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
