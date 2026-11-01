import { CheckCircle2, FileDown, MessageCircle, PackageCheck, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { getClient } from "../../data/clients";
import { useData, useDb } from "../../data/DataProvider";
import { listProfiles } from "../../data/profiles";
import { newQuoteVersion, saveQuote, setQuoteStatus, getQuote } from "../../data/quotes";
import { buildPdfModel, pdfFileName, type PdfModel } from "../../domain/pdfModel";
import {
  itemStaleness,
  syncItem,
  type Quote,
  type QuoteItem,
  type QuoteStatus,
} from "../../domain/quote";
import { buildWhatsappMessage } from "../../domain/whatsapp";
import { copyText, saveFile } from "../../platform/files";
import { useAppearance } from "../../settings/appearance";
import type { QuoteDefaults } from "../../settings/quoteDefaults";
import { useNavigate } from "../../shell/router";
import { Button } from "../../ui/Button";
import { money, percent } from "../../ui/format";
import { Modal } from "../../ui/Modal";
import { errorMessage, useToast } from "../../ui/Toast";
import { ClosureModal } from "../history/ClosureModal";

interface StaleRow {
  name: string;
  costDelta: number;
  marginThen: number | null;
  marginNow: number | null;
  priceToKeep: number | null;
}

export function QuoteActions({
  quote,
  items,
  code,
  defaults,
  onStatusChanged,
  flush,
}: {
  quote: Quote;
  items: QuoteItem[];
  code: string;
  defaults: QuoteDefaults;
  onStatusChanged(status: QuoteStatus): void;
  /** Grava o que ainda está pendente antes de gerar PDF ou mudar status. */
  flush(): Promise<void>;
}) {
  const db = useDb();
  const { changed } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const { appearance } = useAppearance();
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState<StaleRow[] | null>(null);
  const [closing, setClosing] = useState(false);

  const model = async (): Promise<PdfModel> => {
    const client = quote.clientId ? await getClient(db, quote.clientId) : null;
    return buildPdfModel({
      quote,
      items,
      clientName: client?.name ?? null,
      prefix: defaults.prefix,
      logo: defaults.logo,
      primary: appearance.primary,
      today: new Date().toISOString().slice(0, 10),
    });
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await flush();
      await action();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const status = async (next: QuoteStatus) => {
    await setQuoteStatus(db, quote.id, next);
    onStatusChanged(next);
    changed();
  };

  const pdf = () =>
    run(async () => {
      const m = await model();
      const { renderPdf } = await import("../pdf/renderPdf");
      const path = await saveFile(pdfFileName(m), await renderPdf(m), {
        name: "PDF",
        extension: "pdf",
      });
      if (path) toast(`PDF salvo: ${path}`);
    });

  const whatsapp = () =>
    run(async () => {
      await copyText(buildWhatsappMessage(defaults.whatsappTemplate, await model()));
      toast("Mensagem copiada. Cole no WhatsApp do cliente.");
    });

  // Função 4: antes de aprovar, confere se os custos subiram desde o envio.
  const approve = () =>
    run(async () => {
      const profiles = await listProfiles(db);
      const rows: StaleRow[] = [];
      for (const item of items) {
        const current = profiles.find((p) => p.id === item.profileId);
        const s = current ? itemStaleness(item, current.data) : null;
        if (s?.stale && s.costDelta > 0) {
          rows.push({
            name: item.name,
            costDelta: s.costDelta,
            marginThen: s.marginThenPercent,
            marginNow: s.marginNowPercent,
            priceToKeep: s.priceToKeepMargin,
          });
        }
      }
      if (rows.length > 0) setStale(rows);
      else await status("aprovado");
    });

  const newVersionWithTodayCosts = () =>
    run(async () => {
      const id = await newQuoteVersion(db, quote.id);
      const profiles = await listProfiles(db);
      const copy = (await getQuote(db, id))!;
      const refreshed = copy.items.map((i) => {
        const current = profiles.find((p) => p.id === i.profileId);
        return current ? syncItem({ ...i, snapshot: current.data }).item : i;
      });
      await saveQuote(db, copy.quote, refreshed);
      changed();
      setStale(null);
      navigate({ page: "novo", quoteId: id });
      toast(`Versão ${copy.quote.version} criada com os custos de hoje. Revise e envie de novo.`);
    });

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
      <Button
        variant="primary"
        icon={<FileDown size={15} />}
        disabled={busy || items.length === 0}
        onClick={pdf}
      >
        Gerar PDF
      </Button>
      <Button
        icon={<MessageCircle size={15} />}
        disabled={busy || items.length === 0}
        onClick={whatsapp}
      >
        Copiar mensagem do WhatsApp
      </Button>
      <span className="flex-1" />
      {quote.status === "rascunho" && (
        <Button
          icon={<Send size={15} />}
          disabled={busy || items.length === 0}
          onClick={() => run(() => status("enviado"))}
        >
          Marcar como enviado
        </Button>
      )}
      {quote.status === "enviado" && (
        <>
          <Button
            icon={<XCircle size={15} />}
            disabled={busy}
            onClick={() => run(() => status("recusado"))}
          >
            Recusado
          </Button>
          <Button icon={<CheckCircle2 size={15} />} disabled={busy} onClick={approve}>
            Aprovado
          </Button>
        </>
      )}
      {quote.status === "aprovado" && (
        <Button icon={<PackageCheck size={15} />} disabled={busy} onClick={() => setClosing(true)}>
          Registrar entrega
        </Button>
      )}
      {quote.status === "entregue" && (
        <Button icon={<PackageCheck size={15} />} onClick={() => setClosing(true)}>
          Ver fechamento
        </Button>
      )}

      <Modal
        open={stale !== null}
        onOpenChange={(o) => !o && setStale(null)}
        wide
        title="Os custos subiram desde que este orçamento foi feito"
        description={`${code} foi calculado com custos antigos. Você pode manter o preço combinado ou revisar.`}
        footer={
          <>
            <Button onClick={newVersionWithTodayCosts}>
              Criar nova versão com os custos de hoje
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                run(async () => {
                  await status("aprovado");
                  setStale(null);
                })
              }
            >
              Aprovar mantendo o preço
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2 text-sm">
          {(stale ?? []).map((r) => (
            <li key={r.name} className="rounded-control bg-surface-2 p-3">
              <strong>{r.name}</strong>: custo +{money(r.costDelta)}; margem de{" "}
              {percent(r.marginThen)} para {percent(r.marginNow)}. Para manter a margem:{" "}
              {money(r.priceToKeep)}.
            </li>
          ))}
        </ul>
      </Modal>

      {closing && (
        <ClosureModal
          quote={quote}
          items={items}
          code={code}
          onClose={() => setClosing(false)}
          onClosed={() => {
            onStatusChanged("entregue");
            setClosing(false);
          }}
        />
      )}
    </div>
  );
}
