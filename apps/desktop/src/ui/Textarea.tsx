import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-20 w-full rounded-control border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none",
        "transition-[border-color,box-shadow] duration-(--fq-dur-fast) ease-fq placeholder:text-muted/70",
        "hover:border-muted/50 focus:border-primary focus:shadow-[0_0_0_3px_var(--fq-primary-soft)]",
        className,
      )}
      {...rest}
    />
  );
});
