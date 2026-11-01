import { ChevronDown, Plus, RefreshCw, Repeat, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Profile } from "../../domain/profile";
import {
  itemStaleness,
  methodLabel,
  type ItemCalc,
  type ItemInput,
  type ItemSource,
  type QuoteItem,
} from "../../domain/quote";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cn } from "../../ui/cn";
import { Field, Input } from "../../ui/Field";
import { HoursInput } from "../../ui/HoursInput";
import { NumberInput } from "../../ui/NumberInput";
import { NumField } from "../../ui/NumField";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { Select } from "../../ui/Select";
import { money, percent } from "../../ui/format";
import { Comparator } from "./Comparator";
import { StlImport, ThreeMfImport, type Imported } from "./FileImport";
import { PlatePanel } from "./PlatePanel";

function Block({
  title,
  children,
  description,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function StaleNotice({
  item,
  current,
  onRefresh,
}: {
  item: QuoteItem;
  current: Profile;
  onRefresh(): void;
}) {
  const stale = itemStaleness(item, current.data);
  if (!stale || stale.changes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-warning/40 bg-warning/10 p-3 text-[13px]">
      <span>
        O perfil “{current.name}” mudou desde que este item foi calculado (
        {stale.changes
          .map(
            (c) =>
              `${c.label.toLowerCase()} ${c.changePercent === null ? "alterado" : `${c.changePercent > 0 ? "+" : ""}${percent(c.changePercent)}`}`,
          )
          .join("; ")}
        ). Custo {stale.costDelta >= 0 ? "sobe" : "cai"} {money(Math.abs(stale.costDelta))}.
      </span>
      <Button size="sm" icon={<RefreshCw size={14} />} onClick={onRefresh}>
        Recalcular com o perfil atual
      </Button>
    </div>
  );
}

export function ItemEditor({
  item,
  calc,
  index,
  profiles,
  readOnly,
  onChange,
  onRemove,
  onSaveAsPart,
}: {
  item: QuoteItem;
  calc: ItemCalc;
  index: number;
  profiles: Profile[];
  readOnly: boolean;
  onChange(patch: Partial<QuoteItem>): void;
  onRemove(): void;
  onSaveAsPart(): void;
}) {
  const [open, setOpen] = useState(item.unitPrice === 0);
  const setInput = (patch: Partial<ItemInput>) => onChange({ input: { ...item.input, ...patch } });
  const current = profiles.find((p) => p.id === item.profileId);
  const applyImport = (source: ItemSource) => (v: Imported) =>
    onChange({
      source,
      input: { ...item.input, grams: v.grams, purgeGrams: v.purgeGrams, printHours: v.printHours },
    });

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.name}</span>
          <span className="block text-xs text-muted">
            {item.quantity} un. {item.finish && `· ${item.finish}`} · {methodLabel(item.method)}
            {item.partId && " · peça recorrente"}
          </span>
        </span>
        {calc.problems.length > 0 && <Badge tone="warning">a confirmar</Badge>}
        <span className="text-right">
          <span className="block text-sm font-semibold tabular-nums">
            {money(item.unitPrice * item.quantity)}
          </span>
          <span className="block text-xs text-muted tabular-nums">{money(item.unitPrice)}/un.</span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-muted transition-transform duration-(--fq-dur)",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <fieldset disabled={readOnly} className="flex flex-col gap-4 px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1.5fr_1.5fr]">
            <Field label="Peça">
              {({ id }) => (
                <Input
                  id={id}
                  value={item.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Quantidade">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={item.quantity}
                  integer
                  min={1}
                  onChange={(v) => onChange({ quantity: v ?? 1 })}
                />
              )}
            </Field>
            <Field label="Acabamento">
              {({ id }) => (
                <Input
                  id={id}
                  placeholder="ex.: lixado, pintado"
                  value={item.finish}
                  onChange={(e) => onChange({ finish: e.target.value })}
                />
              )}
            </Field>
            <Field label="Perfil de cálculo">
              {({ id }) => (
                <Select
                  id={id}
                  value={item.profileId ?? ""}
                  placeholder="Escolha um perfil"
                  onValueChange={(pid) => {
                    const p = profiles.find((x) => x.id === pid);
                    if (p) onChange({ profileId: p.id, snapshot: p.data });
                  }}
                  options={profiles.map((p) => ({ value: p.id, label: p.name }))}
                />
              )}
            </Field>
          </div>

          {current && !readOnly && (
            <StaleNotice
              item={item}
              current={current}
              onRefresh={() => onChange({ snapshot: current.data })}
            />
          )}

          <Block
            title="Entrada"
            description="Valores por unidade. O preparo conta uma vez por item (ou por mesa, na mesa cheia)."
          >
            <SegmentedControl
              label="Origem dos dados"
              value={item.source}
              onChange={(source) => onChange({ source })}
              options={[
                { value: "manual", label: "Digitar" },
                { value: "3mf", label: "Arquivo fatiado (3MF)" },
                { value: "stl", label: "STL" },
              ]}
            />
            {item.source === "stl" && (
              <StlImport profile={item.snapshot} onUse={applyImport("stl")} />
            )}
            {item.source === "3mf" && <ThreeMfImport onUse={applyImport("3mf")} />}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumField
                label="Filamento por unidade"
                unit="g"
                value={item.input.grams}
                onChange={(v) => setInput({ grams: v })}
              />
              <NumField
                label="Purga por unidade"
                unit="g"
                hint="Troca de cor, se o fatiador mostrar à parte."
                value={item.input.purgeGrams}
                onChange={(v) => setInput({ purgeGrams: v })}
              />
              <Field label="Tempo de impressão por unidade">
                {() => (
                  <HoursInput
                    label="Tempo de impressão"
                    value={item.input.printHours}
                    onChange={(v) => setInput({ printHours: v })}
                  />
                )}
              </Field>
              <NumField
                label="Pós-processamento por unidade"
                unit="min"
                value={item.input.postMinutes}
                onChange={(v) => setInput({ postMinutes: v })}
              />
              <NumField
                label="Preparo do item"
                unit="min"
                value={item.input.prepMinutes}
                onChange={(v) => setInput({ prepMinutes: v })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium">Extras por unidade (embalagem, insumos)</p>
              {item.input.extras.map((e, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_auto] gap-2">
                  <Input
                    aria-label="Descrição do extra"
                    value={e.label}
                    onChange={(ev) =>
                      setInput({
                        extras: item.input.extras.map((x, j) =>
                          j === i ? { ...x, label: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                  <NumberInput
                    aria-label="Valor do extra"
                    prefix="R$"
                    value={e.amount}
                    onChange={(v) =>
                      setInput({
                        extras: item.input.extras.map((x, j) =>
                          j === i ? { ...x, amount: v ?? 0 } : x,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover extra"
                    onClick={() =>
                      setInput({ extras: item.input.extras.filter((_, j) => j !== i) })
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() =>
                    setInput({ extras: [...item.input.extras, { label: "Embalagem", amount: 0 }] })
                  }
                >
                  Adicionar extra
                </Button>
              </div>
            </div>
          </Block>

          <Block
            title="Mesa cheia"
            description="Preço por quantidade a partir de duas mesas fatiadas (função 6)."
          >
            <PlatePanel
              plate={item.plate}
              tiers={calc.tiers}
              problems={calc.problems}
              onChange={(plate) => onChange({ plate })}
            />
          </Block>

          <Block title="Preço">
            {calc.problems
              .filter((p) => !p.startsWith("Mesa cheia"))
              .map((p) => (
                <p key={p} className="text-sm text-warning">
                  {p}
                </p>
              ))}
            {calc.pricing && calc.cost && (
              <Comparator
                pricing={calc.pricing}
                cost={calc.cost}
                quantity={item.quantity}
                method={item.method}
                unitPrice={item.unitPrice}
                targetPrice={item.targetPrice}
                onChoose={(method, unitPrice) => onChange({ method, unitPrice })}
                onTarget={(targetPrice) => onChange({ targetPrice })}
                onManual={(price) => onChange({ method: "manual", unitPrice: price ?? 0 })}
              />
            )}
          </Block>

          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <Button icon={<Repeat size={15} />} onClick={onSaveAsPart}>
              {item.partId ? "Atualizar peça recorrente" : "Salvar como peça recorrente"}
            </Button>
            <Button variant="ghost" icon={<Trash2 size={15} />} onClick={onRemove}>
              Remover peça
            </Button>
          </div>
        </fieldset>
      )}
    </Card>
  );
}
