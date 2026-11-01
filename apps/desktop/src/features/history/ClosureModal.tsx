import type { Reprint } from "@filaquote/engine";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { closuresForQuote, saveClosure } from "../../data/closures";
import { useData, useDb, useLoad } from "../../data/DataProvider";
import { setQuoteStatus } from "../../data/quotes";
import { closureResult, estimatedJob, type Closure } from "../../domain/closure";
import type { Quote, QuoteItem } from "../../domain/quote";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { HoursInput } from "../../ui/HoursInput";
import { Modal } from "../../ui/Modal";
import { NumberInput } from "../../ui/NumberInput";
import { NumField } from "../../ui/NumField";
import { Switch } from "../../ui/Switch";
import { decimal, duration, money, percent } from "../../ui/format";
import { errorMessage, useToast } from "../../ui/Toast";

function emptyClosure(item: QuoteItem, today: string): Closure {
  return {
    itemId: item.id,
    closedOn: today,
    actual: {},
    revenue: item.unitPrice * item.quantity,
    fees: 0,
    excluded: false,
  };
}

function ItemClosure({
  item,
  closure,
  onChange,
}: {
  item: QuoteItem;
  closure: Closure;
  onChange(c: Closure): void;
}) {
  const set = (patch: Partial<Closure["actual"]>) =>
    onChange({ ...closure, actual: { ...closure.actual, ...patch } });
  const job = estimatedJob(item);
  const result = closureResult(item, closure);
  const reprints = closure.actual.reprints ?? [];
  const setReprints = (list: Reprint[]) => set({ reprints: list });
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {item.name} <span className="text-muted">· {item.quantity} un.</span>
        </p>
        {job && (
          <span className="text-xs text-muted">
            Orçado: {duration(job.printHours)} · {decimal(job.grams + (job.purgeGrams ?? 0))} g ·
            pós {decimal(job.postMinutes)} min
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tempo real de impressão (total)" hint="Vazio = igual ao orçado.">
          {() => (
            <HoursInput
              label="Tempo real"
              value={closure.actual.printHours ?? null}
              onChange={(v) => set({ printHours: v ?? undefined })}
            />
          )}
        </Field>
        <NumField
          label="Peso real consumido (total)"
          unit="g"
          hint="Pesado na balança. Vazio = igual ao fatiador + desperdício."
          value={closure.actual.weighedGrams ?? null}
          onChange={(v) => set({ weighedGrams: v ?? undefined })}
        />
        <NumField
          label="Pós-processamento real (total)"
          unit="min"
          value={closure.actual.postMinutes ?? null}
          onChange={(v) => set({ postMinutes: v ?? undefined })}
        />
        <NumField
          label="Valor recebido"
          prefix="R$"
          value={closure.revenue}
          onChange={(v) => onChange({ ...closure, revenue: v ?? 0 })}
        />
        <NumField
          label="Taxas pagas (cartão, marketplace)"
          prefix="R$"
          value={closure.fees}
          onChange={(v) => onChange({ ...closure, fees: v ?? 0 })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium">Reimpressões (o que se perdeu em cada falha)</p>
        {reprints.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <NumberInput
              aria-label="Filamento perdido"
              suffix="g"
              value={r.grams}
              onChange={(v) =>
                setReprints(reprints.map((x, j) => (j === i ? { ...x, grams: v ?? 0 } : x)))
              }
            />
            <NumberInput
              aria-label="Horas perdidas"
              suffix="h"
              value={r.printHours}
              onChange={(v) =>
                setReprints(reprints.map((x, j) => (j === i ? { ...x, printHours: v ?? 0 } : x)))
              }
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remover reimpressão"
              onClick={() => setReprints(reprints.filter((_, j) => j !== i))}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
        <div>
          <Button
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setReprints([...reprints, { grams: 0, printHours: 0 }])}
          >
            Registrar reimpressão
          </Button>
        </div>
      </div>
      <Switch
        checked={closure.excluded}
        onCheckedChange={(excluded) => onChange({ ...closure, excluded })}
        label="Impressão atípica"
        description="Fica fora da calibração (pausa longa, troca de bico, teste)."
      />
      {result ? (
        <div className="grid gap-2 rounded-control bg-surface-2 p-3 text-sm sm:grid-cols-2">
          <span>
            Lucro orçado: <strong>{money(result.estimatedProfit)}</strong> (
            {percent(result.estimatedMarginPercent)})
          </span>
          <span>
            Lucro real:{" "}
            <strong
              className={
                result.actualProfit < result.estimatedProfit ? "text-warning" : "text-success"
              }
            >
              {money(result.actualProfit)}
            </strong>{" "}
            ({percent(result.actualMarginPercent)})
          </span>
          {result.mainDeviations.length > 0 && (
            <span className="text-xs text-muted sm:col-span-2">
              Onde mudou:{" "}
              {result.mainDeviations
                .slice(0, 3)
                .map(
                  (d) =>
                    `${{ material: "material", energy: "energia", machine: "máquina", labor: "mão de obra", extras: "extras", failure: "reimpressões" }[d.component]} ${d.amount > 0 ? "+" : ""}${money(d.amount)}`,
                )
                .join(" · ")}
            </span>
          )}
        </div>
      ) : (
        <Badge tone="warning">
          Perfil ou entrada incompletos: não dá para calcular o lucro real.
        </Badge>
      )}
    </div>
  );
}

/** Função 1: registra o que aconteceu de fato e mostra o lucro real ao lado do orçado. */
export function ClosureModal({
  quote,
  items,
  code,
  onClose,
  onClosed,
}: {
  quote: Quote;
  items: QuoteItem[];
  code: string;
  onClose(): void;
  onClosed(): void;
}) {
  const db = useDb();
  const { changed } = useData();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const existing = useLoad((d) => closuresForQuote(d, quote.id), [quote.id]);
  const [edits, setEdits] = useState<Record<string, Closure>>({});
  if (!existing.data) return null;
  const closureOf = (item: QuoteItem) =>
    edits[item.id] ?? existing.data!.get(item.id) ?? emptyClosure(item, today);

  const save = async () => {
    try {
      for (const item of items) await saveClosure(db, closureOf(item));
      if (quote.status !== "entregue") await setQuoteStatus(db, quote.id, "entregue");
      changed();
      toast("Entrega registrada.");
      onClosed();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      wide
      title={`Fechamento de ${code}`}
      description="Preencha só o que foi diferente do orçado. Os dados ajudam a calibrar o perfil."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>
            {quote.status === "entregue" ? "Salvar fechamento" : "Registrar entrega"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <ItemClosure
            key={item.id}
            item={item}
            closure={closureOf(item)}
            onChange={(c) => setEdits((e) => ({ ...e, [item.id]: c }))}
          />
        ))}
      </div>
    </Modal>
  );
}
