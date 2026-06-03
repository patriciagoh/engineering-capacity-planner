export type Level = "Intern" | "L2" | "L3" | "Staff" | "Principal";

export type Onboarding =
  | "New Hire: Month 1" | "New Hire: Month 2" | "New Hire: Month 3"
  | "Mentor: Month 1" | "Mentor: Month 2" | "Mentor: Month 3"
  | "Not Applicable";

export type Tenure =
  | "< 4 months" | "4–12 months" | "1–2 years" | "2–4 years" | "> 4 years";

export type Alloc = 1 | 0.75 | 0.5 | 0.25;
export type Window = "month" | "quarter";

export interface Engineer {
  name: string;
  tenure: Tenure;
  level: Level;
  onboarding: Onboarding;
  alloc: Alloc;
}

export interface OverheadFactor {
  key: string;
  desc: string;
  current: number; // percent of the working week
  ideal: number;
}

export interface KtloFactor {
  key: string;
  current: number; // percent reserved
  ideal: number;
  swatch: string;  // CSS var name, e.g. "--swatch-support"
}

export interface Project {
  name: string;
  est: number;       // person-months
  team: number[];    // indices into the team roster
}

export interface Team {
  name: string;
  roster: Engineer[];
  overhead: OverheadFactor[];
  ktlo: KtloFactor[];
  projects: Project[];
  window: Window;
}
