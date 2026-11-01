// @vitest-environment node
import { createRequire } from "node:module";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildPdfModel } from "../../domain/pdfModel";
import { emptyProfileData } from "../../domain/profile";
import { QuotePdf, registerFonts } from "./QuotePdf";

const require = createRequire(import.meta.url);
const font = (w: number) => require.resolve(`@fontsource/inter/files/inter-latin-${w}-normal.woff`);

describe("PDF gerado", () => {
  it("renderiza um PDF válido, com acentos, sem erro", async () => {
    registerFonts({ regular: font(400), semibold: font(600), bold: font(700) });
    const model = buildPdfModel({
      quote: {
        id: "q",
        number: 3,
        version: 1,
        clientId: null,
        status: "rascunho",
        validUntil: "2026-11-30",
        paymentTerms: "Pix à vista",
        leadTime: "Até 5 dias úteis após a aprovação",
        notes: "Peças em PLA. Acabamento lixado, sem pintura. Ação, coração, açúcar.",
        showBreakdown: true,
        createdAt: "",
        updatedAt: "",
        sentAt: null,
        decidedAt: null,
      },
      items: Array.from({ length: 30 }, (_, i) => ({
        id: String(i),
        quoteId: "q",
        position: i,
        name: `Peça número ${i + 1} — edição çãõé`,
        quantity: i + 1,
        finish: "lixado",
        profileId: null,
        snapshot: emptyProfileData(),
        input: {
          grams: 1,
          purgeGrams: 0,
          printHours: 1,
          postMinutes: 0,
          prepMinutes: 0,
          extras: [],
        },
        source: "manual" as const,
        plate: null,
        method: null,
        targetPrice: null,
        unitPrice: 9.9,
        unitCost: 1,
        partId: null,
      })),
      clientName: "José Conceição",
      prefix: "ORC",
      logo: null,
      primary: "#1c6ed7",
      today: "2026-11-01",
    });
    const buffer = await renderToBuffer(<QuotePdf model={model} />);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // 30 itens não cabem numa página: o rodapé numerado se repete.
    expect(buffer.toString("latin1")).toMatch(/\/Type\s*\/Page\b[\s\S]*\/Type\s*\/Page\b/);
  }, 30000);
});
