import "@fontsource-variable/inter";
import "./styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import {
  createMemoryStore,
  openSettingsStore,
  readJson,
  type KeyValueStore,
} from "./platform/storage";
import { getFrameMode, windowControls } from "./platform/tauri";
import { APPEARANCE_KEY, AppearanceProvider } from "./settings/appearance";
import { applyTheme, resolveMode, sanitizeAppearance } from "./theme/theme";

async function bootstrap() {
  const root = document.documentElement;
  root.dataset.frame = getFrameMode();

  let store: KeyValueStore;
  let storageError: string | undefined;
  try {
    store = await openSettingsStore();
  } catch (err) {
    console.error("Falha ao abrir o banco local", err);
    storageError = err instanceof Error ? err.message : String(err);
    store = createMemoryStore();
  }

  const initial = sanitizeAppearance(await readJson(store, APPEARANCE_KEY).catch(() => undefined));
  // Aplica o tema antes do primeiro render para não piscar.
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  applyTheme(root, initial, resolveMode(initial.mode, prefersDark));

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppearanceProvider store={store} initial={initial}>
        <App storageError={storageError} />
      </AppearanceProvider>
    </StrictMode>,
  );

  // A janela nasce oculta (ver src-tauri/src/window.rs) e só aparece já pintada.
  requestAnimationFrame(() => {
    windowControls.show().catch(console.error);
  });
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  windowControls.show().catch(console.error);
});
