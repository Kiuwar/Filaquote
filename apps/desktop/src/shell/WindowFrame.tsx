import type { ReactNode } from "react";
import { getFrameMode, windowControls, type ResizeDirection } from "../platform/tauri";
import { cn } from "../ui/cn";
import { useMaximized } from "./useMaximized";

const HANDLES: ReadonlyArray<{ dir: ResizeDirection; className: string }> = [
  { dir: "North", className: "top-0 left-6 right-6 h-(--fq-frame-gap) cursor-ns-resize" },
  { dir: "South", className: "bottom-0 left-6 right-6 h-(--fq-frame-gap) cursor-ns-resize" },
  { dir: "West", className: "left-0 top-6 bottom-6 w-(--fq-frame-gap) cursor-ew-resize" },
  { dir: "East", className: "right-0 top-6 bottom-6 w-(--fq-frame-gap) cursor-ew-resize" },
  { dir: "NorthWest", className: "top-0 left-0 h-6 w-6 cursor-nwse-resize" },
  { dir: "SouthEast", className: "bottom-0 right-0 h-6 w-6 cursor-nwse-resize" },
  { dir: "NorthEast", className: "top-0 right-0 h-6 w-6 cursor-nesw-resize" },
  { dir: "SouthWest", className: "bottom-0 left-0 h-6 w-6 cursor-nesw-resize" },
];

/**
 * Moldura da janela.
 * - Modo `css` (Windows 10): a janela nativa é transparente; esta div é a "janela"
 *   visível, com cantos arredondados e sombra. A margem transparente em volta
 *   (--fq-frame-gap) serve de alça para redimensionar. Maximizada, ocupa tudo e
 *   perde o arredondamento, como no Windows.
 * - Modo `native` (Windows 11): o sistema arredonda e desenha a sombra.
 */
export function WindowFrame({ children }: { children: ReactNode }) {
  const mode = getFrameMode();
  const maximized = useMaximized();
  const drawn = mode === "css" && !maximized;

  return (
    <>
      <div
        data-maximized={maximized || undefined}
        className={cn(
          "fixed flex flex-col overflow-hidden bg-bg",
          drawn
            ? "inset-(--fq-frame-gap) rounded-window border border-line shadow-(--fq-shadow-window)"
            : "inset-0",
        )}
      >
        {children}
      </div>
      {drawn &&
        HANDLES.map((h) => (
          <div
            key={h.dir}
            aria-hidden="true"
            className={cn("fixed z-50", h.className)}
            onMouseDown={(e) => {
              if (e.button === 0) windowControls.startResize(h.dir).catch(console.error);
            }}
          />
        ))}
    </>
  );
}
