import { FilePlus2, Lock, Plus, Repeat, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { listClients } from "../../data/clients";
import { useData, useDb, useLoad } from "../../data/DataProvider";
import { savePartFromItem, type Part } from "../../data/parts";
import { listProfiles } from "../../data/profiles";
import {
  createQuote,
  getQuote,
  listQuotes,
  newItem,
  newQuoteVersion,
  saveQuote,
} from "../../data/quotes";
import type { Profile } from "../../domain/profile";
import {
  quoteCode,
  quoteTotals,
  STATUS_LABELS,
  syncItem,
  type Quote,
  type QuoteItem,
} from "../../domain/quote";
import {
  sanitizeQuoteDefaults,
  QUOTE_DEFAULTS_KEY,
  type QuoteDefaults,
} from "../../settings/quoteDefaults";
import { useSetting } from "../../settings/useSetting";
import { useNavigate } from "../../shell/router";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { Field, Input } from "../../ui/Field";
import { dateBR, money, percent } from "../../ui/format";
import { Select } from "../../ui/Select";
import { Switch } from "../../ui/Switch";
import { Textarea } from "../../ui/Textarea";
import { errorMessage, useToast } from "../../ui/Toast";
import { ClientFormModal } from "../clients/ClientFormModal";
import { ItemEditor } from "./ItemEditor";
import { PartsPicker } from "./PartsPicker";
import { QuoteActions } from "./QuoteActions";

function StartScreen({ defaults }: { defaults: QuoteDefaults }) {
  const db = useDb();
  const navigate = useNavigate();
  const toast = useToast();
  const drafts = useLoad((d) => listQuotes(d, { status: "rascunho" }), []);
  const start = async () => {
    try {
      const id = await createQuote(db, defaults);
      navigate({ page: "novo", quoteId: id });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <EmptyState
        icon={FilePlus2}
        title="Novo orçamento"
        description="Várias peças, quantidades e acabamentos. O preço de cada peça sai do comparador de métodos."
        action={
          <Button variant="primary" icon={<Plus size={15} />} onClick={start}>
            Começar orçamento
          </Button>
        }
      />
      {(drafts.data ?? []).length > 0 && (
        <Card title="Rascunhos" description="Continue de onde parou.">
          <ul className="divide-y divide-line">
            {drafts.data!.slice(0, 8).map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-primary"
                  onClick={() => navigate({ page: "novo", quoteId: q.id })}
                >
                  <span>
                    {quoteCode(defaults.prefix, q.number)} · v{q.version} ·{" "}
                    {q.clientName ?? "sem cliente"}
                    <span className="text-muted"> · {q.itemNames || "sem peças"}</span>
                  </span>
                  <span className="tabular-nums">{money(q.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Editor({
  initial,
  profiles,
  defaults,
}: {
  initial: { quote: Quote; items: QuoteItem[] };
  profiles: Profile[];
  defaults: QuoteDefaults;
}) {
  const db = useDb();
  const { changed } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const clients = useLoad((d) => listClients(d), []);
  const [quote, setQuote] = useState(initial.quote);
  const [items, setItems] = useState(() => initial.items.map((i) => syncItem(i).item));
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [clientModal, setClientModal] = useState(false);
  const [picker, setPicker] = useState(false);
  const readOnly = quote.status !== "rascunho";
  const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;

  const calcs = useMemo(() => items.map((i) => syncItem(i).calc), [items]);
  const totals = quoteTotals(items);

  // Salva sozinho, pouco depois de cada mudança.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (readOnly) return;
    const timer = window.setTimeout(() => {
      setSaving("saving");
      saveQuote(db, quote, items).then(
        () => setSaving("saved"),
        (err: unknown) => {
          setSaving("error");
          toast(`Não foi possível salvar: ${errorMessage(err)}`, "error");
        },
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [db, quote, items, readOnly, toast]);

  const setQ = (patch: Partial<Quote>) => setQuote((q) => ({ ...q, ...patch }));
  const updateItem = (id: string, patch: Partial<QuoteItem>) =>
    setItems((list) => list.map((i) => (i.id === id ? syncItem({ ...i, ...patch }).item : i)));

  const addBlank = () =>
    setItems((list) => [
      ...list,
      newItem(
        quote.id,
        list.length,
        defaultProfile?.id ?? null,
        defaultProfile?.data ?? profiles[0]!.data,
      ),
    ]);

  const addPart = (part: Part) => {
    const base = newItem(quote.id, items.length, defaultProfile?.id ?? null, defaultProfile!.data);
    const item: QuoteItem = {
      ...base,
      name: part.name,
      finish: part.finish,
      input: part.input,
      plate: part.plate,
      partId: part.id,
      method: "faixa:recommended",
    };
    setItems((list) => [...list, syncItem(item).item]);
    setPicker(false);
    toast(`“${part.name}” adicionada com os custos de hoje.`);
  };

  const saveAsPart = async (item: QuoteItem) => {
    try {
      const partId = await savePartFromItem(db, item);
      updateItem(item.id, { partId });
      changed();
      toast("Peça recorrente salva.");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const code = quoteCode(defaults.prefix, quote.number);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {code} <span className="text-muted">· versão {quote.version}</span>
          </h2>
          <Badge
            tone={
              quote.status === "aprovado" || quote.status === "entregue"
                ? "success"
                : quote.status === "recusado"
                  ? "danger"
                  : quote.status === "enviado"
                    ? "primary"
                    : "neutral"
            }
          >
            {STATUS_LABELS[quote.status]}
          </Badge>
          <span className="ml-auto text-xs text-muted">
            {readOnly
              ? ""
              : saving === "saving"
                ? "Salvando…"
                : saving === "saved"
                  ? "Salvo"
                  : saving === "error"
                    ? "Erro ao salvar"
                    : ""}
          </span>
        </div>
        {readOnly && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-control bg-surface-2 p-3 text-sm">
            <span className="flex items-center gap-2">
              <Lock size={15} className="text-muted" /> Já saiu do rascunho. Para mudar, crie uma
              nova versão (o número continua o mesmo).
            </span>
            <Button
              size="sm"
              onClick={async () => {
                const id = await newQuoteVersion(db, quote.id);
                changed();
                navigate({ page: "novo", quoteId: id });
              }}
            >
              Criar versão {quote.version + 1}
            </Button>
          </div>
        )}
        <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            {({ id }) => (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    id={id}
                    value={quote.clientId ?? ""}
                    placeholder="Sem cliente"
                    onValueChange={(clientId) => setQ({ clientId })}
                    options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  />
                </div>
                <Button size="icon" aria-label="Novo cliente" onClick={() => setClientModal(true)}>
                  <UserPlus size={15} />
                </Button>
              </div>
            )}
          </Field>
          <Field
            label="Válido até"
            hint={quote.validUntil ? dateBR(quote.validUntil) : "Sem validade definida"}
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="date"
                value={quote.validUntil ?? ""}
                onChange={(e) => setQ({ validUntil: e.target.value || null })}
              />
            )}
          </Field>
          <Field label="Condições de pagamento">
            {({ id }) => (
              <Input
                id={id}
                placeholder="ex.: Pix, 50% na aprovação"
                value={quote.paymentTerms}
                onChange={(e) => setQ({ paymentTerms: e.target.value })}
              />
            )}
          </Field>
          <Field label="Prazo de entrega">
            {({ id }) => (
              <Input
                id={id}
                placeholder="ex.: 5 dias úteis após aprovação"
                value={quote.leadTime}
                onChange={(e) => setQ({ leadTime: e.target.value })}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações para o cliente">
              {({ id }) => (
                <Textarea
                  id={id}
                  value={quote.notes}
                  onChange={(e) => setQ({ notes: e.target.value })}
                />
              )}
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Switch
              checked={quote.showBreakdown}
              onCheckedChange={(showBreakdown) => setQ({ showBreakdown })}
              label="Mostrar cada peça no PDF"
              description="Desligado: o cliente vê só o preço final. Custo interno e margem nunca aparecem."
            />
          </div>
        </fieldset>
      </Card>

      {items.map((item, index) => (
        <ItemEditor
          key={item.id}
          item={item}
          calc={calcs[index]!}
          index={index}
          profiles={profiles}
          readOnly={readOnly}
          onChange={(patch) => updateItem(item.id, patch)}
          onRemove={() => setItems((list) => list.filter((i) => i.id !== item.id))}
          onSaveAsPart={() => saveAsPart(item)}
        />
      ))}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Plus size={15} />} onClick={addBlank}>
            Adicionar peça
          </Button>
          <Button
            icon={<Repeat size={15} />}
            disabled={!defaultProfile}
            onClick={() => setPicker(true)}
          >
            Da biblioteca de peças
          </Button>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Total do orçamento</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {money(totals.price)}
            </p>
          </div>
          <div className="text-right text-[13px] text-muted">
            <p className="flex items-center justify-end gap-1">
              <Lock size={12} /> Só para você: custo {money(totals.cost)} · lucro{" "}
              {money(totals.profit)} · margem {percent(totals.marginPercent)}
            </p>
          </div>
        </div>
        <QuoteActions
          quote={quote}
          items={items}
          code={code}
          defaults={defaults}
          onStatusChanged={(status) => setQ({ status })}
          flush={async () => {
            if (!readOnly) await saveQuote(db, quote, items);
          }}
        />
      </Card>

      {clientModal && (
        <ClientFormModal
          open
          onOpenChange={setClientModal}
          onSaved={(clientId) => setQ({ clientId })}
        />
      )}
      <PartsPicker
        open={picker}
        onOpenChange={setPicker}
        currentProfile={defaultProfile?.data ?? null}
        onPick={addPart}
      />
    </div>
  );
}

export function QuotePage({ quoteId }: { quoteId?: string }) {
  const navigate = useNavigate();
  const defaults = useSetting(QUOTE_DEFAULTS_KEY, sanitizeQuoteDefaults);
  const profiles = useLoad(listProfiles, []);
  // Carrega o orçamento uma vez; depois o editor manda no estado (não recarrega a cada gravação).
  const [loaded, setLoaded] = useState<{ quote: Quote; items: QuoteItem[] } | null | undefined>(
    undefined,
  );
  const db = useDb();
  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    getQuote(db, quoteId).then((q) => !cancelled && setLoaded(q));
    return () => {
      cancelled = true;
    };
  }, [db, quoteId]);

  if (!defaults.value || !profiles.data) return null;
  if (profiles.data.length === 0) {
    return (
      <EmptyState
        icon={FilePlus2}
        title="Crie um perfil de cálculo primeiro"
        description="O perfil guarda os custos (filamento, energia, máquina, mão de obra) e as regras de preço usadas no orçamento."
        action={
          <Button variant="primary" onClick={() => navigate({ page: "perfis" })}>
            Ir para perfis de cálculo
          </Button>
        }
      />
    );
  }
  if (!quoteId) return <StartScreen defaults={defaults.value} />;
  if (loaded === undefined) return null;
  if (loaded === null) return <EmptyState icon={FilePlus2} title="Orçamento não encontrado" />;
  return <Editor initial={loaded} profiles={profiles.data} defaults={defaults.value} />;
}
