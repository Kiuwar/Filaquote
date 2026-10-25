import { Check, ChevronDown } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import { cn } from "./cn";

export interface SelectOption {
  value: string;
  label: string;
}

/** Lista suspensa própria (não usa o <select> nativo do Windows). */
export function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  "aria-describedby": describedBy,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  "aria-describedby"?: string;
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        id={id}
        aria-describedby={describedBy}
        className={cn(
          "inline-flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-control border border-line bg-surface-2 px-3 text-sm",
          "transition-[border-color,box-shadow] duration-(--fq-dur-fast) ease-fq hover:border-muted/50",
          "data-[state=open]:border-primary data-[state=open]:shadow-[0_0_0_3px_var(--fq-primary-soft)]",
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={16} className="text-muted" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-(--radix-select-trigger-width) animate-pop-in overflow-hidden rounded-control border border-line bg-surface p-1 shadow-float"
        >
          <RadixSelect.Viewport>
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="relative flex h-9 cursor-pointer items-center rounded-[9px] pr-3 pl-8 text-sm outline-none select-none data-highlighted:bg-primary-soft"
              >
                <RadixSelect.ItemIndicator className="absolute left-2.5">
                  <Check size={14} />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
