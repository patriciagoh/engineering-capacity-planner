import { useState } from "react";
import { ManagerView } from "./pages/ManagerView";
import { DirectorView } from "./pages/DirectorView";

type Persona = "manager" | "director";

export default function App() {
  const [persona, setPersona] = useState<Persona>("manager");
  return (
    <div className="app">
      <header className="topbar">
        <h1>Capacity Planning</h1>
        <div className="segmented" role="group" aria-label="View">
          <button aria-pressed={persona === "manager"} onClick={() => setPersona("manager")}>Manager</button>
          <button aria-pressed={persona === "director"} onClick={() => setPersona("director")}>Director</button>
        </div>
      </header>
      {persona === "manager" ? <ManagerView /> : <DirectorView />}
    </div>
  );
}
