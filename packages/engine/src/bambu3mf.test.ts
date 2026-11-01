import { describe, expect, it } from "vitest";
import { parseBambu3mf, parseSliceInfo } from "./bambu3mf";
import { listZipEntries } from "./zip";

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Monta um ZIP simples (CRC zerado: o leitor não confere). */
async function buildZip(files: Record<string, string>, compress: boolean): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = compress ? await deflateRaw(raw) : raw;
    const nameBytes = enc.encode(name);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, compress ? 8 : 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, compress ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

// Estrutura de slice_info.config conforme os leitores de código aberto consultados
// (libprintcalc, lib3mf-core). Valores fictícios.
const SLICE_INFO = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
    <header_item key="X-BBL-Client-Version" value="02.03.00.70"/>
  </header>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="5400"/>
    <metadata key="weight" value="42.5"/>
    <filament id="1" tray_info_idx="GFA00" type="PLA" color="#FFFFFF" used_m="14.2" used_g="42.5"/>
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="9000"/>
    <filament id="1" type="PLA" color="#FFFFFF" used_m="20" used_g="60"/>
    <filament id="3" type="PETG" color="#000000" used_m="5" used_g="15.25"/>
  </plate>
</config>`;

describe("slice_info.config", () => {
  it("lê tempo, peso e filamentos de cada mesa", () => {
    const r = parseSliceInfo(SLICE_INFO);
    expect(r.slicerVersion).toBe("02.03.00.70");
    expect(r.plates).toHaveLength(2);
    expect(r.plates[0]).toMatchObject({ index: 1, printHours: 1.5, grams: 42.5 });
    // sem metadata "weight": soma os filamentos
    expect(r.plates[1]!.grams).toBeCloseTo(75.25, 10);
    expect(r.plates[1]!.printHours).toBe(2.5);
    expect(r.plates[1]!.filaments.map((f) => f.type)).toEqual(["PLA", "PETG"]);
  });

  it("sem nenhuma mesa fatiada: erro explicando como exportar", () => {
    expect(() => parseSliceInfo("<config></config>")).toThrowError(/Exportar arquivo fatiado/);
  });
});

describe("arquivo .gcode.3mf", () => {
  it("lê de ZIP com entradas comprimidas (deflate) e sem compressão", async () => {
    for (const compress of [true, false]) {
      const zip = await buildZip(
        { "3D/3dmodel.model": "<model/>", "Metadata/slice_info.config": SLICE_INFO },
        compress,
      );
      expect(listZipEntries(zip).map((e) => e.name)).toContain("Metadata/slice_info.config");
      const r = await parseBambu3mf(zip);
      expect(r.plates[0]!.grams).toBe(42.5);
    }
  });

  it("projeto sem fatiar: erro claro", async () => {
    const zip = await buildZip({ "3D/3dmodel.model": "<model/>" }, true);
    await expect(parseBambu3mf(zip)).rejects.toThrowError(/não tem dados de fatiamento/);
  });

  it("arquivo vazio e arquivo que não é ZIP", async () => {
    await expect(parseBambu3mf(new Uint8Array())).rejects.toThrowError(/arquivo vazio/);
    await expect(parseBambu3mf(new TextEncoder().encode("abc"))).rejects.toThrowError(
      /não é um arquivo ZIP/,
    );
  });
});
