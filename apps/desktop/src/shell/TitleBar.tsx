import { Copy, Minus, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { windowControls } from "../platform/tauri";
import { cn } from "../ui/cn";
import { Logo } from "./Logo";
import { useMaximized } from "./useMaximized";

function WindowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-full w-12 cursor-pointer items-center justify-center text-muted",
        "transition-colors duration-(--fq-dur-fast) ease-fq",
        danger ? "hover:bg-[#e81123] hover:text-white" : "hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Barra de título própria. A área com `data-tauri-drag-region` arrasta a janela e
 * o duplo clique maximiza; os filhos decorativos usam pointer-events-none para não
 * bloquear o arraste.
 */
export function TitleBar({ subtitle }: { subtitle?: string }) {
  const maximized = useMaximized();

  return (
    <header
      data-tauri-drag-region
      className="flex h-(--fq-titlebar-h) shrink-0 items-center border-b border-line bg-surface/80 backdrop-blur"
    >
      <div className="pointer-events-none flex items-center gap-2.5 pl-4">
        <Logo />
        <span className="text-[13px] font-semibold tracking-tight">Filaquote</span>
        {subtitle && (
          <>
            <span className="text-muted/60">/</span>
            <span className="text-[13px] text-muted">{subtitle}</span>
          </>
        )}
      </div>
      <div className="ml-auto flex h-full">
        <WindowButton label="Minimizar" onClick={() => void windowControls.minimize()}>
          <Minus size={16} strokeWidth={1.75} />
        </WindowButton>
        <WindowButton
          label={maximized ? "Restaurar" : "Maximizar"}
          onClick={() => void windowControls.toggleMaximize()}
        >
          {maximized ? (
            <Copy size={13} strokeWidth={1.75} />
          ) : (
            <Square size={13} strokeWidth={1.75} />
          )}
        </WindowButton>
        <WindowButton label="Fechar" danger onClick={() => void windowControls.close()}>
          <X size={17} strokeWidth={1.75} />
        </WindowButton>
      </div>
    </header>
  );
}
