import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}

/** Rótulo + controle + dica/erro, com ids de acessibilidade ligados. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children({ id, describedBy })}
      {(error || hint) && (
        <p id={hintId} className={cn("text-xs", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, invalid, className, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-control border bg-surface-2 px-3",
        "transition-[border-color,box-shadow] duration-(--fq-dur-fast) ease-fq",
        "focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--fq-primary-soft)]",
        invalid ? "border-danger" : "border-line hover:border-muted/50",
        className,
      )}
    >
      {prefix && <span className="text-[13px] text-muted">{prefix}</span>}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
        {...rest}
      />
      {suffix && <span className="text-[13px] text-muted">{suffix}</span>}
    </div>
  );
});
