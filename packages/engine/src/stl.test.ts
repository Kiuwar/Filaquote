import { describe, expect, it } from "vitest";
import { estimateFromVolume, parseStl } from "./stl";
import { EngineInputError } from "./validation";

type V = [number, number, number];
type Tri = [V, V, V];

function toBinary(tris: Tri[]): Uint8Array {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris.length, true);
  tris.forEach((t, i) => {
    t.forEach((v, j) =>
      v.forEach((c, k) => view.setFloat32(84 + i * 50 + 12 + j * 12 + k * 4, c, true)),
    );
  });
  return new Uint8Array(buf);
}

function toAscii(tris: Tri[]): Uint8Array {
  const body = tris
    .map(
      (t) =>
        `facet normal 0 0 0\nouter loop\n${t.map((v) => `vertex ${v.join(" ")}`).join("\n")}\nendloop\nendfacet`,
    )
    .join("\n");
  return new TextEncoder().encode(`solid teste\n${body}\nendsolid teste\n`);
}

/** Cubo de lado `s` com normais para fora. */
function cube(s: number): Tri[] {
  const p = (x: number, y: number, z: number): V => [x * s, y * s, z * s];
  const quad = (a: V, b: V, c: V, d: V): Tri[] => [
    [a, b, c],
    [a, c, d],
  ];
  return [
    ...quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)), // fundo
    ...quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)), // topo
    ...quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)),
    ...quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)),
    ...quad(p(1, 1, 0), p(0, 1, 0), p(0, 1, 1), p(1, 1, 1)),
    ...quad(p(0, 1, 0), p(0, 0, 0), p(0, 0, 1), p(0, 1, 1)),
  ];
}

/** Prisma de n lados inscrito num cilindro de raio r e altura h. */
function cylinder(r: number, h: number, n: number): Tri[] {
  const tris: Tri[] = [];
  const pt = (i: number, z: number): V => [
    r * Math.cos((2 * Math.PI * i) / n),
    r * Math.sin((2 * Math.PI * i) / n),
    z,
  ];
  for (let i = 0; i < n; i++) {
    const a0 = pt(i, 0);
    const b0 = pt(i + 1, 0);
    const a1 = pt(i, h);
    const b1 = pt(i + 1, h);
    tris.push([[0, 0, 0], b0, a0], [[0, 0, h], a1, b1], [a0, b0, b1], [a0, b1, a1]);
  }
  return tris;
}

/** Esfera UV (latitude × longitude) de raio r. */
function sphere(r: number, lat: number, lon: number): Tri[] {
  const pt = (i: number, j: number): V => {
    const theta = (Math.PI * i) / lat;
    const phi = (2 * Math.PI * j) / lon;
    return [
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(theta),
    ];
  };
  const tris: Tri[] = [];
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const d = pt(i, j + 1);
      if (i > 0) tris.push([a, b, d]);
      if (i < lat - 1) tris.push([b, c, d]);
    }
  }
  return tris;
}

describe("volume de sólidos conhecidos", () => {
  it("cubo de 20 mm = 8000 mm³ (binário e ASCII)", () => {
    for (const bytes of [toBinary(cube(20)), toAscii(cube(20))]) {
      const r = parseStl(bytes);
      expect(r.volumeMm3).toBeCloseTo(8000, 6);
      expect(r.sizeMm).toEqual([20, 20, 20]);
      expect(r.closed).toBe(true);
      expect(r.warnings).toEqual([]);
    }
    expect(parseStl(toBinary(cube(20))).format).toBe("binary");
    expect(parseStl(toAscii(cube(20))).format).toBe("ascii");
  });

  it("cilindro: volume exato do prisma de 64 lados (≈ π r² h)", () => {
    const n = 64;
    const r = 10;
    const h = 30;
    const exact = (n / 2) * r * r * Math.sin((2 * Math.PI) / n) * h;
    const result = parseStl(toAscii(cylinder(r, h, n)));
    expect(result.volumeMm3).toBeCloseTo(exact, 3);
    expect(result.volumeMm3 / (Math.PI * r * r * h)).toBeCloseTo(1, 2);
    expect(result.closed).toBe(true);
  });

  it("esfera de raio 15: até 1% de 4/3 π r³ com malha fina", () => {
    const r = 15;
    const result = parseStl(toBinary(sphere(r, 64, 128)));
    const ideal = (4 / 3) * Math.PI * r ** 3;
    expect(Math.abs(result.volumeMm3 / ideal - 1)).toBeLessThan(0.01);
    expect(result.closed).toBe(true);
  });

  it("normais invertidas: volume positivo e aviso", () => {
    const inverted = cube(10).map(([a, b, c]) => [a, c, b] as Tri);
    const r = parseStl(toBinary(inverted));
    expect(r.volumeMm3).toBeCloseTo(1000, 6);
    expect(r.warnings.join(" ")).toMatch(/invertidas/);
  });
});

describe("arquivos problemáticos", () => {
  it("arquivo vazio", () => {
    expect(() => parseStl(new Uint8Array())).toThrowError(/arquivo vazio/);
  });

  it("STL binário sem triângulos", () => {
    expect(() => parseStl(toBinary([]))).toThrowError(/nenhum triângulo/);
  });

  it("arquivo que não é STL", () => {
    expect(() => parseStl(new TextEncoder().encode("isto não é um STL"))).toThrowError(
      EngineInputError,
    );
  });

  it("malha aberta (cubo sem a tampa): avisa", () => {
    const open = cube(10).slice(0, 10).concat(cube(10).slice(12)); // tira o topo
    const r = parseStl(toBinary(open));
    expect(r.closed).toBe(false);
    expect(r.openEdges).toBe(4);
    expect(r.warnings.join(" ")).toMatch(/Malha aberta/);
  });

  it("unidade errada: cubo de 0,02 lido em mm sugere metros", () => {
    const r = parseStl(toBinary(cube(0.02)));
    expect(r.unitSuggestions).toContain("m");
    expect(r.warnings.join(" ")).toMatch(/pequeno demais/);
    const fixed = parseStl(toBinary(cube(0.02)), "m");
    expect(fixed.volumeMm3).toBeCloseTo(8000, 1);
    expect(fixed.unitSuggestions).toEqual([]);
  });

  it("unidade errada: cubo de 2 lido em mm sugere cm e polegadas", () => {
    const r = parseStl(toBinary(cube(1)));
    expect(r.unitSuggestions).toEqual(["cm", "in"]);
    expect(parseStl(toBinary(cube(1)), "in").volumeMm3).toBeCloseTo(25.4 ** 3, 2);
  });

  it("peça gigante sugere unidade menor", () => {
    const r = parseStl(toBinary(cube(5000)));
    expect(r.warnings.join(" ")).toMatch(/grande demais/);
  });
});

describe("estimativa pelo volume", () => {
  it("gramas e horas com preenchimento e fração maciça", () => {
    // 10 cm³ × 1,24 g/cm³ × (0,3 + 0,7 × 0,2) = 12,4 × 0,44 = 5,456 g; ÷ 10 g/h = 0,5456 h
    const e = estimateFromVolume(10000, {
      densityGPerCm3: 1.24,
      infillPercent: 20,
      solidFraction: 0.3,
      flowGramsPerHour: 10,
    });
    expect(e.fillFactor).toBeCloseTo(0.44, 10);
    expect(e.grams).toBeCloseTo(5.456, 10);
    expect(e.printHours).toBeCloseTo(0.5456, 10);
  });

  it("rejeita vazão zero e preenchimento acima de 100%", () => {
    expect(() =>
      estimateFromVolume(1000, {
        densityGPerCm3: 1,
        infillPercent: 120,
        solidFraction: 0.2,
        flowGramsPerHour: 0,
      }),
    ).toThrowError(EngineInputError);
  });
});
