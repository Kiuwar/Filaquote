// Leitura de STL (binário e ASCII) e estimativa de gramas e tempo pelo volume.
//
// É a entrada menos precisa (a mais precisa é o arquivo fatiado). O volume sai da
// soma dos volumes sinalizados dos tetraedros formados por cada triângulo e a origem;
// isso só é exato para malha fechada, então malha aberta gera aviso.

import {
  checkNonNegative,
  checkPositive,
  EngineInputError,
  throwIfIssues,
  type Issue,
} from "./validation";

export type LengthUnit = "mm" | "cm" | "m" | "in";

export const UNIT_TO_MM: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };

export const UNIT_LABELS: Record<LengthUnit, string> = {
  mm: "milímetros",
  cm: "centímetros",
  m: "metros",
  in: "polegadas",
};

export interface StlResult {
  format: "binary" | "ascii";
  triangles: number;
  /** Volume em mm³ (já na unidade escolhida). */
  volumeMm3: number;
  /** Tamanho da caixa envolvente em mm (x, y, z). */
  sizeMm: [number, number, number];
  /** Arestas que não são compartilhadas por exatamente 2 triângulos. */
  openEdges: number;
  closed: boolean;
  /** Unidades que deixariam a peça com tamanho plausível, quando a atual parece errada. */
  unitSuggestions: LengthUnit[];
  warnings: string[];
}

type Vec = [number, number, number];

function parseBinary(bytes: Uint8Array, count: number): Vec[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const vertices: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const base = 84 + i * 50 + 12; // pula a normal
    for (let v = 0; v < 3; v++) {
      const o = base + v * 12;
      vertices.push([
        view.getFloat32(o, true),
        view.getFloat32(o + 4, true),
        view.getFloat32(o + 8, true),
      ]);
    }
  }
  return vertices;
}

function parseAscii(text: string): Vec[] {
  const vertices: Vec[] = [];
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
  for (const m of text.matchAll(re)) {
    const v: Vec = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (v.some((c) => !Number.isFinite(c))) {
      throw new EngineInputError([
        { field: "arquivo", message: "STL ASCII com coordenada inválida" },
      ]);
    }
    vertices.push(v);
  }
  if (vertices.length % 3 !== 0) {
    throw new EngineInputError([
      { field: "arquivo", message: "STL ASCII com triângulo incompleto" },
    ]);
  }
  return vertices;
}

function decodeVertices(bytes: Uint8Array): { format: "binary" | "ascii"; vertices: Vec[] } {
  if (bytes.byteLength === 0) {
    throw new EngineInputError([{ field: "arquivo", message: "arquivo vazio" }]);
  }
  if (bytes.byteLength >= 84) {
    const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      80,
      true,
    );
    if (84 + count * 50 === bytes.byteLength) {
      return { format: "binary", vertices: parseBinary(bytes, count) };
    }
  }
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.byteLength, 512)));
  if (/^\s*solid/i.test(head)) {
    return { format: "ascii", vertices: parseAscii(new TextDecoder().decode(bytes)) };
  }
  throw new EngineInputError([
    { field: "arquivo", message: "não parece um STL (nem binário nem ASCII)" },
  ]);
}

const PLAUSIBLE_MIN_MM = 2;
const PLAUSIBLE_MAX_MM = 600;

export function parseStl(data: ArrayBuffer | Uint8Array, unit: LengthUnit = "mm"): StlResult {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const { format, vertices } = decodeVertices(bytes);
  const triangles = vertices.length / 3;
  if (triangles === 0) {
    throw new EngineInputError([{ field: "arquivo", message: "o STL não tem nenhum triângulo" }]);
  }

  const scale = UNIT_TO_MM[unit];
  let signed = 0;
  const min: Vec = [Infinity, Infinity, Infinity];
  const max: Vec = [-Infinity, -Infinity, -Infinity];
  const edges = new Map<string, number>();
  // Vértices iguais até 0,00001 na unidade do arquivo. String(-0) é "0", então -0 e 0 coincidem.
  const key = (v: Vec) => v.map((c) => String(Math.round(c * 1e5))).join(",");

  for (let t = 0; t < triangles; t++) {
    const a = vertices[3 * t]!;
    const b = vertices[3 * t + 1]!;
    const c = vertices[3 * t + 2]!;
    // a · (b × c) / 6
    signed +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
    for (const v of [a, b, c]) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i]!, v[i]!);
        max[i] = Math.max(max[i]!, v[i]!);
      }
    }
    const ka = key(a);
    const kb = key(b);
    const kc = key(c);
    for (const [p, q] of [
      [ka, kb],
      [kb, kc],
      [kc, ka],
    ] as const) {
      const e = p < q ? `${p}|${q}` : `${q}|${p}`;
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  }

  let openEdges = 0;
  for (const n of edges.values()) if (n !== 2) openEdges++;
  const closed = openEdges === 0;

  const volumeMm3 = Math.abs(signed) * scale ** 3;
  const sizeMm: Vec = [0, 1, 2].map((i) => (max[i]! - min[i]!) * scale) as Vec;
  const largest = Math.max(...sizeMm);

  const warnings: string[] = [];
  if (!closed) {
    warnings.push(
      `Malha aberta (${openEdges} arestas sem par): o volume pode estar errado. Conserte o arquivo ou use o arquivo fatiado.`,
    );
  }
  if (signed < 0) {
    warnings.push("As normais estão invertidas; o volume foi corrigido pelo valor absoluto.");
  }

  const unitSuggestions: LengthUnit[] = [];
  if (largest < PLAUSIBLE_MIN_MM || largest > PLAUSIBLE_MAX_MM) {
    for (const u of ["mm", "cm", "in", "m"] as const) {
      if (u === unit) continue;
      const candidate = (largest / scale) * UNIT_TO_MM[u];
      if (candidate >= PLAUSIBLE_MIN_MM && candidate <= PLAUSIBLE_MAX_MM) unitSuggestions.push(u);
    }
    warnings.push(
      `A peça mede ${largest.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} mm no maior lado, o que parece ${
        largest < PLAUSIBLE_MIN_MM ? "pequeno" : "grande"
      } demais. O STL não guarda unidade: confira se o arquivo está em ${UNIT_LABELS[unit]}${
        unitSuggestions.length
          ? ` (talvez ${unitSuggestions.map((u) => UNIT_LABELS[u]).join(" ou ")})`
          : ""
      }.`,
    );
  }

  return { format, triangles, volumeMm3, sizeMm, openEdges, closed, unitSuggestions, warnings };
}

export interface VolumeEstimateSettings {
  /** Densidade do filamento (g/cm³), da ficha do fabricante. */
  densityGPerCm3: number;
  /** Preenchimento (%) usado no fatiador. */
  infillPercent: number;
  /** Fração do volume que sai maciça (paredes, topo e fundo), de 0 a 1. Calibrável. */
  solidFraction: number;
  /** Vazão média da impressora (g/h). Calibrável. */
  flowGramsPerHour: number;
}

export function validateVolumeSettings(s: VolumeEstimateSettings): Issue[] {
  const issues: Issue[] = [];
  checkPositive(issues, "densityGPerCm3", s.densityGPerCm3);
  checkNonNegative(issues, "infillPercent", s.infillPercent);
  if (s.infillPercent > 100)
    issues.push({ field: "infillPercent", message: "não pode passar de 100%" });
  checkNonNegative(issues, "solidFraction", s.solidFraction);
  if (s.solidFraction > 1)
    issues.push({ field: "solidFraction", message: "precisa estar entre 0 e 1" });
  checkPositive(issues, "flowGramsPerHour", s.flowGramsPerHour);
  return issues;
}

/**
 * gramas = volume (cm³) × densidade × [maciço + (1 − maciço) × preenchimento]
 * horas  = gramas ÷ vazão (g/h)
 */
export function estimateFromVolume(
  volumeMm3: number,
  s: VolumeEstimateSettings,
): { grams: number; printHours: number; fillFactor: number } {
  const issues = validateVolumeSettings(s);
  checkNonNegative(issues, "volumeMm3", volumeMm3);
  throwIfIssues(issues);
  const fillFactor = s.solidFraction + (1 - s.solidFraction) * (s.infillPercent / 100);
  const grams = (volumeMm3 / 1000) * s.densityGPerCm3 * fillFactor;
  return { grams, printHours: grams / s.flowGramsPerHour, fillFactor };
}
