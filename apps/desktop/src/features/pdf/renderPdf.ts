import regular from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import semibold from "@fontsource/inter/files/inter-latin-600-normal.woff?url";
import bold from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import { createElement } from "react";
import type { PdfModel } from "../../domain/pdfModel";

/** Gera o PDF no próprio computador. A biblioteca só é carregada quando usada. */
export async function renderPdf(model: PdfModel): Promise<Uint8Array> {
  const [{ pdf }, { QuotePdf, registerFonts }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./QuotePdf"),
  ]);
  registerFonts({ regular, semibold, bold });
  const blob = await pdf(createElement(QuotePdf, { model }) as Parameters<typeof pdf>[0]).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
