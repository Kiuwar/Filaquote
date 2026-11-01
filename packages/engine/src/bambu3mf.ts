// Importação experimental do .gcode.3mf do Bambu Studio (o "arquivo fatiado").
//
// Lê Metadata/slice_info.config: um <plate> por mesa, com <metadata key="prediction">
// (tempo em segundos), <metadata key="weight"> (gramas) e um <filament> por bandeja
// usada (used_g, used_m, type, color). A estrutura foi conferida em dois leitores de
// código aberto independentes, mas ainda não em arquivos reais do usuário: por isso o
// app marca a importação como experimental e mostra os valores para conferência.

import { readZipText } from "./zip";
import { EngineInputError } from "./validation";

export interface BambuFilament {
  id: string;
  type: string | null;
  color: string | null;
  usedGrams: number | null;
  usedMeters: number | null;
}

export interface BambuPlate {
  index: number;
  printHours: number;
  grams: number;
  filaments: BambuFilament[];
}

export interface Bambu3mfResult {
  plates: BambuPlate[];
  slicerVersion: string | null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]!] = decodeEntities(m[2]!);
  return out;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseSliceInfo(xml: string): Bambu3mfResult {
  const plates: BambuPlate[] = [];
  for (const block of xml.matchAll(/<plate\b[^>]*>([\s\S]*?)<\/plate>/g)) {
    const body = block[1]!;
    const meta: Record<string, string> = {};
    for (const tag of body.matchAll(/<metadata\b[^>]*\/?>/g)) {
      const a = attributes(tag[0]);
      if (a.key !== undefined && a.value !== undefined) meta[a.key] = a.value;
    }
    const filaments: BambuFilament[] = [...body.matchAll(/<filament\b[^>]*\/?>/g)].map((tag) => {
      const a = attributes(tag[0]);
      return {
        id: a.id ?? "",
        type: a.type ?? null,
        color: a.color ?? null,
        usedGrams: toNumber(a.used_g),
        usedMeters: toNumber(a.used_m),
      };
    });
    const index = toNumber(meta.index);
    const seconds = toNumber(meta.prediction);
    const weight = toNumber(meta.weight);
    const sumGrams = filaments.reduce((s, f) => s + (f.usedGrams ?? 0), 0);
    if (index === null || seconds === null) continue;
    plates.push({
      index,
      printHours: seconds / 3600,
      grams: weight ?? sumGrams,
      filaments,
    });
  }
  if (plates.length === 0) {
    throw new EngineInputError([
      {
        field: "arquivo",
        message:
          "nenhuma mesa fatiada encontrada. Exporte pelo Bambu Studio em “Exportar arquivo fatiado da mesa”.",
      },
    ]);
  }
  const version = /X-BBL-Client-Version"\s+value="([^"]*)"/.exec(xml)?.[1] ?? null;
  return { plates: plates.sort((a, b) => a.index - b.index), slicerVersion: version || null };
}

export async function parseBambu3mf(data: ArrayBuffer | Uint8Array): Promise<Bambu3mfResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength === 0)
    throw new EngineInputError([{ field: "arquivo", message: "arquivo vazio" }]);
  const xml = await readZipText(bytes, "Metadata/slice_info.config");
  if (xml === null) {
    throw new EngineInputError([
      {
        field: "arquivo",
        message:
          "o 3MF não tem dados de fatiamento (Metadata/slice_info.config). Use o arquivo fatiado (.gcode.3mf), não o projeto.",
      },
    ]);
  }
  return parseSliceInfo(xml);
}
