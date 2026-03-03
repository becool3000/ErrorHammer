import { SegmentedControl } from "../components/SegmentedControl";
import { UiTextScale, useUiStore } from "../state";

const textScaleOptions: Array<{ id: UiTextScale; label: string }> = [
  { id: "xsmall", label: "XS" },
  { id: "default", label: "Default" },
  { id: "large", label: "Large" },
  { id: "xlarge", label: "XL" }
];

export function SettingsTab() {
  const uiTextScale = useUiStore((state) => state.uiTextScale);
  const setUiTextScale = useUiStore((state) => state.setUiTextScale);

  return (
    <section className="stack-block">
      <article className="chrome-card inset-card company-settings-card">
        <div className="text-size-control">
          <p className="eyebrow">Text Size</p>
          <SegmentedControl value={uiTextScale} options={textScaleOptions} onChange={setUiTextScale} label="Text size" />
          <p className="muted-copy">Pinch with two fingers to zoom HUD sections when you need detail.</p>
        </div>
      </article>
    </section>
  );
}
