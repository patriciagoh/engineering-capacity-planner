/* eslint-disable react-refresh/only-export-components --
   Test-only helper: co-locates a tiny ReadyGate component with the async
   renderSeeded() utility. Fast-refresh does not apply to test modules. */
import { render, type RenderResult } from "@testing-library/react";
import { act } from "react";
import type { ReactElement, ReactNode } from "react";
import { StoreProvider, useStore } from "../state/store";
import { LocalPort } from "../storage/localPort";

function ReadyGate({ children }: { children: ReactNode }) {
  const { state } = useStore();
  return state.status === "ready" ? <>{children}</> : null;
}

// Mounts `ui` only after hydration completes, mirroring production where screens
// render only inside the ready App `Shell` — so screens never see the empty loading frame.
export async function renderSeeded(ui: ReactElement): Promise<RenderResult> {
  let result!: RenderResult;
  await act(async () => {
    result = render(
      <StoreProvider port={new LocalPort()}>
        <ReadyGate>{ui}</ReadyGate>
      </StoreProvider>,
    );
  });
  return result;
}
