interface SegmentedControlOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<SegmentedControlOption<T>>;
  onChange: (value: T) => void;
  label: string;
  testIdPrefix?: string;
}

export function SegmentedControl<T extends string>({ value, options, onChange, label, testIdPrefix }: SegmentedControlProps<T>) {
  const prefix = testIdPrefix ?? `segmented-${toTestIdToken(label)}`;
  return (
    <div className="segmented-control" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          className={option.id === value ? "segment active" : "segment"}
          onClick={() => onChange(option.id)}
          role="tab"
          aria-selected={option.id === value}
          aria-label={option.label}
          data-testid={`${prefix}-${option.id}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function toTestIdToken(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
