import { bundle, useUiStore } from "./state";
import { Title } from "./screens/Title";
import { GameShell } from "./screens/GameShell";

export function App() {
  const screen = useUiStore((state) => state.screen);

  if (screen === "title") {
    return <Title title={bundle.strings.title} subtitle={bundle.strings.subtitle} />;
  }

  return <GameShell />;
}
