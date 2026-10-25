import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  ensureContrast,
  mix,
  normalizeHex,
  parseHex,
  readableOn,
  relativeLuminance,
} from "./color";

describe("parseHex / normalizeHex", () => {
  it("aceita #rgb e #rrggbb, com ou sem #", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
  });

  it("rejeita valores inválidos", () => {
    expect(parseHex("#ggg")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(normalizeHex("vermelho")).toBeNull();
  });
});

describe("contraste WCAG", () => {
  it("preto sobre branco é 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("cor igual é 1:1 e a ordem não importa", () => {
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    expect(contrastRatio("#123456", "#fedcba")).toBe(contrastRatio("#fedcba", "#123456"));
  });

  it("confere valor de referência conhecido (#767676 sobre branco ≈ 4,54:1)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("luminância do branco é 1 e do preto é 0", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });
});

describe("readableOn", () => {
  it("escolhe texto claro em fundo escuro e escuro em fundo claro", () => {
    expect(readableOn("#1a1a1a")).toBe("#ffffff");
    expect(readableOn("#ffe066")).not.toBe("#ffffff");
  });
});

describe("mix", () => {
  it("interpola em sRGB", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("ensureContrast", () => {
  it("não altera cor que já passa", () => {
    expect(ensureContrast("#1c6ed7", "#ffffff", 3)).toBe("#1c6ed7");
  });

  it("escurece amarelo claro até 3:1 sobre branco", () => {
    const fixed = ensureContrast("#ffe066", "#ffffff", 3);
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(3);
  });

  it("clareia azul escuro até 3:1 sobre fundo escuro", () => {
    const fixed = ensureContrast("#0b1a40", "#18181f", 3);
    expect(contrastRatio(fixed, "#18181f")).toBeGreaterThanOrEqual(3);
  });
});
