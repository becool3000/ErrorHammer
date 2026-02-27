import { useUiStore } from "../state";

interface TitleProps {
  title: string;
  subtitle: string;
}

export function Title({ title, subtitle }: TitleProps) {
  const newGame = useUiStore((state) => state.newGame);
  const continueGame = useUiStore((state) => state.continueGame);
  const notice = useUiStore((state) => state.notice);

  return (
    <main className="screen title-screen">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div className="stack-row">
        <button onClick={() => newGame()}>New Game</button>
        <button onClick={() => continueGame()}>Continue</button>
      </div>
      {notice ? <p className="notice">{notice}</p> : null}
    </main>
  );
}