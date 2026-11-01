import type { CostBreakdown, MethodResult, PricingResult } from "@filaquote/engine";
import { Check, ChevronDown, Lock } from "lucide-react";
import { useState } from "react";
import { BAND_PREFIX } from "../../domain/quote";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { money, percent } from "../../ui/format";
import { NumberInput } from "../../ui/NumberInput";
import { MarkupVsMargin } from "../profiles/ProfileEditor";

function CostSummary({ cost, quantity }: { cost: CostBreakdown; quantity: number }) {
  const rows: Array<[string, number]> = [
    ["Material", cost.material],
    ["Energia", cost.energy],
    ["Máquina", cost.machine],
    ["Mão de obra", cost.labor],
    ["Extras", cost.extras],
    ["Reserva de falha", cost.failure],
  ];
  return (
    <div className="rounded-control border border-line bg-surface-2 p-4">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-medium">
        <Lock size={13} className="text-muted" /> Custo interno{" "}
        <span className="text-muted">(nunca vai para o cliente)</span>
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-muted">{label}</dt>
            <dd className="tabular-nums">{money(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-medium">
        <span>
          Total ({quantity} un.) · por unidade {money(cost.total / quantity)}
        </span>
        <span className="tabular-nums">{money(cost.total)}</span>
      </p>
    </div>
  );
}

function MethodCard({ m, selected, onUse }: { m: MethodResult; selected: boolean; onUse(): void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "flex flex-col rounded-control border bg-surface p-3 transition-all duration-(--fq-dur) ease-fq",
        selected ? "border-primary shadow-[0_0_0_3px_var(--fq-primary-soft)]" : "border-line",
        !m.available && "opacity-75",
      )}
    >
      <p className="text-[13px] font-medium">{m.label}</p>
      {m.available ? (
        <>
          <p className="mt-1 text-lg font-semibold tabular-nums">{money(m.unitPrice)}</p>
          <p className="text-xs text-muted">
            margem {percent(m.marginPercent)} · markup {percent(m.markupPercent)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted">A confirmar: {m.missing.join(", ")}</p>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-ink"
      >
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} /> Como
        foi calculado
      </button>
      {open && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
          {m.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {m.available && (
        <Button
          size="sm"
          className="mt-3"
          variant={selected ? "primary" : "secondary"}
          onClick={onUse}
        >
          {selected ? <Check size={14} /> : null}
          {selected ? "Em uso" : "Usar este"}
        </Button>
      )}
    </div>
  );
}

export function Comparator({
  pricing,
  cost,
  quantity,
  method,
  unitPrice,
  targetPrice,
  onChoose,
  onTarget,
  onManual,
}: {
  pricing: PricingResult;
  cost: CostBreakdown;
  quantity: number;
  method: string | null;
  unitPrice: number;
  targetPrice: number | null;
  onChoose(method: string, unitPrice: number): void;
  onTarget(price: number | null): void;
  onManual(price: number | null): void;
}) {
  const [showMethods, setShowMethods] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      <CostSummary cost={cost} quantity={quantity} />

      <div className="grid gap-3 sm:grid-cols-3">
        {pricing.bands.map((b) => {
          const id = `${BAND_PREFIX}${b.id}`;
          const selected = method === id;
          return (
            <div
              key={b.id}
              className={cn(
                "flex flex-col rounded-card border p-4",
                b.id === "recommended" ? "bg-primary-soft" : "bg-surface",
                selected
                  ? "border-primary shadow-[0_0_0_3px_var(--fq-primary-soft)]"
                  : "border-line",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium">{b.label}</p>
                {b.id === "recommended" && <Badge tone="primary">sugerido</Badge>}
              </div>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {money(b.unitPrice)}
              </p>
              <p className="text-xs text-muted">
                por unidade · total {money(b.totalPrice)} · margem {percent(b.marginPercent)}
              </p>
              <ul className="mt-2 flex-1 space-y-0.5 text-xs text-muted">
                {b.explanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {b.unitPrice !== null && (
                <Button
                  size="sm"
                  className="mt-3"
                  variant={selected ? "primary" : "secondary"}
                  onClick={() => onChoose(id, b.unitPrice!)}
                >
                  {selected ? "Em uso" : "Usar esta faixa"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowMethods((s) => !s)}
        className="flex cursor-pointer items-center gap-2 self-start text-sm font-medium text-muted hover:text-ink"
      >
        <ChevronDown
          size={15}
          className={cn("transition-transform", showMethods && "rotate-180")}
        />
        Comparar os 7 métodos lado a lado
      </button>
      {showMethods && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pricing.methods.map((m) => (
              <MethodCard
                key={m.id}
                m={m}
                selected={method === m.id}
                onUse={() => m.unitPrice !== null && onChoose(m.id, m.unitPrice)}
              />
            ))}
          </div>
          <MarkupVsMargin />
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Preço-alvo para o cálculo reverso (por unidade)
          <NumberInput
            aria-label="Preço-alvo"
            prefix="R$"
            value={targetPrice}
            onChange={onTarget}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Preço final por unidade {method === "manual" ? "(digitado)" : "(ou digite um valor)"}
          <NumberInput
            aria-label="Preço final por unidade"
            prefix="R$"
            value={unitPrice || null}
            onChange={onManual}
          />
        </label>
      </div>
    </div>
  );
}
