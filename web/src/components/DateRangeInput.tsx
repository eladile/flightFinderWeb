type Props = {
  fromLabel: string;
  toLabel: string;
  fromValue: string;
  toValue: string;
  onChange: (from: string, to: string) => void;
  min?: string;
  disabled?: boolean;
};

export default function DateRangeInput({
  fromLabel,
  toLabel,
  fromValue,
  toValue,
  onChange,
  min,
  disabled,
}: Props) {
  const hasError = fromValue !== '' && toValue !== '' && toValue < fromValue;
  const borderClass = hasError ? 'border-red-500' : 'border-gray-300';

  return (
    <div>
      <div className="flex gap-3">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-gray-700">{fromLabel}</span>
          <input
            type="date"
            value={fromValue}
            min={min}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value, toValue)}
            className={`w-full rounded border ${borderClass} px-2 py-1.5 disabled:bg-gray-100`}
          />
        </label>
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-gray-700">{toLabel}</span>
          <input
            type="date"
            value={toValue}
            min={min}
            disabled={disabled}
            onChange={(e) => onChange(fromValue, e.target.value)}
            className={`w-full rounded border ${borderClass} px-2 py-1.5 disabled:bg-gray-100`}
          />
        </label>
      </div>
      {hasError && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          End date must be on or after start date.
        </p>
      )}
    </div>
  );
}
