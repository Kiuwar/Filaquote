// Fonte única das cores neutras de cada tema. A interface recebe estes valores como
// CSS variables (ver theme.ts); o PDF (fase 5) vai ler os mesmos valores.

export type ResolvedTheme = "light" | "dark";

export interface NeutralTokens {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textMuted: string;
  danger: string;
  success: string;
  warning: string;
}

export const NEUTRALS: Record<ResolvedTheme, NeutralTokens> = {
  light: {
    bg: "#f3f3f7",
    surface: "#ffffff",
    surface2: "#f7f7fa",
    border: "#e3e3eb",
    text: "#15151c",
    textMuted: "#5b5b6b",
    danger: "#c62828",
    success: "#1b7f3b",
    warning: "#9a5b00",
  },
  dark: {
    bg: "#0f0f14",
    surface: "#18181f",
    surface2: "#1f1f28",
    border: "#2d2d3a",
    text: "#ececf2",
    textMuted: "#a2a2b4",
    danger: "#f26b6b",
    success: "#4cc47a",
    warning: "#f0b44c",
  },
};

/** Contraste mínimo de texto normal (WCAG 2.x, nível AA, critério 1.4.3). */
export const MIN_TEXT_CONTRAST = 4.5;
/** Contraste mínimo de componentes e elementos gráficos (WCAG 2.x, critério 1.4.11). */
export const MIN_UI_CONTRAST = 3;
