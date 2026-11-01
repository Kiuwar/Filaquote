import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color";
import { PALETTES } from "./palettes";
import {
  DEFAULT_APPEARANCE,
  applyTheme,
  buildColorVariables,
  checkContrast,
  fixColorContrast,
  resolveMode,
  sanitizeAppearance,
} from "./theme";
import { MIN_UI_CONTRAST, NEUTRALS } from "./tokens";

describe("sanitizeAppearance", () => {
  it("devolve o padrão para lixo", () => {
    expect(sanitizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(sanitizeAppearance("x")).toEqual(DEFAULT_APPEARANCE);
  });

  it("normaliza cores e descarta campos inválidos", () => {
    const a = sanitizeAppearance({ mode: "dark", primary: "#ABC", accent: "azul", paletteId: 3 });
    expect(a).toEqual({
      mode: "dark",
      primary: "#aabbcc",
      accent: DEFAULT_APPEARANCE.accent,
      paletteId: null,
    });
  });
});

describe("resolveMode", () => {
  it("segue o sistema só no modo system", () => {
    expect(resolveMode("system", true)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
  });
});

describe("variáveis de tema", () => {
  it("gera as cores do usuário e as neutras do tema", () => {
    const vars = buildColorVariables({ ...DEFAULT_APPEARANCE, primary: "#1c6fd8" }, "dark");
    expect(vars["--fq-primary"]).toBe("#1c6fd8");
    expect(vars["--fq-bg"]).toBe(NEUTRALS.dark.bg);
    expect(vars["--fq-on-primary"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("applyTheme grava data-theme e as variáveis no elemento", () => {
    const el = document.createElement("div");
    applyTheme(el, DEFAULT_APPEARANCE, "light");
    expect(el.dataset.theme).toBe("light");
    expect(el.style.getPropertyValue("--fq-primary")).toBe(DEFAULT_APPEARANCE.primary);
  });
});

describe("paletas prontas", () => {
  it.each(PALETTES.map((p) => [p.name, p] as const))(
    "%s passa em todas as checagens de contraste",
    (_name, palette) => {
      const checks = checkContrast({ ...DEFAULT_APPEARANCE, ...palette });
      const failing = checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.ratio.toFixed(2)}`);
      expect(failing).toEqual([]);
    },
  );

  it("ids são únicos", () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
  });
});

describe("fixColorContrast", () => {
  it("corrige amarelo claro para passar no tema claro", () => {
    const fixed = fixColorContrast("#ffe066");
    expect(contrastRatio(fixed, NEUTRALS.light.surface)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  it("corrige azul muito escuro para passar no tema escuro", () => {
    const fixed = fixColorContrast("#0b1a40");
    expect(contrastRatio(fixed, NEUTRALS.dark.surface)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });
});
