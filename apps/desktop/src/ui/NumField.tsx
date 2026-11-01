import type { ReactNode } from "react";
import { Field } from "./Field";
import { NumberInput } from "./NumberInput";

/** Rótulo + campo numérico + unidade + dica. */
export function NumField({
  label,
  unit,
  hint,
  value,
  onChange,
  min = 0,
  max,
  integer,
  prefix,
}: {
  label: ReactNode;
  unit?: string;
  hint?: ReactNode;
  value: number | null;
  onChange(value: number | null): void;
  min?: number;
  max?: number;
  integer?: boolean;
  prefix?: ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      {({ id, describedBy }) => (
        <NumberInput
          id={id}
          aria-describedby={describedBy}
          value={value}
          onChange={onChange}
          suffix={unit}
          prefix={prefix}
          min={min}
          max={max}
          integer={integer}
        />
      )}
    </Field>
  );
}
