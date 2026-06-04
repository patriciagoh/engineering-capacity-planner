import type { Team, Engineer, Project } from "../engine/types";
import { defaultOverhead, defaultKtlo } from "../engine/constants";
import { newId } from "../engine/ids";

export const CUR = 2; // Aurora open by default

const e = (
  name: string, tenure: Engineer["tenure"], level: Engineer["level"],
  onboarding: Engineer["onboarding"], alloc: Engineer["alloc"],
): Engineer => ({ id: newId(), name, tenure, level, onboarding, alloc });

const p = (name: string, est: number, team: string[]): Project => ({ id: newId(), name, est, team });

const team = (
  name: string, roster: Engineer[], makeProjects: (ids: string[]) => Project[],
): Team => {
  const ids = roster.map((r) => r.id);
  return {
    id: newId(), name, window: "quarter",
    overhead: defaultOverhead(), ktlo: defaultKtlo(), roster, projects: makeProjects(ids),
  };
};

export const makeSeedTeams = (): Team[] => [
  team("Payments",
    [ e("Ana Idris", "> 4 years", "Staff", "Not Applicable", 1),
      e("Bo Rana", "2–4 years", "L3", "Not Applicable", 1),
      e("Cy Okafor", "1–2 years", "L3", "Not Applicable", 1),
      e("Dot Vance", "< 4 months", "L2", "New Hire: Month 2", 1) ],
    (id) => [ p("Card vault", 1.4, [id[0], id[1]]), p("Payout API", 1.0, [id[2]]) ]),
  team("Growth",
    [ e("Devi Shah", "> 4 years", "L3", "Not Applicable", 1),
      e("Ed Lim", "2–4 years", "L3", "Not Applicable", 1) ],
    (id) => [ p("Referral loop", 0.9, [id[0]]), p("Onboarding funnel", 0.5, [id[1]]) ]),
  team("Aurora",
    [ e("Alex Rivera", "> 4 years", "L3", "Mentor: Month 1", 1),
      e("Sam Chen", "1–2 years", "L3", "Mentor: Month 1", 1),
      e("Jordan Lee", "> 4 years", "L3", "Not Applicable", 1),
      e("Priya Nair", "< 4 months", "L2", "New Hire: Month 3", 1),
      e("Diego Torres", "< 4 months", "Intern", "New Hire: Month 1", 0.5) ],
    (id) => [ p("Search revamp", 1.2, [id[0], id[1]]), p("Billing migration", 0.8, [id[2]]), p("Onboarding tooling", 0.3, [id[3]]) ]),
  team("Mobile",
    [ e("Fia Berg", "2–4 years", "L3", "Not Applicable", 1),
      e("Gabe Ross", "1–2 years", "L2", "Not Applicable", 1) ],
    (id) => [ p("App rewrite", 2.0, [id[0], id[1]]) ]),
  team("Data",
    [ e("Hana Cole", "> 4 years", "Staff", "Not Applicable", 1),
      e("Ivo Pak", "2–4 years", "L3", "Not Applicable", 1),
      e("Jed Moss", "1–2 years", "L3", "Not Applicable", 1) ],
    (id) => [ p("Warehouse v2", 1.4, [id[0], id[1]]) ]),
  team("Identity",
    [ e("Kit Snow", "2–4 years", "L3", "Not Applicable", 1),
      e("Lin Yu", "< 4 months", "L2", "New Hire: Month 2", 1) ],
    (id) => [ p("SSO revamp", 1.3, [id[0]]) ]),
];
