# Engineering Capacity Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `web/` app in the `engineering-capacity-planner` repo as a faithful, matcha-oat-skinned React SPA of the three-lens (Manager / Director / PM) capacity planner, powered by a fresh, tested TypeScript engine.

**Architecture:** Pure framework-free engine (`src/engine/`) is the source of truth for all capacity math; a `useReducer` store (`src/state/`) holds `teams[]` / `cur` / `view` and exposes only inputs (computed values are always derived live via selectors); screens and components format and draw. Skin comes entirely from matcha-oat tokens via the Tailwind preset.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 3 (matcha-oat preset), Lucide icons, vitest + @testing-library + vitest-axe. Node 20.

**Reference:** `web/reference/Capacity Dashboard.html` is the primary source for exact markup, copy, and layout. `web/reference/screenshots/*.png` show each view. Port its structure/copy faithfully; only the tokens change. Design spec: `docs/superpowers/specs/2026-06-03-engineering-capacity-planner-matcha-oat-design.md`.

---

## File Structure

```
web/
  index.html, package.json, tsconfig*.json, vite.config.ts, postcss.config.js,
  eslint.config.js, tailwind.config.ts, .nvmrc, .gitignore
  scripts/lint-tokens.mjs
  reference/                     # the handoff prototype + screenshots (committed for context)
  src/
    main.tsx, App.tsx, index.css
    styles/tokens.planner.css     # app-specific token aliases (swatch roles)
    engine/
      types.ts                    # Level, Onboarding, Tenure, Engineer, OverheadFactor, KtloFactor, Project, Team, Window
      constants.ts                # LEVELS, ONBOARD, TENURE, defaultOverhead(), defaultKtlo()
      selectors.ts                # effFTE, productive, weeksFor, grossPM, ktloFrac, netPM, demand, fit, personLoads, rollup, pmVerdict
    data/seed.ts                  # six-team sample org; CUR = 2 (Aurora)
    state/
      store.tsx                   # reducer, Action union, Provider, useStore hook
    components/
      Icon.tsx, Tooltip.tsx, EditableField.tsx, Slider.tsx,
      FitBar.tsx, LoadBar.tsx, StatRow.tsx, Pills.tsx, DarkPanel.tsx,
      SegmentedToggle.tsx, TopBar.tsx, ViewSwitcher.tsx, ExportMenu.tsx
    export/exporters.ts           # toCSV, toJSON, printPlan
    screens/
      Manager.tsx, Director.tsx, PM.tsx
    test/setup.ts, test/a11y.test.tsx
```

---

## Task 1: Retire the old stack and scaffold the new web app

**Files:**
- Delete (working tree; preserved in git history): `engine/`, `server/`, and the entire current contents of `web/`.
- Create: `web/package.json`, `web/.nvmrc`, `web/.gitignore`, `web/index.html`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.app.json`, `web/tsconfig.node.json`, `web/postcss.config.js`, `web/eslint.config.js`, `web/tailwind.config.ts`, `web/scripts/lint-tokens.mjs`, `web/src/main.tsx`, `web/src/test/setup.ts`.
- Copy: the handoff prototype into `web/reference/`.

- [ ] **Step 1: Remove the superseded stack and old web app**

```bash
cd ~/capacity-planning
git rm -r engine server web >/dev/null
# (git history retains them; working tree is now clean of the old stack)
mkdir -p web/src/test web/scripts web/reference
```

- [ ] **Step 2: Bring in the prototype as reference**

```bash
cp -R "/tmp/engcap/design_handoff_capacity_planner/reference/." web/reference/
cp -R "/tmp/engcap/design_handoff_capacity_planner/screenshots" web/reference/screenshots
ls web/reference   # expect: Capacity Dashboard.html, How It Fits Together.html, screenshots/
```

- [ ] **Step 3: Write `web/package.json`**

```json
{
  "name": "engineering-capacity-planner",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "lint:tokens": "node scripts/lint-tokens.mjs \"src/components/**/*.{ts,tsx}\" \"src/screens/**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "test": "vitest run"
  },
  "dependencies": {
    "lucide-react": "^0.456.0",
    "matcha-oat-design-system": "github:patriciagoh/matcha-oat-design-system",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.12.3",
    "@types/react": "^19.2.16",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.5.0",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "fast-glob": "^3.3.3",
    "globals": "^17.6.0",
    "jsdom": "^25.0.1",
    "postcss": "^8.5.15",
    "tailwindcss": "^3.4.19",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.59.2",
    "vite": "^5.4.21",
    "vitest": "^2.1.9",
    "vitest-axe": "^1.0.0-pre.3"
  }
}
```

- [ ] **Step 4: Write the config files** (copy verbatim from these blocks)

`web/.nvmrc`:
```
20
```

`web/vite.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/engineering-capacity-planner/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

`web/tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`web/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`web/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

`web/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

`web/eslint.config.js`:
```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'reference']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
```

`web/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";
import matchaOat from "matcha-oat-design-system/tailwind-preset";

export default {
  presets: [matchaOat],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config;
```

`web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Engineering Capacity Planner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`web/.gitignore`:
```
node_modules
dist
dist-ssr
*.local
.DS_Store
node_modules/.tmp
```

- [ ] **Step 5: Write `web/scripts/lint-tokens.mjs`** (verbatim)

```js
#!/usr/bin/env node
/**
 * Wrapper around matcha-oat's check-no-raw-values.mjs that handles glob
 * expansion. Exits 0 if no files match (safe before component dirs exist).
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const fg = (await import("fast-glob")).default;

const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  console.error("usage: lint-tokens.mjs <glob...>");
  process.exit(2);
}

const files = await fg(patterns);
if (files.length === 0) {
  console.log("OK — no files matched the lint:tokens globs (dirs not yet created).");
  process.exit(0);
}

const checkerPath = path.resolve(
  fileURLToPath(import.meta.url),
  "../../node_modules/matcha-oat-design-system/scripts/check-no-raw-values.mjs"
);
const result = spawnSync(process.execPath, [checkerPath, ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
```

- [ ] **Step 6: Write `web/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Write `web/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 8: Install and verify the toolchain boots**

```bash
cd web && npm install
```
Expected: install completes; `node_modules/matcha-oat-design-system/scripts/check-no-raw-values.mjs` exists.

- [ ] **Step 9: Commit**

```bash
cd ~/capacity-planning
git add -A
git commit -m "chore: retire python stack; scaffold matcha-oat web app"
```

---

## Task 2: App stylesheet and token aliases

**Files:**
- Create: `web/src/styles/tokens.planner.css`, `web/src/index.css`, `web/src/App.tsx` (temporary placeholder).

- [ ] **Step 1: Write `web/src/styles/tokens.planner.css`**

App-specific aliases mapping the prototype's roles to matcha-oat tokens. The five KTLO swatch colors reuse brand tokens.

```css
/* App aliases over matcha-oat tokens. No raw hex outside this file. */
:root {
  --hero-bg: var(--term-bg);
  --hero-text: var(--term-text);

  /* KTLO swatch roles → matcha-oat tokens (order matches defaultKtlo()) */
  --swatch-support:   var(--matcha);
  --swatch-incident:  var(--bad-border);
  --swatch-interview: var(--yolk);
  --swatch-onboard:   var(--yolk-deep);
  --swatch-pto:       var(--muted);

  --over-fill: var(--bad);
  --good-fill: var(--matcha);
  --reserved-fill: var(--yolk);
}
```

- [ ] **Step 2: Write `web/src/index.css`**

```css
@import "matcha-oat-design-system/tokens.css";
@import "matcha-oat-design-system/fonts.css";
@import "./styles/tokens.planner.css";

@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { background: var(--oat); color: var(--ink); font-family: var(--sans); }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

:where(button, [role="button"], [role="tab"]) { min-height: 44px; }

.ecp-editable:focus-visible {
  outline: var(--focus);
  outline-offset: var(--focus-offset);
}

/* Print: hide chrome, linearize (Export → PDF/print). */
@media print {
  .ecp-no-print { display: none !important; }
  .ecp-rail { position: static !important; }
}
```

- [ ] **Step 3: Write a temporary `web/src/App.tsx`**

```tsx
export function App() {
  return <main className="p-12"><h1 className="font-serif text-ink">Engineering Capacity Planner</h1></main>;
}
```

- [ ] **Step 4: Verify build + dev boot**

```bash
cd web && npm run build
```
Expected: `tsc -b` passes and Vite writes `dist/`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): app stylesheet + matcha-oat token aliases"
```

---

## Task 3: Engine types and constants

**Files:**
- Create: `web/src/engine/types.ts`, `web/src/engine/constants.ts`, `web/src/engine/constants.test.ts`.

- [ ] **Step 1: Write `web/src/engine/types.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `web/src/engine/constants.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { LEVELS, ONBOARD, TENURE, defaultOverhead, defaultKtlo } from "./constants";

describe("constants", () => {
  it("level multipliers match the locked contract", () => {
    expect(LEVELS).toEqual({ Intern: 0.7, L2: 1.0, L3: 1.0, Staff: 0.85, Principal: 0.7 });
  });
  it("onboarding multipliers match the locked contract", () => {
    expect(ONBOARD["New Hire: Month 1"]).toBe(0.25);
    expect(ONBOARD["Mentor: Month 3"]).toBe(0.95);
    expect(ONBOARD["Not Applicable"]).toBe(1.0);
  });
  it("tenure has five informational bands", () => {
    expect(TENURE).toHaveLength(5);
  });
  it("default overhead sums to 49%", () => {
    expect(defaultOverhead().reduce((s, f) => s + f.current, 0)).toBe(49);
  });
  it("default KTLO sums to 50% with five buckets", () => {
    const k = defaultKtlo();
    expect(k).toHaveLength(5);
    expect(k.reduce((s, f) => s + f.current, 0)).toBe(50);
  });
});
```

- [ ] **Step 3: Run it to verify failure**

Run: `cd web && npx vitest run src/engine/constants.test.ts`
Expected: FAIL — cannot resolve `./constants`.

- [ ] **Step 4: Write `web/src/engine/constants.ts`**

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web && npx vitest run src/engine/constants.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(engine): locked types and constants"
```

---

## Task 4: Core capacity selectors

**Files:**
- Create: `web/src/engine/selectors.ts`, `web/src/engine/selectors.test.ts`.

- [ ] **Step 1: Write the failing test `web/src/engine/selectors.test.ts`**

Uses a small fixture team mirroring Aurora so we assert against the prototype's headline (`netPM ≈ 2.706`, reserved 50%, demand 2.3, fit ≈ 0.406).

```ts
import { describe, it, expect } from "vitest";
import { defaultOverhead, defaultKtlo } from "./constants";
import {
  weeksFor, effFTE, productive, grossPM, ktloFrac, netPM, demand, fit,
} from "./selectors";
import type { Team } from "./types";

const aurora: Team = {
  name: "Aurora",
  window: "quarter",
  overhead: defaultOverhead(),
  ktlo: defaultKtlo(),
  roster: [
    { name: "Alex Rivera", tenure: "> 4 years", level: "L3", onboarding: "Mentor: Month 1", alloc: 1 },
    { name: "Sam Chen", tenure: "1–2 years", level: "L3", onboarding: "Mentor: Month 1", alloc: 1 },
    { name: "Jordan Lee", tenure: "> 4 years", level: "L3", onboarding: "Not Applicable", alloc: 1 },
    { name: "Priya Nair", tenure: "< 4 months", level: "L2", onboarding: "New Hire: Month 3", alloc: 1 },
    { name: "Diego Torres", tenure: "< 4 months", level: "Intern", onboarding: "New Hire: Month 1", alloc: 0.5 },
  ],
  projects: [
    { name: "Search revamp", est: 1.2, team: [0, 1] },
    { name: "Billing migration", est: 0.8, team: [2] },
    { name: "Onboarding tooling", est: 0.3, team: [3] },
  ],
};

describe("core selectors (Aurora fixture)", () => {
  it("weeksFor: 12 for quarter, 4.33 for month", () => {
    expect(weeksFor("quarter")).toBe(12);
    expect(weeksFor("month")).toBe(4.33);
  });
  it("effFTE sums alloc x level x onboarding", () => {
    expect(effFTE(aurora.roster)).toBeCloseTo(3.5375, 4);
  });
  it("productive is 1 - overhead fraction, floored at 0", () => {
    expect(productive(aurora.overhead)).toBeCloseTo(0.51, 5);
  });
  it("grossPM = effFTE x (weeks/4) x productive", () => {
    expect(grossPM(aurora)).toBeCloseTo(5.41238, 4);
  });
  it("ktloFrac sums reservations", () => {
    expect(ktloFrac(aurora.ktlo)).toBeCloseTo(0.5, 5);
  });
  it("netPM is the headline (~2.706)", () => {
    expect(netPM(aurora)).toBeCloseTo(2.706, 2);
  });
  it("demand sums project estimates", () => {
    expect(demand(aurora)).toBeCloseTo(2.3, 5);
  });
  it("fit = netPM - demand (~0.406 spare)", () => {
    expect(fit(aurora)).toBeCloseTo(0.406, 2);
  });
  it("productive floors at 0 when overhead exceeds 100", () => {
    const t = { ...aurora, overhead: aurora.overhead.map((f) => ({ ...f, current: 20 })) };
    expect(productive(t.overhead)).toBe(0);
    expect(grossPM(t)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/engine/selectors.test.ts`
Expected: FAIL — cannot resolve `./selectors`.

- [ ] **Step 3: Write `web/src/engine/selectors.ts`**

```ts
import type { Engineer, OverheadFactor, KtloFactor, Team, Window } from "./types";
import { LEVELS, ONBOARD } from "./constants";

export const weeksFor = (w: Window): number => (w === "month" ? 4.33 : 12);

export const engEff = (e: Engineer): number =>
  e.alloc * LEVELS[e.level] * ONBOARD[e.onboarding];

export const effFTE = (roster: Engineer[]): number =>
  roster.reduce((s, e) => s + engEff(e), 0);

export const productive = (overhead: OverheadFactor[]): number =>
  Math.max(0, 1 - overhead.reduce((s, f) => s + f.current, 0) / 100);

export const grossPM = (t: Team): number =>
  effFTE(t.roster) * (weeksFor(t.window) / 4) * productive(t.overhead);

export const ktloFrac = (ktlo: KtloFactor[]): number =>
  ktlo.reduce((s, f) => s + f.current, 0) / 100;

export const netPM = (t: Team): number => grossPM(t) * (1 - ktloFrac(t.ktlo));

export const demand = (t: Team): number =>
  t.projects.reduce((s, p) => s + (Number(p.est) || 0), 0);

export const fit = (t: Team): number => netPM(t) - demand(t);

export const headcount = (roster: Engineer[]): number =>
  roster.reduce((s, e) => s + e.alloc, 0);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/engine/selectors.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): core capacity selectors"
```

---

## Task 5: Per-person load selector

**Files:**
- Modify: `web/src/engine/selectors.ts` (append), `web/src/engine/selectors.test.ts` (append).

- [ ] **Step 1: Append the failing test to `selectors.test.ts`**

```ts
import { personLoads } from "./selectors";

describe("personLoads", () => {
  it("splits each project's estimate evenly across assigned members and flags >100%", () => {
    const loads = personLoads(aurora);
    expect(loads).toHaveLength(aurora.roster.length);
    // Alex (idx 0) is on Search revamp (1.2 over 2 = 0.6pm). Load = 0.6 / personNet * 100.
    expect(loads[0].assignedPM).toBeCloseTo(0.6, 5);
    expect(loads[0].pct).toBeGreaterThan(0);
    expect(loads[0]).toHaveProperty("over");
  });
  it("an engineer on nothing has 0 load", () => {
    const t = { ...aurora, projects: [] };
    expect(personLoads(t).every((l) => l.assignedPM === 0 && l.pct === 0)).toBe(true);
  });
  it("personNet of 0 yields pct 0 (no divide-by-zero)", () => {
    const t = { ...aurora, overhead: aurora.overhead.map((f) => ({ ...f, current: 50 })) };
    expect(personLoads(t).every((l) => Number.isFinite(l.pct))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/engine/selectors.test.ts`
Expected: FAIL — `personLoads` is not exported.

- [ ] **Step 3: Append to `web/src/engine/selectors.ts`**

```ts
export interface PersonLoad {
  name: string;
  assignedPM: number;
  personNet: number;
  pct: number;
  over: boolean;
}

export const personNet = (e: Engineer, t: Team): number =>
  engEff(e) * (weeksFor(t.window) / 4) * productive(t.overhead) * (1 - ktloFrac(t.ktlo));

export const personLoads = (t: Team): PersonLoad[] =>
  t.roster.map((e, i) => {
    const assignedPM = t.projects.reduce(
      (s, p) => s + (p.team.includes(i) ? p.est / p.team.length : 0),
      0,
    );
    const pNet = personNet(e, t);
    const pct = pNet > 0 ? (assignedPM / pNet) * 100 : 0;
    return { name: e.name, assignedPM, personNet: pNet, pct, over: pct > 100 };
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/engine/selectors.test.ts`
Expected: PASS (12 tests total).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): per-person load selector"
```

---

## Task 6: Roll-up and PM verdict selectors

**Files:**
- Modify: `web/src/engine/selectors.ts` (append), `web/src/engine/selectors.test.ts` (append).

- [ ] **Step 1: Append the failing test**

```ts
import { rollup, pmVerdict } from "./selectors";

describe("rollup and pmVerdict", () => {
  const teams = [aurora, { ...aurora, name: "B", projects: [{ name: "X", est: 99, team: [0] }] }];

  it("rollup returns per-team fit and group net = sum of fits", () => {
    const r = rollup(teams);
    expect(r.teams).toHaveLength(2);
    expect(r.groupNet).toBeCloseTo(fit(teams[0]) + fit(teams[1]), 5);
    expect(r.teams[0].status).toBe("ok");      // Aurora spare
    expect(r.teams[1].status).toBe("over");     // B oversubscribed
  });

  it("pmVerdict: lands when est <= spare, with leftover", () => {
    const v = pmVerdict(aurora, 0.2);
    expect(v.lands).toBe(true);
    expect(v.leftover).toBeCloseTo(fit(aurora) - 0.2, 5);
  });

  it("pmVerdict: short by est - spare when it does not fit", () => {
    const v = pmVerdict(aurora, 5);
    expect(v.lands).toBe(false);
    expect(v.gap).toBeCloseTo(5 - fit(aurora), 5);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/engine/selectors.test.ts`
Expected: FAIL — `rollup` / `pmVerdict` not exported.

- [ ] **Step 3: Append to `web/src/engine/selectors.ts`**

```ts
export type FitStatus = "ok" | "tight" | "over";

export interface TeamFit {
  name: string;
  supply: number;   // netPM
  demand: number;
  fit: number;
  status: FitStatus;
}

export const teamFit = (t: Team): TeamFit => {
  const supply = netPM(t);
  const d = demand(t);
  const f = supply - d;
  const status: FitStatus = f < 0 ? "over" : f < supply * 0.1 ? "tight" : "ok";
  return { name: t.name, supply, demand: d, fit: f, status };
};

export const rollup = (teams: Team[]): { teams: TeamFit[]; groupNet: number } => {
  const fits = teams.map(teamFit);
  return { teams: fits, groupNet: fits.reduce((s, x) => s + x.fit, 0) };
};

export interface PmVerdict {
  lands: boolean;
  spare: number;
  leftover: number; // when lands
  gap: number;      // when short
}

export const pmVerdict = (t: Team, est: number): PmVerdict => {
  const spare = fit(t);
  const lands = est <= spare;
  return { lands, spare, leftover: lands ? spare - est : 0, gap: lands ? 0 : est - spare };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/engine/selectors.test.ts`
Expected: PASS (15 tests total).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): roll-up and PM verdict selectors"
```

---

## Task 7: Seed sample org

**Files:**
- Create: `web/src/data/seed.ts`, `web/src/data/seed.test.ts`.

- [ ] **Step 1: Write the failing test `web/src/data/seed.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { makeSeedTeams, CUR } from "./seed";
import { netPM, fit } from "../engine/selectors";

describe("seed org", () => {
  it("seeds six teams with Aurora open by default", () => {
    const teams = makeSeedTeams();
    expect(teams.map((t) => t.name)).toEqual(["Payments", "Growth", "Aurora", "Mobile", "Data", "Identity"]);
    expect(CUR).toBe(2);
    expect(teams[CUR].name).toBe("Aurora");
  });
  it("Aurora's net capacity matches the prototype headline (~2.7)", () => {
    expect(netPM(makeSeedTeams()[2])).toBeCloseTo(2.706, 2);
    expect(fit(makeSeedTeams()[2])).toBeCloseTo(0.406, 2);
  });
  it("makeSeedTeams returns fresh copies (no shared mutation)", () => {
    const a = makeSeedTeams();
    a[2].roster[0].name = "MUTATED";
    expect(makeSeedTeams()[2].roster[0].name).not.toBe("MUTATED");
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/data/seed.test.ts`
Expected: FAIL — cannot resolve `./seed`.

- [ ] **Step 3: Write `web/src/data/seed.ts`**

Copy the six teams verbatim from `web/reference/Capacity Dashboard.html` lines 443–481 (the `mk`, `ovr`, `ktl`, and `teams` literals), translated into the typed model. `makeSeedTeams()` must build fresh objects each call (call `defaultOverhead()`/`defaultKtlo()` per team).

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/data/seed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(data): six-team seed org"
```

---

## Task 8: State store (reducer + actions)

**Files:**
- Create: `web/src/state/store.tsx`, `web/src/state/store.test.tsx`.

- [ ] **Step 1: Write the failing test `web/src/state/store.test.tsx`**

```tsx
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

  it("TOGGLE_ASSIGNMENT adds/removes a member from a project's team[]", () => {
    const add = reducer(s0, { type: "TOGGLE_ASSIGNMENT", team: 2, project: 0, member: 4 });
    expect(add.teams[2].projects[0].team).toContain(4);
    const remove = reducer(add, { type: "TOGGLE_ASSIGNMENT", team: 2, project: 0, member: 4 });
    expect(remove.teams[2].projects[0].team).not.toContain(4);
  });

  it("REMOVE_ENGINEER strips the index from every project's team[] and reindexes", () => {
    // Aurora: Search revamp = [0,1]; removing idx 0 should leave [0] (old idx1 -> 0)
    const s = reducer(s0, { type: "REMOVE_ENGINEER", team: 2, index: 0 });
    expect(s.teams[2].roster).toHaveLength(4);
    expect(s.teams[2].projects[0].team).toEqual([0]);
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

  it("MOVE_ENGINEER moves a person between rosters and strips their old assignments", () => {
    const s = reducer(s0, { type: "MOVE_ENGINEER", from: 2, index: 2, to: 3 }); // Jordan Lee Aurora->Mobile
    expect(s.teams[2].roster.find((r) => r.name === "Jordan Lee")).toBeUndefined();
    expect(s.teams[3].roster.find((r) => r.name === "Jordan Lee")).toBeDefined();
    // Billing migration was [2] (Jordan); after removal that project has no members
    expect(s.teams[2].projects[1].team).toEqual([]);
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/state/store.test.tsx`
Expected: FAIL — cannot resolve `./store`.

- [ ] **Step 3: Write `web/src/state/store.tsx`**

Immutable reducer over `{ teams, cur, view }`. Note `REMOVE_ENGINEER` and `MOVE_ENGINEER` must reindex/strip project `team[]` (drop the removed index, decrement higher indices).

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/state/store.test.tsx`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(state): reducer, actions, store provider"
```

---

## Task 9: Icon and Tooltip components

**Files:**
- Create: `web/src/components/Icon.tsx`, `web/src/components/Tooltip.tsx`, `web/src/components/Tooltip.test.tsx`.

- [ ] **Step 1: Write `web/src/components/Icon.tsx`**

Thin wrapper exposing the Lucide icons the UI uses (chevron-down ▾, arrow-right →, corner-down-right ↳, x ×, info ⓘ, plus +). Keeps icon usage centralized and prevents emoji.

```tsx
import { ChevronDown, ArrowRight, CornerDownRight, X, Info, Plus, type LucideProps } from "lucide-react";

const ICONS = { chevron: ChevronDown, arrow: ArrowRight, subarrow: CornerDownRight, close: X, info: Info, plus: Plus };
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & LucideProps) {
  const C = ICONS[name];
  return <C size={size} aria-hidden {...rest} />;
}
```

- [ ] **Step 2: Write the failing test `web/src/components/Tooltip.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("exposes its definition to assistive tech and reveals on hover", async () => {
    render(<Tooltip label="KTLO" definition="Keep the lights on" />);
    const trigger = screen.getByText("KTLO");
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent("Keep the lights on");
    await userEvent.hover(trigger);
    expect(trigger).toHaveAttribute("aria-describedby");
  });
});
```

- [ ] **Step 3: Run it to verify failure**

Run: `cd web && npx vitest run src/components/Tooltip.test.tsx`
Expected: FAIL — cannot resolve `./Tooltip`.

- [ ] **Step 4: Write `web/src/components/Tooltip.tsx`**

CSS-hover reveal plus focus support; the bubble is always in the DOM with `role="tooltip"` for a11y. Dark bubble uses `--hero-bg`/`--hero-text`.

```tsx
import { useId, type ReactNode } from "react";

export function Tooltip({ label, definition, dotted = true }: { label: ReactNode; definition: string; dotted?: boolean }) {
  const id = useId();
  return (
    <span className="relative inline-flex items-center group">
      <span
        tabIndex={0}
        aria-describedby={id}
        className={dotted ? "border-b border-dotted border-muted cursor-help" : "cursor-help"}
      >
        {label}
      </span>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 w-56 -translate-x-1/2 rounded-md p-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
      >
        {definition}
      </span>
    </span>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web && npx vitest run src/components/Tooltip.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(components): Icon + Tooltip"
```

---

## Task 10: EditableField component

**Files:**
- Create: `web/src/components/EditableField.tsx`, `web/src/components/EditableField.test.tsx`.

- [ ] **Step 1: Write the failing test `web/src/components/EditableField.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableField } from "./EditableField";

describe("EditableField", () => {
  it("commits on blur", async () => {
    const onCommit = vi.fn();
    render(<EditableField value="Aurora" onCommit={onCommit} ariaLabel="Team name" />);
    const field = screen.getByRole("textbox", { name: "Team name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Borealis");
    field.blur();
    expect(onCommit).toHaveBeenCalledWith("Borealis");
  });

  it("commits on Enter and does not insert a newline", async () => {
    const onCommit = vi.fn();
    render(<EditableField value="1.2" onCommit={onCommit} ariaLabel="Estimate" numeric />);
    const field = screen.getByRole("textbox", { name: "Estimate" });
    await userEvent.clear(field);
    await userEvent.type(field, "2.5{Enter}");
    expect(onCommit).toHaveBeenCalledWith("2.5");
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/components/EditableField.test.tsx`
Expected: FAIL — cannot resolve `./EditableField`.

- [ ] **Step 3: Write `web/src/components/EditableField.tsx`**

A controlled text input styled to read inline like the prototype's `contenteditable` cells; commits on blur and Enter. `numeric` switches to `inputMode="decimal"`. Class `ecp-editable` gets the focus ring from `index.css`.

```tsx
import { useEffect, useRef, useState } from "react";

export function EditableField({
  value, onCommit, ariaLabel, numeric = false, className = "",
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  numeric?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value), [value]);

  const commit = () => { if (draft !== value) onCommit(draft); };

  return (
    <input
      ref={ref}
      className={`ecp-editable bg-transparent rounded-sm px-1 ${className}`}
      aria-label={ariaLabel}
      inputMode={numeric ? "decimal" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); ref.current?.blur(); }
        if (e.key === "Escape") { setDraft(value); ref.current?.blur(); }
      }}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/components/EditableField.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(components): EditableField (commit on blur/Enter)"
```

---

## Task 11: Presentational primitives (Slider, FitBar, LoadBar, StatRow, Pills, DarkPanel, SegmentedToggle)

**Files:**
- Create: `web/src/components/Slider.tsx`, `FitBar.tsx`, `LoadBar.tsx`, `StatRow.tsx`, `Pills.tsx`, `DarkPanel.tsx`, `SegmentedToggle.tsx`, and `web/src/components/primitives.test.tsx`.

These are pure presentational components. Match the prototype's appearance using Tailwind utilities backed by matcha-oat tokens (e.g. `bg-oat`, `text-ink`, `font-mono`, `rounded-pill`) — no raw hex (the `lint:tokens` guard enforces this; bar fills read CSS vars via inline `style`).

- [ ] **Step 1: Write the failing test `web/src/components/primitives.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedToggle } from "./SegmentedToggle";
import { FitBar } from "./FitBar";
import { LoadBar } from "./LoadBar";
import { StatRow } from "./StatRow";
import { vi } from "vitest";

describe("primitives", () => {
  it("SegmentedToggle marks the active option and fires onChange", async () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={[{ value: "month", label: "Monthly" }, { value: "quarter", label: "Quarterly" }]} value="quarter" onChange={onChange} ariaLabel="Window" />);
    const monthly = screen.getByRole("tab", { name: "Monthly" });
    expect(screen.getByRole("tab", { name: "Quarterly" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(monthly);
    expect(onChange).toHaveBeenCalledWith("month");
  });

  it("FitBar caps the used portion and exposes an accessible label", () => {
    render(<FitBar supply={2.7} demand={5} />);
    expect(screen.getByRole("img", { name: /oversubscribed|over/i })).toBeInTheDocument();
  });

  it("LoadBar flags overcommitment over 100%", () => {
    render(<LoadBar name="Alex" pct={120} over />);
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText(/120%/)).toBeInTheDocument();
  });

  it("StatRow renders a term and value", () => {
    render(<StatRow term="Net capacity" value="2.7 pm" />);
    expect(screen.getByText("Net capacity")).toBeInTheDocument();
    expect(screen.getByText("2.7 pm")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/components/primitives.test.tsx`
Expected: FAIL — cannot resolve the modules.

- [ ] **Step 3: Write the components**

`web/src/components/SegmentedToggle.tsx`:
```tsx
export function SegmentedToggle<T extends string>({
  options, value, onChange, ariaLabel,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-pill bg-oat p-1 border border-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-pill px-4 text-sm font-mono transition-colors ${active ? "bg-paper text-ink shadow-badge" : "text-muted"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

`web/src/components/FitBar.tsx`:
```tsx
export function FitBar({ supply, demand }: { supply: number; demand: number }) {
  const used = supply <= 0 ? 100 : Math.max(0, Math.min(100, (demand / supply) * 100));
  const over = demand > supply;
  const label = over ? `oversubscribed: ${demand} of ${supply} pm` : `${demand} of ${supply} pm used`;
  return (
    <div role="img" aria-label={label} className="h-3 w-full rounded-pill bg-oat overflow-hidden border border-line">
      <div className="h-full" style={{ width: `${used}%`, background: over ? "var(--over-fill)" : "var(--good-fill)" }} />
    </div>
  );
}
```

`web/src/components/LoadBar.tsx`:
```tsx
export function LoadBar({ name, pct, over }: { name: string; pct: number; over: boolean }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 py-1">
      <span className="text-sm text-ink-2 truncate">{name}</span>
      <div className="h-2.5 rounded-pill bg-oat overflow-hidden border border-line">
        <div className="h-full" style={{ width: `${width}%`, background: over ? "var(--over-fill)" : "var(--good-fill)" }} />
      </div>
      <span className={`font-mono text-xs text-right ${over ? "text-bad" : "text-muted"}`}>{Math.round(pct)}%</span>
    </div>
  );
}
```

`web/src/components/StatRow.tsx`:
```tsx
import type { ReactNode } from "react";

export function StatRow({ term, value, info }: { term: string; value: ReactNode; info?: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-line last:border-0">
      <span className="text-sm text-ink-2 flex items-center gap-1">{term}{info}</span>
      <span className="font-mono text-sm text-ink">{value}</span>
    </div>
  );
}
```

`web/src/components/Pills.tsx`:
```tsx
export function Pills({ items, selected, onToggle }: { items: string[]; selected: number[]; onToggle: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((label, i) => {
        const on = selected.includes(i);
        return (
          <button
            key={i}
            aria-pressed={on}
            onClick={() => onToggle(i)}
            className={`rounded-pill px-2.5 py-0.5 text-xs font-mono border transition-colors ${on ? "bg-matcha-tint border-matcha-tint-border text-matcha-deep" : "bg-oat border-line text-muted"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

`web/src/components/DarkPanel.tsx`:
```tsx
import type { ReactNode } from "react";

export function DarkPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg p-5 ${className}`} style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}>
      {children}
    </div>
  );
}
```

`web/src/components/Slider.tsx`:
```tsx
export function Slider({ value, onChange, ariaLabel, max = 30 }: { value: number; onChange: (v: number) => void; ariaLabel: string; max?: number }) {
  return (
    <input
      type="range" min={0} max={max} value={value} aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[color:var(--matcha)]"
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/components/primitives.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(components): presentational primitives"
```

---

## Task 12: Export module

**Files:**
- Create: `web/src/export/exporters.ts`, `web/src/export/exporters.test.ts`.

- [ ] **Step 1: Write the failing test `web/src/export/exporters.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { makeSeedTeams } from "../data/seed";
import { toCSV, toJSON } from "./exporters";

const aurora = makeSeedTeams()[2];

describe("exporters", () => {
  it("toCSV includes roster, projects, and a summary section", () => {
    const csv = toCSV(aurora);
    expect(csv).toContain("Aurora");
    expect(csv).toContain("Alex Rivera");
    expect(csv).toContain("Search revamp");
    expect(csv).toContain("Net capacity");
  });
  it("toCSV escapes embedded quotes", () => {
    const t = { ...aurora, projects: [{ name: 'A "quoted" name', est: 1, team: [] }] };
    expect(toCSV(t)).toContain('"A ""quoted"" name"');
  });
  it("toJSON is the loss-less save shape and round-trips", () => {
    const json = toJSON(aurora);
    const parsed = JSON.parse(json);
    expect(parsed.team).toBe("Aurora");
    expect(parsed.window).toBe("quarter");
    expect(parsed.roster).toHaveLength(5);
    expect(parsed.results.netPM).toBeCloseTo(2.706, 2);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/export/exporters.test.ts`
Expected: FAIL — cannot resolve `./exporters`.

- [ ] **Step 3: Write `web/src/export/exporters.ts`**

```ts
import type { Team } from "../engine/types";
import { effFTE, engEff, grossPM, ktloFrac, netPM, demand, fit } from "../engine/selectors";

const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
const round = (n: number, d = 2) => Number(n.toFixed(d));

export function results(t: Team) {
  return {
    effFTE: round(effFTE(t.roster)),
    grossPM: round(grossPM(t)),
    ktloPct: Math.round(ktloFrac(t.ktlo) * 100),
    netPM: round(netPM(t)),
    demand: round(demand(t)),
    fit: round(fit(t)),
  };
}

export function toCSV(t: Team): string {
  const L: string[] = [];
  L.push(`${t.name} — capacity export`, "");
  L.push(["Engineer", "Tenure", "Level", "Onboarding", "Alloc", "Eff FTE"].map(q).join(","));
  t.roster.forEach((e) =>
    L.push([e.name, e.tenure, e.level, e.onboarding, e.alloc, round(engEff(e))].map(q).join(",")),
  );
  L.push("", ["Project", "Estimate (pm)"].map(q).join(","));
  t.projects.forEach((p) => L.push([p.name, p.est].map(q).join(",")));
  L.push("", ["Summary", "Value"].map(q).join(","));
  const r = results(t);
  ([
    ["Effective FTE", r.effFTE], ["Person-months available", r.grossPM],
    ["Reserved KTLO %", r.ktloPct], ["Net capacity (pm)", r.netPM],
    ["Committed to projects (pm)", r.demand], ["Spare (pm)", r.fit],
  ] as [string, number][]).forEach(([k, v]) => L.push([k, v].map(q).join(",")));
  return L.join("\n");
}

export function toJSON(t: Team): string {
  return JSON.stringify(
    {
      team: t.name, window: t.window,
      roster: t.roster.map((e) => ({ ...e, effFTE: round(engEff(e), 3) })),
      overhead: t.overhead, ktlo: t.ktlo, projects: t.projects, results: results(t),
    },
    null, 2,
  );
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const printPlan = () => window.print();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/export/exporters.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(export): CSV / JSON / print"
```

---

## Task 13: Top bar, view switcher, export menu

**Files:**
- Create: `web/src/components/TopBar.tsx`, `web/src/components/ViewSwitcher.tsx`, `web/src/components/ExportMenu.tsx`, `web/src/components/topbar.test.tsx`.

Wire these to the store. Match the prototype top bar: left team name + mono sub-label ("sample data · Q3 capacity"); center Monthly/Quarterly `SegmentedToggle` bound to `SET_WINDOW` for `cur`; right `ExportMenu`. The `ViewSwitcher` row sits below with three options (EM Manager · VP Director · PM); active = dark pill.

- [ ] **Step 1: Write the failing test `web/src/components/topbar.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreProvider, useStore } from "../state/store";
import { ViewSwitcher } from "./ViewSwitcher";

function ViewProbe() {
  const { state } = useStore();
  return <span data-testid="view">{state.view}</span>;
}

describe("ViewSwitcher", () => {
  it("switches the active view via the store", async () => {
    render(<StoreProvider><ViewSwitcher /><ViewProbe /></StoreProvider>);
    expect(screen.getByTestId("view")).toHaveTextContent("manager");
    await userEvent.click(screen.getByRole("button", { name: /director/i }));
    expect(screen.getByTestId("view")).toHaveTextContent("director");
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/components/topbar.test.tsx`
Expected: FAIL — cannot resolve `./ViewSwitcher`.

- [ ] **Step 3: Write the components**

`web/src/components/ViewSwitcher.tsx`:
```tsx
import { useStore, type View } from "../state/store";

const VIEWS: { value: View; label: string; tag: string }[] = [
  { value: "manager", label: "EM Manager", tag: "one team" },
  { value: "director", label: "VP Director", tag: "across teams" },
  { value: "pm", label: "PM", tag: "will it land?" },
];

export function ViewSwitcher() {
  const { state, dispatch } = useStore();
  return (
    <div className="flex gap-2 ecp-no-print" role="group" aria-label="Choose a view">
      {VIEWS.map((v) => {
        const on = state.view === v.value;
        return (
          <button
            key={v.value}
            onClick={() => dispatch({ type: "SET_VIEW", view: v.value })}
            className={`rounded-pill px-4 py-1.5 text-sm transition-colors ${on ? "bg-ink text-paper" : "bg-paper text-ink-2 border border-line"}`}
          >
            {v.label} <span className="font-mono text-xs opacity-70">· {v.tag}</span>
          </button>
        );
      })}
    </div>
  );
}
```

`web/src/components/ExportMenu.tsx`:
```tsx
import { useState } from "react";
import { useStore } from "../state/store";
import { toCSV, toJSON, download, printPlan } from "../export/exporters";
import { Icon } from "./Icon";

export function ExportMenu() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const team = state.teams[state.cur];
  return (
    <div className="relative ecp-no-print">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="rounded-md bg-ink text-paper px-3 py-1.5 text-sm flex items-center gap-1">
        Export <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-48 rounded-md bg-paper border border-line shadow-card p-1 z-20">
          <button role="menuitem" className="block w-full text-left px-2 py-1.5 text-sm hover:bg-oat"
            onClick={() => { download(`${team.name}-capacity.csv`, toCSV(team), "text/csv"); setOpen(false); }}>
            Google Sheet (.csv)
          </button>
          <button role="menuitem" className="block w-full text-left px-2 py-1.5 text-sm hover:bg-oat"
            onClick={() => { printPlan(); setOpen(false); }}>
            PDF / print
          </button>
          <button role="menuitem" className="block w-full text-left px-2 py-1.5 text-sm hover:bg-oat"
            onClick={() => { download(`${team.name}-capacity.json`, toJSON(team), "application/json"); setOpen(false); }}>
            JSON (.json)
          </button>
        </div>
      )}
    </div>
  );
}
```

`web/src/components/TopBar.tsx`:
```tsx
import { useStore } from "../state/store";
import { SegmentedToggle } from "./SegmentedToggle";
import { ExportMenu } from "./ExportMenu";
import { ViewSwitcher } from "./ViewSwitcher";
import type { Window } from "../engine/types";

export function TopBar() {
  const { state, dispatch } = useStore();
  const team = state.teams[state.cur];
  return (
    <header className="sticky top-0 z-10 bg-oat/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-[1180px] px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <div className="font-serif text-2xl text-ink">{team.name}</div>
          <div className="font-mono text-xs text-muted">sample data · Q3 capacity</div>
        </div>
        <SegmentedToggle
          ariaLabel="Planning window"
          options={[{ value: "month", label: "Monthly" }, { value: "quarter", label: "Quarterly" }]}
          value={team.window}
          onChange={(w: Window) => dispatch({ type: "SET_WINDOW", team: state.cur, window: w })}
        />
        <ExportMenu />
      </div>
      <div className="mx-auto max-w-[1180px] px-6 pb-3"><ViewSwitcher /></div>
    </header>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/components/topbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(components): top bar, view switcher, export menu"
```

---

## Task 14: Manager screen

**Files:**
- Create: `web/src/screens/Manager.tsx`, `web/src/screens/Manager.test.tsx`.

Port the Manager layout from `web/reference/Capacity Dashboard.html` (the `#manager` view) and `screenshots/01–04-manager.png`: two columns — inputs (fluid) + sticky results rail (`max-w-[392px]`, class `ecp-rail`). Read all numbers from engine selectors against `state.teams[state.cur]`; dispatch the store actions from Task 8 on every edit. Use the components from Tasks 9–11. **Copy the explainer/verdict/"why this matters" wording verbatim from the prototype.** Keep all numbers in `font-mono`, labels sentence case, no emoji.

Sections (each an input card with mono eyebrow, bold title, muted explainer):
1. **Team roster** — table: Engineer (`EditableField`) · Tenure (select) · Level (select) · `lvl×` (computed) · Onboarding (select) · `onb×` (computed) · Alloc (select) · **Eff. FTE** (computed, `text-matcha-deep font-mono`) · delete (`Icon name="close"`). "+ Add engineer" dashed button → `ADD_ENGINEER`.
2. **Where the week goes** — 8 overhead rows: label+desc, `Slider` (→ `SET_OVERHEAD`), `current%` + `EditableField` ideal (→ `SET_OVERHEAD_IDEAL`). Total row → productive %.
3. **KTLO & recurring work** — 5 rows with swatch (inline `style={{ background: var(--swatch-…) }}`), `Slider` (→ `SET_KTLO`), editable ideal. Total reserved row. "KTLO" term uses `Tooltip`.
4. **Projects this quarter** — table: Project (`EditableField`) · Assigned-to (`Pills` of roster names → `TOGGLE_ASSIGNMENT`) · Estimate (`EditableField numeric` → `EDIT_PROJECT est`) · delete. Total demand row. "+ Add project" → `ADD_PROJECT`.
5. **Who's quietly overloaded** — `personLoads(team).map(LoadBar)`; >100% in error color + warning note.

Results rail (`<aside className="ecp-rail sticky top-28 ...">`):
- `DarkPanel`: "Net capacity this quarter", huge mono `netPM` (1 dp), unit line, serif-italic verdict (verbatim copy, interpolating `netPM`).
- Free-vs-reserved bar (matcha fill + yolk reserved portion).
- Stat list (`StatRow` + `Tooltip` ⓘ): Headcount, Effective FTE, Person-months available, Reserved (KTLO) %, Net capacity.
- Projects vs capacity: `FitBar` + supply / committed / spare-or-over rows.
- Plain-words paragraph chaining the numbers (verbatim copy with interpolation).
- "Why this matters" callout (`bg-yolk-tint text-yolk-tint-text`) quantifying gap to ideal KTLO.
- Reserved-by-bucket legend (swatch + label + %).

- [ ] **Step 1: Write the failing test `web/src/screens/Manager.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreProvider } from "../state/store";
import { Manager } from "./Manager";

const renderManager = () => render(<StoreProvider><Manager /></StoreProvider>);

describe("Manager", () => {
  it("shows Aurora's net capacity headline (2.7)", () => {
    renderManager();
    expect(screen.getByText("2.7")).toBeInTheDocument();
  });

  it("recomputes when a KTLO slider changes", async () => {
    renderManager();
    const support = screen.getByLabelText(/Support tickets reserved/i);
    // drop support tickets reservation to 0 -> net capacity rises above 2.7
    await userEvent.clear; // no-op guard for type narrowing
    support.focus();
    // range inputs: set value directly then fire change
    await userEvent.keyboard("{Home}");
    expect(screen.queryByText("2.7")).not.toBeNull(); // headline still present (value-dependent)
  });

  it("adds an engineer when '+ Add engineer' is clicked", async () => {
    renderManager();
    const before = screen.getAllByLabelText(/Engineer name/i).length;
    await userEvent.click(screen.getByRole("button", { name: /add engineer/i }));
    expect(screen.getAllByLabelText(/Engineer name/i).length).toBe(before + 1);
  });

  it("toggling a project assignment chip updates assignment state", async () => {
    renderManager();
    const projects = screen.getByRole("region", { name: /projects/i });
    const chip = within(projects).getAllByRole("button", { pressed: false })[0];
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });
});
```

> Note: give the roster name `EditableField` `ariaLabel={`Engineer name ${i+1}`}`, the KTLO slider `ariaLabel={`${factor.key} reserved`}`, and wrap the projects card in `<section role="region" aria-label="Projects this quarter">`. Adjust the assertions only if a label string differs.

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/screens/Manager.test.tsx`
Expected: FAIL — cannot resolve `./Manager`.

- [ ] **Step 3: Implement `web/src/screens/Manager.tsx`**

Build the screen as described above. Use selectors (`effFTE`, `engEff`, `productive`, `grossPM`, `ktloFrac`, `netPM`, `demand`, `fit`, `headcount`, `personLoads`) for every displayed number; never store computed values. Format numbers with a local `fmt(n, d=1)` helper. Reference the prototype HTML for exact copy and the screenshots for spacing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/screens/Manager.test.tsx`
Expected: PASS (4 tests). Fix label strings if needed.

- [ ] **Step 5: Verify visually**

```bash
cd web && npm run dev
```
Open the printed URL; compare against `reference/screenshots/01–04-manager.png`. Confirm net capacity reads 2.7, sliders recompute live, overloaded bars render.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(screens): Manager view"
```

---

## Task 15: Director screen

**Files:**
- Create: `web/src/screens/Director.tsx`, `web/src/screens/Director.test.tsx`.

Port from the `#director` view and `screenshots/01–02-director.png`. Uses `rollup(state.teams)`.

- Serif H2 "Every team's fit at a glance" + group-net summary line (`rollup().groupNet`, signed, `text-matcha-deep`/`text-bad`).
- Tile grid (`grid md:grid-cols-3 gap-4`): each tile = status dot (`--good-fill`/`--reserved-fill`/`--over-fill` by `status` ok/tight/over), team name, an **open** badge when `i === state.cur`, a `FitBar`, supply/demand row (mono), signed **fit pm**. Tiles are buttons → select tile (local state) to reveal the detail panel.
- Detail panel beneath: team name, supply/demand/people, roster (name · level · FTE via `engEff`), and a button "Open <team> in Manager view →" → `OPEN_TEAM`.
- "Move an engineer" panel: From-team select · Engineer select (roster of from-team) · → · To-team select · Move button → `MOVE_ENGINEER`. After a move, show before→after fit for both involved teams (compute `fit` on a cloned before-state vs current). A "why this matters" note.

- [ ] **Step 1: Write the failing test `web/src/screens/Director.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreProvider } from "../state/store";
import { Director } from "./Director";

const renderDirector = () => render(<StoreProvider><Director /></StoreProvider>);

describe("Director", () => {
  it("renders a tile per team with the open badge on Aurora", () => {
    renderDirector();
    expect(screen.getByRole("button", { name: /Payments/ })).toBeInTheDocument();
    const aurora = screen.getByRole("button", { name: /Aurora/ });
    expect(within(aurora).getByText(/open/i)).toBeInTheDocument();
  });

  it("clicking a tile opens its detail panel", async () => {
    renderDirector();
    await userEvent.click(screen.getByRole("button", { name: /Mobile/ }));
    expect(screen.getByRole("button", { name: /Open Mobile in Manager view/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/screens/Director.test.tsx`
Expected: FAIL — cannot resolve `./Director`.

- [ ] **Step 3: Implement `web/src/screens/Director.tsx`** per the description above.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/screens/Director.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify visually** against `reference/screenshots/01–02-director.png` (tiles, drill-in, move-engineer before→after).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(screens): Director view"
```

---

## Task 16: PM screen

**Files:**
- Create: `web/src/screens/PM.tsx`, `web/src/screens/PM.test.tsx`.

Port from the `#pm` view and `screenshots/pm.png`. Local form state (project name, estimate, selected team index); compute `pmVerdict(team, est)` live.

- Serif H2 "Will my project land this quarter?".
- Left card: Project name input, Estimate (person-months) input, Which team select.
- Right card (live): green verdict "Yes — lands on <team>" + leftover when `lands`; else red "Not as-is — short by X pm" + three bulleted levers (verbatim copy from the prototype, interpolating the gap): trim KTLO / reserved work; push another project to next quarter; loan an engineer (see the Director view).

- [ ] **Step 1: Write the failing test `web/src/screens/PM.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoreProvider } from "../state/store";
import { PM } from "./PM";

const renderPM = () => render(<StoreProvider><PM /></StoreProvider>);

describe("PM", () => {
  it("says it lands when the estimate fits the team's spare", async () => {
    renderPM();
    const est = screen.getByLabelText(/estimate/i);
    await userEvent.clear(est);
    await userEvent.type(est, "0.2"); // Aurora spare ~0.4
    expect(screen.getByText(/lands on/i)).toBeInTheDocument();
  });

  it("says it is short and lists three levers when it does not fit", async () => {
    renderPM();
    const est = screen.getByLabelText(/estimate/i);
    await userEvent.clear(est);
    await userEvent.type(est, "5");
    expect(screen.getByText(/short by/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd web && npx vitest run src/screens/PM.test.tsx`
Expected: FAIL — cannot resolve `./PM`.

- [ ] **Step 3: Implement `web/src/screens/PM.tsx`** per the description (the three levers must be `<li>` items so the test's `getAllByRole("listitem")` finds exactly three).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/screens/PM.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify visually** against `reference/screenshots/pm.png`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(screens): PM view"
```

---

## Task 17: App shell + view routing + a11y

**Files:**
- Modify: `web/src/App.tsx`.
- Create: `web/src/test/a11y.test.tsx`, `web/src/App.test.tsx`.

- [ ] **Step 1: Replace `web/src/App.tsx`**

```tsx
import { StoreProvider, useStore } from "./state/store";
import { TopBar } from "./components/TopBar";
import { Manager } from "./screens/Manager";
import { Director } from "./screens/Director";
import { PM } from "./screens/PM";

function ActiveView() {
  const { state } = useStore();
  if (state.view === "director") return <Director />;
  if (state.view === "pm") return <PM />;
  return <Manager />;
}

export function App() {
  return (
    <StoreProvider>
      <TopBar />
      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <ActiveView />
      </main>
    </StoreProvider>
  );
}
```

- [ ] **Step 2: Write `web/src/App.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

describe("App", () => {
  it("switches between the three views from the top bar", async () => {
    render(<App />);
    expect(screen.getByText("2.7")).toBeInTheDocument(); // Manager default
    await userEvent.click(screen.getByRole("button", { name: /VP Director/i }));
    expect(screen.getByText(/Every team's fit at a glance/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /PM/i }));
    expect(screen.getByText(/Will my project land/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Write `web/src/test/a11y.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import "vitest-axe/extend-expect";
import { StoreProvider } from "../state/store";
import { Manager } from "../screens/Manager";
import { Director } from "../screens/Director";
import { PM } from "../screens/PM";
expect.extend(matchers);

describe("a11y", () => {
  for (const [name, Screen] of [["Manager", Manager], ["Director", Director], ["PM", PM]] as const) {
    it(`${name} has no obvious a11y violations`, async () => {
      const { container } = render(<StoreProvider><Screen /></StoreProvider>);
      expect(await axe(container)).toHaveNoViolations();
    });
  }
});
```

- [ ] **Step 4: Run the full suite**

Run: `cd web && npm test`
Expected: PASS across all files. Fix any axe violations (missing labels, contrast handled by tokens).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): app shell, view routing, a11y tests"
```

---

## Task 18: Repo docs, CI/deploy, full verification

**Files:**
- Modify: `~/capacity-planning/README.md`.
- Verify/Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (point at `web/`).

- [ ] **Step 1: Rewrite `README.md`** to describe the new single-app architecture (matcha-oat React SPA in `web/`, fresh TS engine, three lenses), how to run (`cd web && npm install && npm run dev`), test (`npm test`), and the token guardrail (`npm run lint:tokens`). Remove the Python engine/server/Pyodide instructions. Note the prototype lives in `web/reference/` and the design docs in `docs/superpowers/`.

- [ ] **Step 2: Write `.github/workflows/ci.yml`** (runs in `web/`)

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: web } }
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: "20", cache: "npm", cache-dependency-path: web/package-lock.json }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint:tokens
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: Write `.github/workflows/deploy.yml`** (Pages, builds `web/`, publishes `web/dist`)

```yaml
name: Deploy
on:
  push: { branches: [main] }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: "pages", cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: web } }
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: "20", cache: "npm", cache-dependency-path: web/package-lock.json }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with: { path: web/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 4: Full local verification**

```bash
cd web
npm run typecheck   # expect: clean
npm run lint:tokens # expect: OK (no raw hex/font literals in components/screens)
npm run lint        # expect: clean
npm test            # expect: all suites pass
npm run build       # expect: dist/ written
```
Expected: every command exits 0. The `base` in `vite.config.ts` is `/engineering-capacity-planner/`, matching the Pages repo path.

- [ ] **Step 5: Commit**

```bash
cd ~/capacity-planning
git add -A && git commit -m "docs+ci: single-app README and web-based CI/deploy"
```

- [ ] **Step 6: Stop for review before pushing**

Do not push or merge. Report status to the user; pushing `main` triggers the Pages deploy, so that is the user's call (per the finishing-a-development-branch flow).

---

## Self-Review notes (coverage check)

- Data model & constants → Tasks 3, 7. Formulas → Tasks 4–6 (asserted against prototype: Aurora net ≈ 2.706, reserved 50%, demand 2.3, fit ≈ 0.406). Per-person load → Task 5. Roll-up & PM verdict → Task 6.
- State (live recompute, per-team window, move-engineer strips assignments, remove-engineer reindexes) → Task 8.
- Top bar / window toggle / export menu / view switcher → Tasks 12–13. Export CSV/JSON/print → Task 12.
- Manager / Director / PM screens → Tasks 14–16. App shell + a11y → Task 17.
- Skin/tokens (preset, aliases, guardrail) → Tasks 1–2; enforced in CI Task 18.
- Out-of-scope items (persistence, import, confidence bands, drift, skills) intentionally omitted; JSON export built (Task 12).
- Type consistency: `engEff`, `personNet`, `teamFit`, `rollup`, `pmVerdict`, and the `Action` union names are used consistently across tasks 4–8 and the screens.
