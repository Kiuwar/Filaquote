import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfMoney, type PdfModel } from "../../domain/pdfModel";

let registered = false;

/** Registra a Inter (com acentos) a partir dos arquivos embutidos no app. */
export function registerFonts(src: { regular: string; semibold: string; bold: string }): void {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: src.regular, fontWeight: 400 },
      { src: src.semibold, fontWeight: 600 },
      { src: src.bold, fontWeight: 700 },
    ],
  });
  // Sem hifenização automática (quebra palavras em português de forma estranha).
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const ink = "#15151c";
const muted = "#5b5b6b";
const line = "#e3e3eb";

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 10, color: ink, padding: 40, paddingBottom: 56 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logo: { maxHeight: 48, maxWidth: 160, objectFit: "contain" },
  title: { fontSize: 22, fontWeight: 700 },
  code: { fontSize: 10, color: muted, marginTop: 2 },
  badge: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  meta: { flexDirection: "row", gap: 24, marginBottom: 20 },
  metaLabel: { fontSize: 8, color: muted, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 10, fontWeight: 600, marginTop: 2 },
  table: { borderRadius: 10, borderWidth: 1, borderColor: line, overflow: "hidden" },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: line,
  },
  headRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 12 },
  headCell: { fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  cName: { flex: 3 },
  cQty: { flex: 1, textAlign: "right" },
  cMoney: { flex: 1.4, textAlign: "right" },
  finish: { fontSize: 8, color: muted, marginTop: 1 },
  total: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalValue: { fontSize: 18, fontWeight: 700 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 9, fontWeight: 600, marginBottom: 4 },
  paragraph: { fontSize: 10, lineHeight: 1.45 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: muted,
  },
});

export function QuotePdf({ model }: { model: PdfModel }) {
  const { primary, onPrimary } = model.colors;
  return (
    <Document
      title={`${model.title} ${model.code} v${model.version}`}
      language="pt-BR"
      creator="Filaquote"
      producer="Filaquote"
    >
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>{model.title}</Text>
            <Text style={s.code}>
              {model.code} · versão {model.version}
            </Text>
          </View>
          {model.logo ? (
            <Image style={s.logo} src={model.logo} />
          ) : (
            <View style={[s.badge, { backgroundColor: primary }]}>
              <Text style={{ color: onPrimary, fontWeight: 600 }}>{model.code}</Text>
            </View>
          )}
        </View>

        <View style={s.meta}>
          <View>
            <Text style={s.metaLabel}>Cliente</Text>
            <Text style={s.metaValue}>{model.clientName ?? "—"}</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Emitido em</Text>
            <Text style={s.metaValue}>{model.issuedOn}</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Válido até</Text>
            <Text style={s.metaValue}>{model.validUntil ?? "a combinar"}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={[s.headRow, { backgroundColor: primary }]}>
            <Text style={[s.headCell, s.cName, { color: onPrimary }]}>Peça</Text>
            <Text style={[s.headCell, s.cQty, { color: onPrimary }]}>Qtd.</Text>
            {model.showBreakdown && (
              <>
                <Text style={[s.headCell, s.cMoney, { color: onPrimary }]}>Unitário</Text>
                <Text style={[s.headCell, s.cMoney, { color: onPrimary }]}>Total</Text>
              </>
            )}
          </View>
          {model.lines.map((l, i) => (
            <View key={i} style={s.row} wrap={false}>
              <View style={s.cName}>
                <Text>{l.name}</Text>
                {l.finish ? <Text style={s.finish}>Acabamento: {l.finish}</Text> : null}
              </View>
              <Text style={s.cQty}>{l.quantity}</Text>
              {model.showBreakdown && l.unitPrice !== null && l.total !== null && (
                <>
                  <Text style={s.cMoney}>{pdfMoney(l.unitPrice)}</Text>
                  <Text style={s.cMoney}>{pdfMoney(l.total)}</Text>
                </>
              )}
            </View>
          ))}
        </View>

        <View style={[s.total, { backgroundColor: primary }]}>
          <Text style={{ color: onPrimary, fontWeight: 600 }}>Total</Text>
          <Text style={[s.totalValue, { color: onPrimary }]}>{pdfMoney(model.total)}</Text>
        </View>

        {(model.paymentTerms || model.leadTime) && (
          <View style={s.section}>
            {model.paymentTerms ? (
              <Text style={s.paragraph}>
                <Text style={{ fontWeight: 600 }}>Pagamento: </Text>
                {model.paymentTerms}
              </Text>
            ) : null}
            {model.leadTime ? (
              <Text style={s.paragraph}>
                <Text style={{ fontWeight: 600 }}>Prazo: </Text>
                {model.leadTime}
              </Text>
            ) : null}
          </View>
        )}
        {model.notes ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Observações</Text>
            <Text style={s.paragraph}>{model.notes}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>
            {model.code} · versão {model.version}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
