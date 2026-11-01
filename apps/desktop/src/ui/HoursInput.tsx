import { NumberInput } from "./NumberInput";

/** Tempo em horas e minutos; guarda horas decimais (`null` = a confirmar). */
export function HoursInput({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange(v: number | null): void;
  label: string;
}) {
  const total = value === null ? null : Math.round(value * 60);
  const h = total === null ? null : Math.floor(total / 60);
  const m = total === null ? null : total % 60;
  const update = (hours: number | null, minutes: number | null) => {
    if (hours === null && minutes === null) return onChange(null);
    onChange((hours ?? 0) + (minutes ?? 0) / 60);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberInput
        aria-label={`${label}: horas`}
        value={h}
        integer
        onChange={(v) => update(v, m)}
        suffix="h"
      />
      <NumberInput
        aria-label={`${label}: minutos`}
        value={m}
        integer
        max={59}
        onChange={(v) => update(h, v)}
        suffix="min"
      />
    </div>
  );
}
