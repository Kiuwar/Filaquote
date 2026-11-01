import { FilePlus2, Repeat, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useData, useDb, useLoad } from "../../data/DataProvider";
import { deletePart, listParts, type Part } from "../../data/parts";
import { listProfiles } from "../../data/profiles";
import { createQuote, getQuote, newItem, saveQuote } from "../../data/quotes";
import { syncItem } from "../../domain/quote";
import { sanitizeQuoteDefaults, QUOTE_DEFAULTS_KEY } from "../../settings/quoteDefaults";
import { useSetting } from "../../settings/useSetting";
import { useNavigate } from "../../shell/router";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { Input } from "../../ui/Field";
import { decimal, duration, money, percent } from "../../ui/format";
import { useConfirm } from "../../ui/Modal";
import { errorMessage, useToast } from "../../ui/Toast";
import { partChange } from "../quote/PartsPicker";

export function PartsPage() {
  const db = useDb();
  const { changed } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const parts = useLoad((d) => listParts(d, search), [search]);
  const profiles = useLoad(listProfiles, []);
  const defaults = useSetting(QUOTE_DEFAULTS_KEY, sanitizeQuoteDefaults);
  const current = profiles.data?.find((p) => p.isDefault) ?? profiles.data?.[0] ?? null;

  const quotePart = async (part: Part) => {
    if (!current || !defaults.value) return;
    try {
      const id = await createQuote(db, defaults.value);
      const { quote } = (await getQuote(db, id))!;
      const item = syncItem({
        ...newItem(id, 0, current.id, current.data),
        name: part.name,
        finish: part.finish,
        input: part.input,
        plate: part.plate,
        partId: part.id,
        method: "faixa:recommended",
      }).item;
      await saveQuote(db, quote, [item]);
      changed();
      navigate({ page: "novo", quoteId: id });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const list = parts.data ?? [];
  return (
    <>
      <Input
        prefix={<Search size={15} />}
        placeholder="Buscar peça"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {!parts.loading && list.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={search ? "Nenhuma peça encontrada" : "Nenhuma peça recorrente"}
          description="Num item do orçamento, use “Salvar como peça recorrente”. A peça guarda gramas, tempo e acabamento, e o preço é sempre recalculado com os custos de hoje."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((p) => {
            const change = partChange(p, current?.data ?? null);
            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">
                      {decimal(p.input.grams)} g · {duration(p.input.printHours)} por unidade
                      {p.finish && ` · ${p.finish}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir ${p.name}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Excluir “${p.name}”?`,
                          description: "Orçamentos já feitos não mudam.",
                          confirmLabel: "Excluir",
                          danger: true,
                        })
                      ) {
                        await deletePart(db, p.id);
                        changed();
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span>
                    Último preço: <strong>{money(p.lastUnitPrice)}</strong>
                    {change?.stale && (
                      <>
                        {" "}
                        <Badge tone={change.costDelta > 0 ? "warning" : "success"}>
                          custo {change.costDelta > 0 ? "+" : "−"}
                          {percent(Math.abs(change.costDeltaPercent ?? 0))}
                        </Badge>
                        <span className="block text-xs text-muted">
                          Para manter a margem: {money(change.priceToKeepMargin)} ·{" "}
                          {change.changes.map((c) => c.label.toLowerCase()).join(", ")} mudou
                        </span>
                      </>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<FilePlus2 size={14} />}
                    disabled={!current}
                    onClick={() => quotePart(p)}
                  >
                    Orçar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
