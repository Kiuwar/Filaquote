import { HexColorPicker } from "react-colorful";
import { Popover } from "radix-ui";
import { useState } from "react";
import { normalizeHex } from "../theme/color";
import { Input } from "./Field";

/** Seletor de cor próprio: amostra + popover com área de cor e campo hexadecimal. */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  // Rascunho do campo hexadecimal; volta a acompanhar `value` quando ele muda por fora.
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const commitDraft = () => {
    const hex = normalizeHex(draft);
    if (hex) onChange(hex);
    else setDraft(value);
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`${label}: ${value}`}
        className="group flex h-10 w-full cursor-pointer items-center gap-3 rounded-control border border-line bg-surface-2 px-2 transition-colors duration-(--fq-dur-fast) hover:border-muted/50 data-[state=open]:border-primary"
      >
        <span
          className="h-7 w-7 rounded-[8px] border border-black/10 shadow-soft"
          style={{ background: value }}
        />
        <span className="text-sm font-medium">{label}</span>
        <span className="ml-auto font-mono text-xs text-muted uppercase">{value}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-50 w-[248px] animate-pop-in rounded-card border border-line bg-surface p-3 shadow-float"
        >
          <div className="fq-color-picker">
            <HexColorPicker color={value} onChange={onChange} />
          </div>
          <div className="mt-3">
            <Input
              aria-label={`${label} em hexadecimal`}
              value={draft}
              prefix="HEX"
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDraft();
              }}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
