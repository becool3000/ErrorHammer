import { useEffect } from "react";
import { bundle, useUiStore } from "./state";
import { Title } from "./screens/Title";
import { GameShell } from "./screens/GameShell";

export function App() {
  const screen = useUiStore((state) => state.screen);
  const uiTextScale = useUiStore((state) => state.uiTextScale);
  const hydrateUiPrefs = useUiStore((state) => state.hydrateUiPrefs);

  useEffect(() => {
    hydrateUiPrefs();
  }, [hydrateUiPrefs]);

  return (
    <div className="app-root" data-text-scale={uiTextScale}>
      {screen === "title" ? <Title title={bundle.strings.title} subtitle={bundle.strings.subtitle} /> : <GameShell />}
    </div>
  );
}
