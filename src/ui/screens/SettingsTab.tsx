import { useState } from "react";
import { SegmentedControl } from "../components/SegmentedControl";
import { releaseInfo } from "../releaseInfo";
import { TutorialMode, UiFxMode, UiTextScale, useUiStore } from "../state";

const textScaleOptions: Array<{ id: UiTextScale; label: string }> = [
  { id: "xsmall", label: "XS" },
  { id: "default", label: "Default" },
  { id: "large", label: "Large" },
  { id: "xlarge", label: "XL" }
];

const fxModeOptions: Array<{ id: UiFxMode; label: string }> = [
  { id: "full", label: "Full FX" },
  { id: "reduced", label: "Reduced FX" }
];

export function SettingsTab() {
  const uiTextScale = useUiStore((state) => state.uiTextScale);
  const setUiTextScale = useUiStore((state) => state.setUiTextScale);
  const uiFxMode = useUiStore((state) => state.uiFxMode);
  const setUiFxMode = useUiStore((state) => state.setUiFxMode);
  const tutorialCompleted = useUiStore((state) => state.tutorialCompleted);
  const tutorialInProgress = useUiStore((state) => state.tutorialInProgress);
  const startTutorial = useUiStore((state) => state.startTutorial);
  const resumeTutorial = useUiStore((state) => state.resumeTutorial);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const builtAtLabel = releaseInfo.builtAtUtc ? new Date(releaseInfo.builtAtUtc).toUTCString() : "Local build";
  const tutorialButtonLabel = tutorialInProgress ? "Resume Tutorial" : tutorialCompleted ? "Replay Tutorial" : "Tutorial";

  function launchTutorial(mode: TutorialMode) {
    startTutorial(mode);
    setModePickerOpen(false);
  }

  return (
    <section className="stack-block">
      <article className="chrome-card inset-card company-settings-card">
        <div className="text-size-control">
          <p className="eyebrow">Text Size</p>
          <SegmentedControl value={uiTextScale} options={textScaleOptions} onChange={setUiTextScale} label="Text size" />
          <p className="muted-copy">Pinch with two fingers to zoom HUD sections when you need detail.</p>
        </div>
        <div className="text-size-control">
          <p className="eyebrow">FX Intensity</p>
          <SegmentedControl value={uiFxMode} options={fxModeOptions} onChange={setUiFxMode} label="Effects mode" />
          <p className="muted-copy">Reduced FX keeps core feedback and removes heavy completion overlays.</p>
        </div>
        <div className="text-size-control release-info-card">
          <p className="eyebrow">Build Info</p>
          <div className="metric-grid two-up">
            <span>Version {releaseInfo.appVersion}</span>
            <span>Build {releaseInfo.buildId}</span>
            <span>Release {releaseInfo.releaseLabel}</span>
            <span>Commit {releaseInfo.gitCommit}</span>
          </div>
          <p className="muted-copy">Built {builtAtLabel}</p>
        </div>
        <div className="text-size-control">
          <p className="eyebrow">Tutorial</p>
          <div className="action-row">
            <button
              className="ghost-button"
              aria-label="Tutorial"
              data-testid="settings-tutorial-button"
              onClick={() => {
                if (tutorialInProgress) {
                  resumeTutorial();
                  return;
                }
                setModePickerOpen((open) => !open);
              }}
            >
              {tutorialButtonLabel}
            </button>
          </div>
          {modePickerOpen ? (
            <div className="settings-tutorial-picker stack-list">
              <p className="muted-copy">Pick how you want to run onboarding.</p>
              <div className="action-row">
                <button className="primary-button" onClick={() => launchTutorial("fresh-guided")}>
                  Fresh guided run
                </button>
                <button className="ghost-button" data-testid="settings-tutorial-current-save" onClick={() => launchTutorial("current-save")}>
                  Use current save
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}
