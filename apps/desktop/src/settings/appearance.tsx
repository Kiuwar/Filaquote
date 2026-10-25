import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { writeJson, type KeyValueStore } from "../platform/storage";
import { applyTheme, resolveMode, type Appearance } from "../theme/theme";
import type { ResolvedTheme } from "../theme/tokens";

export const APPEARANCE_KEY = "appearance";
const SAVE_DELAY_MS = 300;

interface AppearanceContextValue {
  appearance: Appearance;
  resolvedTheme: ResolvedTheme;
  update(patch: Partial<Appearance>): void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function usePrefersDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return dark;
}

export function AppearanceProvider({
  store,
  initial,
  children,
}: {
  store: KeyValueStore;
  initial: Appearance;
  children: ReactNode;
}) {
  const [appearance, setAppearance] = useState(initial);
  const prefersDark = usePrefersDark();
  const resolvedTheme = resolveMode(appearance.mode, prefersDark);

  useLayoutEffect(() => {
    applyTheme(document.documentElement, appearance, resolvedTheme);
  }, [appearance, resolvedTheme]);

  // Salva com atraso curto: o seletor de cor dispara muitas mudanças por segundo.
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      writeJson(store, APPEARANCE_KEY, appearance).catch((err: unknown) => {
        console.error("Falha ao salvar aparência", err);
      });
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [appearance, store]);

  const update = useCallback((patch: Partial<Appearance>) => {
    setAppearance((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ appearance, resolvedTheme, update }),
    [appearance, resolvedTheme, update],
  );
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance precisa de <AppearanceProvider>");
  return ctx;
}
