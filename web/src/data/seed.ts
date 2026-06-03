import type { Team, Engineer } from "../engine/types";
import { defaultOverhead, defaultKtlo } from "../engine/constants";

export const CUR = 2; // Aurora open by default

const e = (
  name: string, tenure: Engineer["tenure"], level: Engineer["level"],
  onboarding: Engineer["onboarding"], alloc: Engineer["alloc"],
): Engineer => ({ name, tenure, level, onboarding, alloc });

export const makeSeedTeams = (): Team[] => [
  {
    name: "Payments", window: "quarter", overhead: defaultOverhead(), ktlo: defaultKtlo(),
    roster: [
      e("Ana Idris", "> 4 years", "Staff", "Not Applicable", 1),
      e("Bo Rana", "2–4 years", "L3", "Not Applicable", 1),
      e("Cy Okafor", "1–2 years", "L3", "Not Applicable", 1),
      e("Dot Vance", "< 4 months", "L2", "New Hire: Month 2", 1),
    ],
    projects: [
      { name: "Card vault", est: 1.4, team: [0, 1] },
      { name: "Payout API", est: 1.0, team: [2] },
    ],
  },
  {
    name: "Growth", window: "quarter", overhead: defaultOverhead(), ktlo: defaultKtlo(),
    roster: [
      e("Devi Shah", "> 4 years", "L3", "Not Applicable", 1),
      e("Ed Lim", "2–4 years", "L3", "Not Applicable", 1),
    ],
    projects: [
      { name: "Referral loop", est: 0.9, team: [0] },
      { name: "Onboarding funnel", est: 0.5, team: [1] },
    ],
  },
  {
    name: "Aurora", window: "quarter", overhead: defaultOverhead(), ktlo: defaultKtlo(),
    roster: [
      e("Alex Rivera", "> 4 years", "L3", "Mentor: Month 1", 1),
      e("Sam Chen", "1–2 years", "L3", "Mentor: Month 1", 1),
      e("Jordan Lee", "> 4 years", "L3", "Not Applicable", 1),
      e("Priya Nair", "< 4 months", "L2", "New Hire: Month 3", 1),
      e("Diego Torres", "< 4 months", "Intern", "New Hire: Month 1", 0.5),
    ],
    projects: [
      { name: "Search revamp", est: 1.2, team: [0, 1] },
      { name: "Billing migration", est: 0.8, team: [2] },
      { name: "Onboarding tooling", est: 0.3, team: [3] },
    ],
  },
  {
    name: "Mobile", window: "quarter", overhead: defaultOverhead(), ktlo: defaultKtlo(),
    roster: [
      e("Fia Berg", "2–4 years", "L3", "Not Applicable", 1),
      e("Gabe Ross", "1–2 years", "L2", "Not Applicable", 1),
    ],
    projects: [{ name: "App rewrite", est: 2.0, team: [0, 1] }],
  },
  {
    name: "Data", window: "quarter", overhead: defaultOverhead(), ktlo: defaultKtlo(),
    roster: [
      e("Hana Cole", "> 4 years", "Staff", "Not Applicable", 1),
      e("Ivo Pak", "2–4 years", "L3", "Not Applicable", 1),
      e("Jed Moss", "1–2 years", "L3", "Not Applicable", 1),
    ],
    projects: [{ name: "Warehouse v2", est: 1.4, team: [0, 1] }],
  },
  {
    name: "Identity", window: "quarter", overhead: defaultOverhead(), ktlo: defaultKtlo(),
    roster: [
      e("Kit Snow", "2–4 years", "L3", "Not Applicable", 1),
      e("Lin Yu", "< 4 months", "L2", "New Hire: Month 2", 1),
    ],
    projects: [{ name: "SSO revamp", est: 1.3, team: [0] }],
  },
];
