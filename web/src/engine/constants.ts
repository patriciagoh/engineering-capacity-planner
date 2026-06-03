import type { Level, Onboarding, Tenure, OverheadFactor, KtloFactor } from "./types";

export const LEVELS: Record<Level, number> = {
  Intern: 0.7, L2: 1.0, L3: 1.0, Staff: 0.85, Principal: 0.7,
};

export const ONBOARD: Record<Onboarding, number> = {
  "New Hire: Month 1": 0.25, "New Hire: Month 2": 0.5, "New Hire: Month 3": 0.75,
  "Mentor: Month 1": 0.85, "Mentor: Month 2": 0.9, "Mentor: Month 3": 0.95,
  "Not Applicable": 1.0,
};

export const TENURE: Tenure[] = ["< 4 months", "4–12 months", "1–2 years", "2–4 years", "> 4 years"];

export const ALLOCS = [1, 0.75, 0.5, 0.25] as const;

export const defaultOverhead = (): OverheadFactor[] => [
  { key: "Paid time off", desc: "21 days PTO / year", current: 8, ideal: 8 },
  { key: "Sick leave", desc: "unplanned absences", current: 2, ideal: 2 },
  { key: "Public holidays", desc: "~10 days / year", current: 4, ideal: 4 },
  { key: "Company + offsites", desc: "events & team offsites", current: 8, ideal: 8 },
  { key: "Meetings & rituals", desc: "standups, planning, 1:1s, retros", current: 10, ideal: 8 },
  { key: "PR reviews", desc: "reviewing code", current: 7, ideal: 7 },
  { key: "Cross-functional", desc: "helping other teams", current: 5, ideal: 5 },
  { key: "Learning & dev", desc: "2 hours per week", current: 5, ideal: 5 },
];

export const defaultKtlo = (): KtloFactor[] => [
  { key: "Support tickets", current: 15, ideal: 10, swatch: "--swatch-support" },
  { key: "Escalations / incidents", current: 15, ideal: 5, swatch: "--swatch-incident" },
  { key: "Interviews", current: 5, ideal: 5, swatch: "--swatch-interview" },
  { key: "Onboarding others", current: 10, ideal: 0, swatch: "--swatch-onboard" },
  { key: "PTO / holidays / events", current: 5, ideal: 5, swatch: "--swatch-pto" },
];
