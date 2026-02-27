import { bundle, useUiStore } from "./state";
import { Title } from "./screens/Title";
import { Main } from "./screens/Main";
import { Store } from "./screens/Store";
import { Company } from "./screens/Company";

export function App() {
  const screen = useUiStore((state) => state.screen);

  if (screen === "title") {
    return <Title title={bundle.strings.title} subtitle={bundle.strings.subtitle} />;
  }

  if (screen === "store") {
    return <Store />;
  }

  if (screen === "company") {
    return <Company />;
  }

  return <Main />;
}