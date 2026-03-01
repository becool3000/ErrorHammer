import { bundle, useUiStore } from "../state";

interface TitleProps {
  title: string;
  subtitle: string;
}

export function Title({ title, subtitle }: TitleProps) {
  const newGame = useUiStore((state) => state.newGame);
  const continueGame = useUiStore((state) => state.continueGame);
  const notice = useUiStore((state) => state.notice);
  const playerName = useUiStore((state) => state.titlePlayerName);
  const companyName = useUiStore((state) => state.titleCompanyName);
  const setPlayerName = useUiStore((state) => state.setTitlePlayerName);
  const setCompanyName = useUiStore((state) => state.setTitleCompanyName);

  const ready = Boolean(playerName.trim() && companyName.trim());

  return (
    <main className="title-shell">
      <section className="title-panel chrome-card">
        <p className="eyebrow">Field Ops Ledger</p>
        <h1>{title}</h1>
        <p className="title-copy">{subtitle}</p>
        <div className="title-inputs">
          <label>
            <span>{bundle.strings.titlePlayerLabel}</span>
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder={bundle.strings.titlePlayerPlaceholder}
            />
          </label>
          <label>
            <span>{bundle.strings.titleCompanyLabel}</span>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder={bundle.strings.titleCompanyPlaceholder}
            />
          </label>
        </div>
        <p className="muted-copy">{bundle.strings.titleNameHint}</p>
        <div className="title-actions">
          <button
            className="primary-button"
            onClick={() => newGame(playerName.trim(), companyName.trim())}
            disabled={!ready}
          >
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
