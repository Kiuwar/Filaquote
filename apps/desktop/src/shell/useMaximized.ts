import { useEffect, useState } from "react";
import { windowControls } from "../platform/tauri";

/** Acompanha se a janela está maximizada (sempre `false` fora do Tauri). */
export function useMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const refresh = () => {
      windowControls.isMaximized().then((m) => {
        if (!cancelled) setMaximized(m);
      }, console.error);
    };
    refresh();
    windowControls.onResized(refresh).then((u) => {
      if (cancelled) u();
      else unlisten = u;
    }, console.error);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return maximized;
}
