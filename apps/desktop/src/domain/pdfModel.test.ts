import { describe, expect, it } from "vitest";
import { emptyProfileData } from "./profile";
import { buildPdfModel, pdfFileName } from "./pdfModel";
import type { Quote, QuoteItem } from "./quote";
import { buildWhatsappMessage } from "./whatsapp";

const quote: Quote = {
  id: "q",
  number: 12,
  version: 2,
  clientId: "c",
  status: "rascunho",
  validUntil: "2026-11-30",
  paymentTerms: "Pix",
  leadTime: "5 dias úteis",
  notes: "Cor a confirmar.",
  showBreakdown: true,
  createdAt: "2026-11-01 10:00:00",
  updatedAt: "2026-11-01 10:00:00",
  sentAt: null,
  decidedAt: null,
};

const item = (name: string, quantity: number, unitPrice: number, unitCost: number): QuoteItem => ({
  id: name,
  quoteId: "q",
  position: 0,
  name,
  quantity,
  finish: "lixado",
  profileId: "p",
  snapshot: emptyProfileData(),
  input: { grams: 10, purgeGrams: 0, printHours: 1, postMinutes: 0, prepMinutes: 0, extras: [] },
  source: "manual",
  plate: null,
  method: "margin",
  targetPrice: null,
  unitPrice,
  unitCost,
  partId: null,
});

const items = [item("Suporte de headset", 2, 61.9, 37.14), item("Chaveiro", 10, 4.9, 1.23)];
const base = {
  quote,
  items,
  clientName: "Maria Teste",
  prefix: "ORC",
  logo: null,
  primary: "#675af0",
  today: "2026-11-01",
};

describe("PDF do cliente", () => {
  it("mostra número, versão, datas, cliente, itens e total", () => {
    const m = buildPdfModel(base);
    expect(m).toMatchObject({
      code: "ORC-0012",
      version: 2,
      issuedOn: "01/11/2026",
      validUntil: "30/11/2026",
      clientName: "Maria Teste",
    });
    expect(m.total).toBeCloseTo(172.8, 10);
    expect(m.lines[0]).toEqual({
      name: "Suporte de headset",
      quantity: 2,
      finish: "lixado",
      unitPrice: 61.9,
      total: 123.8,
    });
    expect(m.colors.onPrimary).toBe("#ffffff");
  });

  it("nunca leva custo interno, margem, método ou perfil", () => {
    const text = JSON.stringify(buildPdfModel(base));
    expect(text).not.toMatch(/37\.14|1\.23|unitCost|margin|snapshot|profile|cost/i);
  });

  it("só o preço final: itens sem valores individuais", () => {
    const m = buildPdfModel({ ...base, quote: { ...quote, showBreakdown: false } });
    expect(m.lines.every((l) => l.unitPrice === null && l.total === null)).toBe(true);
    expect(m.total).toBeCloseTo(172.8, 10);
  });

  it("nome do arquivo sem acentos nem espaços", () => {
    expect(pdfFileName(buildPdfModel({ ...base, clientName: "João Gonçalves" }))).toBe(
      "ORC-0012-v2-Joao-Goncalves.pdf",
    );
  });
});

describe("mensagem de WhatsApp", () => {
  it("preenche os marcadores", () => {
    const msg = buildWhatsappMessage(
      "Olá{cliente}! Orçamento {numero}:\n{itens}\nTotal: {total}. Válido até {validade}. {desconhecido}",
      buildPdfModel(base),
    );
    expect(msg).toContain("Olá, Maria!");
    expect(msg).toContain("ORC-0012 (versão 2)");
    expect(msg).toContain("• 2× Suporte de headset (lixado) — R$ 123,80");
    expect(msg).toContain("Total: R$ 172,80");
    expect(msg).toContain("Válido até 30/11/2026");
    expect(msg).toContain("{desconhecido}");
  });

  it("sem cliente e sem detalhamento", () => {
    const m = buildPdfModel({
      ...base,
      clientName: null,
      quote: { ...quote, showBreakdown: false },
    });
    const msg = buildWhatsappMessage("Olá{cliente}!\n{itens}", m);
    expect(msg).toBe("Olá!\n• 2× Suporte de headset (lixado)\n• 10× Chaveiro (lixado)");
  });
});
