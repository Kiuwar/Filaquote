import { summarizeByMonth } from "@filaquote/engine";
import { Copy, FileText, GitBranch, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { listClosedItems } from "../../data/closures";
import { useData, useDb, useLoad } from "../../data/DataProvider";
import { deleteQuote, duplicateQuote, listQuotes, newQuoteVersion } from "../../data/quotes";
import { closureResult } from "../../domain/closure";
import { quoteCode, STATUS_LABELS, type QuoteStatus } from "../../domain/quote";
import { sanitizeQuoteDefaults, QUOTE_DEFAULTS_KEY } from "../../settings/quoteDefaults";
import { useSetting } from "../../settings/useSetting";
import { useNavigate } from "../../shell/router";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { Input } from "../../ui/Field";
import { dateBR, duration, money, percent } from "../../ui/format";
import { useConfirm } from "../../ui/Modal";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { errorMessage, useToast } from "../../ui/Toast";

const STATUS_TONE: Record<QuoteStatus, "neutral" | "primary" | "success" | "danger" | "accent"> = {
  rascunho: "neutral",
  enviado: "primary",
  aprovado: "success",
  recusado: "danger",
  entregue: "accent",
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`;

/** Função 1: lucro real × orçado, por mês, a partir dos pedidos fechados. */
function MonthlyResults() {
  const closed = useLoad((d) => listClosedItems(d), []);
  const rows = (closed.data ?? [])
    .map(({ item, closure }) => {
      const result = closureResult(item, closure);
      return result ? { closedOn: closure.closedOn, result } : null;
    })
    .filter((r) => r !== null);
  if (rows.length === 0) return null;
  const months = summarizeByMonth(rows).reverse().slice(0, 6);
  return (
    <Card
      title="Resultado real por mês"
      description="Dos pedidos entregues e fechados. Só você vê."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Mês</th>
              <th className="py-2 pr-3 font-medium">Itens</th>
              <th className="py-2 pr-3 font-medium">Recebido</th>
              <th className="py-2 pr-3 font-medium">Lucro orçado</th>
              <th className="py-2 pr-3 font-medium">Lucro real</th>
              <th className="py-2 pr-3 font-medium">Margem real</th>
              <th className="py-2 pr-3 font-medium">Reimpressões</th>
              <th className="py-2 font-medium">Horas de máquina</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-line tabular-nums">
                <td className="py-2 pr-3">{monthLabel(m.month)}</td>
                <td className="py-2 pr-3">{m.items}</td>
                <td className="py-2 pr-3">{money(m.revenue)}</td>
                <td className="py-2 pr-3">{money(m.estimatedProfit)}</td>
                <td className="py-2 pr-3">
                  {money(m.actualProfit)}{" "}
                  <span className={m.profitDeviation < 0 ? "text-warning" : "text-success"}>
                    ({m.profitDeviation >= 0 ? "+" : ""}
                    {money(m.profitDeviation)})
                  </span>
                </td>
                <td className="py-2 pr-3">{percent(m.actualMarginPercent)}</td>
                <td className="py-2 pr-3">{money(m.reprintCost)}</td>
                <td className="py-2">{duration(m.machineHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function HistoryPage() {
  const db = useDb();
  const { changed } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const defaults = useSetting(QUOTE_DEFAULTS_KEY, sanitizeQuoteDefaults);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "todos">("todos");
  const quotes = useLoad((d) => listQuotes(d, { search, status }), [search, status]);
  const prefix = defaults.value?.prefix ?? "ORC";

  const act = async (fn: () => Promise<string | void>, message: string, open = false) => {
    try {
      const id = await fn();
      changed();
      toast(message);
      if (open && id) navigate({ page: "novo", quoteId: id });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const list = quotes.data ?? [];
  return (
    <>
      <div className="flex flex-col gap-3">
        <Input
          prefix={<Search size={15} />}
          placeholder="Buscar por cliente, peça ou número"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SegmentedControl
          label="Filtrar por status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "todos", label: "Todos" },
            ...(Object.keys(STATUS_LABELS) as QuoteStatus[]).map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            })),
          ]}
        />
      </div>
      {!quotes.loading && list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum orçamento encontrado"
          description="Os orçamentos que você criar aparecem aqui."
        />
      ) : (
        <Card className="p-2">
          <ul className="divide-y divide-line">
            {list.map((q) => (
              <li key={q.id} className="flex items-center gap-3 px-3 py-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() => navigate({ page: "novo", quoteId: q.id })}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {quoteCode(prefix, q.number)}{" "}
                      <span className="font-normal text-muted">v{q.version}</span>
                    </span>
                    <Badge tone={STATUS_TONE[q.status]}>{STATUS_LABELS[q.status]}</Badge>
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {q.clientName ?? "Sem cliente"} · {q.itemNames || "sem peças"} ·{" "}
                    {dateBR(q.createdAt)}
                  </span>
                </button>
                <span className="text-sm font-semibold tabular-nums">{money(q.total)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Duplicar"
                  title="Duplicar"
                  onClick={() => act(() => duplicateQuote(db, q.id), "Orçamento duplicado.", true)}
                >
                  <Copy size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Nova versão"
                  title="Nova versão"
                  onClick={() => act(() => newQuoteVersion(db, q.id), "Nova versão criada.", true)}
                >
                  <GitBranch size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  title="Excluir"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `Excluir ${quoteCode(prefix, q.number)} v${q.version}?`,
                        description: "O orçamento, as peças e o fechamento dele serão apagados.",
                        confirmLabel: "Excluir",
                        danger: true,
                      })
                    ) {
                      await act(() => deleteQuote(db, q.id), "Orçamento excluído.");
                    }
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <MonthlyResults />
    </>
  );
}
