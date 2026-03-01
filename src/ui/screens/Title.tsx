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
    <main className="title-shell">
      <section className="title-panel chrome-card">
        <p className="eyebrow">Field Ops Ledger</p>
        <h1>{title}</h1>
        <p className="title-copy">{subtitle}</p>
        <div className="title-actions">
          <button className="primary-button" onClick={() => newGame()}>
            New Game
          </button>
          <button className="ghost-button" onClick={() => continueGame()}>
            Continue
          </button>
        </div>
        <div className="title-grid" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {notice ? <p className="notice-banner">{notice}</p> : null}
      </section>
    </main>
  );
}
