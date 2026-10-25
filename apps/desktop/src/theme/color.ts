// Utilitários de cor puros (sem DOM), usados pela interface e, na fase 5, pelo PDF.
// Contraste segundo a definição de luminância relativa do WCAG 2.x.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHex(input: string): Rgb | null {
  const match = HEX_RE.exec(input.trim());
  if (!match?.[1]) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = Number.parseInt(hex, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function isHex(input: string): boolean {
  return parseHex(input) !== null;
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Normaliza para `#rrggbb` minúsculo; devolve `null` se inválido. */
export function normalizeHex(input: string): string | null {
  const rgb = parseHex(input);
  return rgb ? toHex(rgb) : null;
}

function channelToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Razão de contraste WCAG (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 1;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mistura linear em sRGB. `t = 0` devolve `a`, `t = 1` devolve `b`. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export const INK_LIGHT = "#ffffff";
export const INK_DARK = "#15151c";

/** Cor de texto (clara ou escura) com maior contraste sobre `background`. */
export function readableOn(background: string): string {
  return contrastRatio(background, INK_LIGHT) >= contrastRatio(background, INK_DARK)
    ? INK_LIGHT
    : INK_DARK;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const hue = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue(p, q, h + 1 / 3) * 255,
    g: hue(p, q, h) * 255,
    b: hue(p, q, h - 1 / 3) * 255,
  };
}

/**
 * Ajusta só a luminosidade de `color` (mantendo matiz e saturação) até atingir
 * `minRatio` contra `against`. Escurece sobre fundos claros e clareia sobre escuros.
 * Se já atende, devolve a cor normalizada sem alteração.
 */
export function ensureContrast(color: string, against: string, minRatio: number): string {
  const rgb = parseHex(color);
  const bg = parseHex(against);
  if (!rgb || !bg) return color;
  const start = toHex(rgb);
  if (contrastRatio(start, against) >= minRatio) return start;

  const hsl = rgbToHsl(rgb);
  const darken = relativeLuminance(bg) > 0.18;
  const step = 0.01;
  let l = hsl.l;
  while (darken ? l > 0 : l < 1) {
    l = darken ? Math.max(0, l - step) : Math.min(1, l + step);
    const candidate = toHex(hslToRgb({ ...hsl, l }));
    if (contrastRatio(candidate, against) >= minRatio) return candidate;
  }
  return darken ? "#000000" : "#ffffff";
}
