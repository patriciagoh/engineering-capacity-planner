import { useState } from "react";
import { ManagerView } from "./pages/ManagerView";
import { DirectorView } from "./pages/DirectorView";

type Persona = "manager" | "director";

export default function App() {
  const [persona, setPersona] = useState<Persona>("manager");
  return (
    <div>
      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ display: "inline-block", marginRight: "1rem" }}>Capacity Planning</h1>
        <button onClick={() => setPersona("manager")} disabled={persona === "manager"}>Manager</button>{" "}
        <button onClick={() => setPersona("director")} disabled={persona === "director"}>Director</button>
      </header>
      {persona === "manager" ? <ManagerView /> : <DirectorView />}
    </div>
  );
}
