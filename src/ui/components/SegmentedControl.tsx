interface SegmentedControlOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<SegmentedControlOption<T>>;
  onChange: (value: T) => void;
  label: string;
}

export function SegmentedControl<T extends string>({ value, options, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div className="segmented-control" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          className={option.id === value ? "segment active" : "segment"}
          onClick={() => onChange(option.id)}
          role="tab"
          aria-selected={option.id === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
