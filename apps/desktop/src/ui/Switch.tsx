import { Switch as RadixSwitch } from "radix-ui";
import { useId, type ReactNode } from "react";

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-line bg-surface-2 transition-colors duration-(--fq-dur) ease-fq data-[state=checked]:border-transparent data-[state=checked]:bg-primary"
      >
        <RadixSwitch.Thumb className="block h-[18px] w-[18px] translate-x-[2px] rounded-full bg-white shadow-raised transition-transform duration-(--fq-dur) ease-fq data-[state=checked]:translate-x-[22px]" />
      </RadixSwitch.Root>
    </div>
  );
}
