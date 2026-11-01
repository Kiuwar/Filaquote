import { forwardRef, useState, type ReactNode } from "react";
import { Input } from "./Field";

const display = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6, useGrouping: false });

/** Lê "1,5", "1.5" ou "R$ 1.234,56". Vazio = `null` ("a confirmar"). */
export function parseDecimal(text: string): number | null | "invalid" {
  const t = text
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (t === "") return null;
  // Com vírgula, o ponto é separador de milhar; sem vírgula, o ponto é decimal.
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return "invalid";
  const n = Number(normalized);
  return Number.isFinite(n) ? n : "invalid";
}

export function formatDecimal(value: number | null): string {
  return value === null ? "" : display.format(value);
}

interface NumberInputProps {
  id?: string;
  value: number | null;
  onChange(value: number | null): void;
  prefix?: ReactNode;
  suffix?: ReactNode;
  placeholder?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
  disabled?: boolean;
}

/** Campo numérico em português: aceita vírgula, mostra "a confirmar" quando vazio. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onChange, min, max, integer, placeholder = "a confirmar", ...rest },
  ref,
) {
  const [text, setText] = useState(formatDecimal(value));
  const [lastValue, setLastValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  if (value !== lastValue) {
    setLastValue(value);
    setText(formatDecimal(value));
  }

  const commit = (raw: string) => {
    const parsed = parseDecimal(raw);
    if (parsed === "invalid") return setError("Número inválido");
    if (parsed !== null) {
      if (min !== undefined && parsed < min) return setError(`Mínimo ${formatDecimal(min)}`);
      if (max !== undefined && parsed > max) return setError(`Máximo ${formatDecimal(max)}`);
      if (integer && !Number.isInteger(parsed)) return setError("Use um número inteiro");
    }
    setError(null);
    setLastValue(parsed);
    onChange(parsed);
  };

  return (
    <div>
      <Input
        ref={ref}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        invalid={error !== null}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => error === null && setText(formatDecimal(lastValue))}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});
