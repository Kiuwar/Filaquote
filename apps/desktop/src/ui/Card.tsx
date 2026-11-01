import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function Card({ title, description, actions, className, children, ...rest }: CardProps) {
  return (
    <section
      className={cn("rounded-card border border-line bg-surface p-5 shadow-soft", className)}
      {...rest}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
