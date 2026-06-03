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
