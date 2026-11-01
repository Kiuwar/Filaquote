export interface Palette {
  id: string;
  name: string;
  primary: string;
  accent: string;
}

// Paletas prontas. O teste palettes.test.ts garante que todas passam na checagem de
// contraste nos temas claro e escuro.
export const PALETTES: readonly Palette[] = [
  { id: "violeta", name: "Violeta", primary: "#675af0", accent: "#c24a0a" },
  { id: "oceano", name: "Oceano", primary: "#1c6ed7", accent: "#0d7e74" },
  { id: "floresta", name: "Floresta", primary: "#2c8041", accent: "#9a661a" },
  { id: "rubi", name: "Rubi", primary: "#cf3168", accent: "#5d61e1" },
  { id: "ambar", name: "Âmbar", primary: "#b35709", accent: "#2875b4" },
  { id: "grafite", name: "Grafite", primary: "#637289", accent: "#0d7e74" },
];

export const DEFAULT_PALETTE = PALETTES[0]!;

export function findPalette(id: string | null | undefined): Palette | undefined {
  return PALETTES.find((p) => p.id === id);
}
