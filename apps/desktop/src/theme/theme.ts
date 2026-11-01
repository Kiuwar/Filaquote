import { contrastRatio, ensureContrast, mix, normalizeHex, readableOn } from "./color";
import { DEFAULT_PALETTE } from "./palettes";
import {
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  NEUTRALS,
  type NeutralTokens,
  type ResolvedTheme,
} from "./tokens";

export type ThemeMode = "light" | "dark" | "system";

export interface Appearance {
  mode: ThemeMode;
  primary: string;
  accent: string;
  /** Paleta pronta de origem; `null` quando o usuário escolheu cores próprias. */
  paletteId: string | null;
}

export const DEFAULT_APPEARANCE: Appearance = {
  mode: "system",
  primary: DEFAULT_PALETTE.primary,
  accent: DEFAULT_PALETTE.accent,
  paletteId: DEFAULT_PALETTE.id,
};

const MODES: readonly ThemeMode[] = ["light", "dark", "system"];

/** Aceita qualquer valor (vindo do banco ou de backup) e devolve aparência válida. */
export function sanitizeAppearance(value: unknown): Appearance {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_APPEARANCE };
  const v = value as Record<string, unknown>;
  const mode = MODES.includes(v.mode as ThemeMode)
    ? (v.mode as ThemeMode)
    : DEFAULT_APPEARANCE.mode;
  const primary =
    (typeof v.primary === "string" && normalizeHex(v.primary)) || DEFAULT_APPEARANCE.primary;
  const accent =
    (typeof v.accent === "string" && normalizeHex(v.accent)) || DEFAULT_APPEARANCE.accent;
  const paletteId = typeof v.paletteId === "string" ? v.paletteId : null;
  return { mode, primary, accent, paletteId };
}

export function resolveMode(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

/** Todas as CSS variables de cor para um tema. Função pura. */
export function buildColorVariables(
  appearance: Appearance,
  theme: ResolvedTheme,
): Record<string, string> {
  const n: NeutralTokens = NEUTRALS[theme];
  const { primary, accent } = appearance;
  const softAmount = theme === "light" ? 0.12 : 0.2;
  return {
    "--fq-bg": n.bg,
    "--fq-surface": n.surface,
    "--fq-surface-2": n.surface2,
    "--fq-border": n.border,
    "--fq-text": n.text,
    "--fq-text-muted": n.textMuted,
    "--fq-danger": n.danger,
    "--fq-success": n.success,
    "--fq-warning": n.warning,
    "--fq-primary": primary,
    "--fq-primary-hover": mix(primary, theme === "light" ? "#000000" : "#ffffff", 0.12),
    "--fq-primary-soft": mix(n.surface, primary, softAmount),
    "--fq-on-primary": readableOn(primary),
    "--fq-accent": accent,
    "--fq-accent-soft": mix(n.surface, accent, softAmount),
    "--fq-on-accent": readableOn(accent),
  };
}

export function applyTheme(root: HTMLElement, appearance: Appearance, theme: ResolvedTheme): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  for (const [name, value] of Object.entries(buildColorVariables(appearance, theme))) {
    root.style.setProperty(name, value);
  }
}

export type ColorRole = "primary" | "accent";

export interface ContrastCheck {
  id: string;
  role: ColorRole;
  /** Rótulo completo, para leitores de tela e mensagens. */
  label: string;
  /** Rótulo curto, exibido agrupado sob o nome da cor. */
  shortLabel: string;
  ratio: number;
  min: number;
  ok: boolean;
}

/**
 * Checa as combinações que dependem das cores escolhidas pelo usuário, nos dois
 * temas (a mesma cor é usada no claro e no escuro).
 */
export function checkContrast(appearance: Appearance): ContrastCheck[] {
  const checks: ContrastCheck[] = [];
  for (const role of ["primary", "accent"] as const) {
    const color = appearance[role];
    const name = role === "primary" ? "Cor principal" : "Cor de destaque";
    const cases = [
      ["text", "Texto sobre a cor", readableOn(color), MIN_TEXT_CONTRAST],
      ["light", "No tema claro", NEUTRALS.light.surface, MIN_UI_CONTRAST],
      ["dark", "No tema escuro", NEUTRALS.dark.surface, MIN_UI_CONTRAST],
    ] as const;
    for (const [key, shortLabel, against, min] of cases) {
      const ratio = contrastRatio(color, against);
      checks.push({
        id: `${role}-${key}`,
        role,
        label: `${name}: ${shortLabel.toLowerCase()}`,
        shortLabel,
        ratio,
        min,
        ok: ratio >= min,
      });
    }
  }
  return checks;
}

/**
 * Corrige uma cor para passar nos dois temas, se possível. Ajusta contra o tema em
 * que falha; se o ajuste quebrar o outro tema, devolve a melhor tentativa.
 */
export function fixColorContrast(color: string): string {
  const light = NEUTRALS.light.surface;
  const dark = NEUTRALS.dark.surface;
  let fixed = color;
  if (contrastRatio(fixed, light) < MIN_UI_CONTRAST) {
    fixed = ensureContrast(fixed, light, MIN_UI_CONTRAST);
  }
  if (contrastRatio(fixed, dark) < MIN_UI_CONTRAST) {
    fixed = ensureContrast(fixed, dark, MIN_UI_CONTRAST);
  }
  return fixed;
}
