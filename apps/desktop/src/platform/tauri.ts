import { isTauri } from "@tauri-apps/api/core";

export { isTauri };

/**
 * Como a moldura da janela é desenhada (definido pelo Rust em src-tauri/src/window.rs):
 * - `native`: Windows 11. O sistema arredonda os cantos e desenha a sombra.
 * - `css`: Windows 10 e demais. Janela transparente; cantos, sombra e bordas de
 *   redimensionamento são desenhados pela interface.
 */
export type FrameMode = "native" | "css";

declare global {
  interface Window {
    __FILAQUOTE_FRAME__?: FrameMode;
  }
}

export function getFrameMode(): FrameMode {
  return window.__FILAQUOTE_FRAME__ === "native" ? "native" : "css";
}

async function currentWindow() {
  if (!isTauri()) return null;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export const windowControls = {
  async minimize() {
    await (await currentWindow())?.minimize();
  },
  async toggleMaximize() {
    await (await currentWindow())?.toggleMaximize();
  },
  async close() {
    await (await currentWindow())?.close();
  },
  async show() {
    const w = await currentWindow();
    if (!w) return;
    await w.show();
    await w.setFocus();
  },
  async isMaximized(): Promise<boolean> {
    return (await (await currentWindow())?.isMaximized()) ?? false;
  },
  /** Chama `cb` a cada redimensionamento; devolve a função para cancelar. */
  async onResized(cb: () => void): Promise<() => void> {
    const w = await currentWindow();
    if (!w) return () => {};
    return w.onResized(cb);
  },
  async startResize(direction: ResizeDirection) {
    await (await currentWindow())?.startResizeDragging(direction);
  },
};

export type ResizeDirection =
  "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";
