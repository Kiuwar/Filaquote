import {
  depreciationPerHour,
  METHOD_LABELS,
  PROFILE_FIELDS,
  ROUNDING_LABELS,
  validatePricingSettings,
  type CostProfile,
  type PricingSettings,
  type RoundingMode,
} from "@filaquote/engine";
import { Calculator, Info, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  VOLUME_FIELDS,
  resolveCostProfile,
  type ProfileData,
  type VolumeFields,
} from "../../domain/profile";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Field } from "../../ui/Field";
import { NumberInput } from "../../ui/NumberInput";
import { NumField } from "../../ui/NumField";
import { Select } from "../../ui/Select";

const COST_UNITS: Record<keyof CostProfile, { hint?: string; max?: number; prefix?: boolean }> = {
  filamentPricePerKg: { hint: "O que você pagou pelo rolo, por kg.", prefix: true },
  wastePercent: { hint: "Sobras de rolo, testes, limpeza do bico.", max: 99 },
  printerWatts: { hint: "Média imprimindo (medidor de tomada ajuda)." },
  energyTariffPerKwh: { hint: "Da sua conta de luz, com impostos e bandeira.", prefix: true },
  depreciationPerHour: { hint: "Use a calculadora ao lado.", prefix: true },
  maintenancePerHour: { hint: "Bico, mesa, correias, lubrificação.", prefix: true },
  laborPerHour: { hint: "Quanto vale sua hora de trabalho.", prefix: true },
  failurePercent: { hint: "Reserva para impressões que falham.", max: 99 },
  timeFactor: { hint: "1 = usa o tempo do fatiador. Ajustado pela calibração." },
  postProcessingFactor: { hint: "1 = usa o tempo de pós que você estima." },
};

const UNIT_ONLY = (unit: string) => unit.replace(/^R\$\//, "/").replace(/^R\$$/, "");

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card title={title} description={description}>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function DepreciationHelper({ onUse }: { onUse(value: number): void }) {
  const [price, setPrice] = useState<number | null>(null);
  const [residual, setResidual] = useState<number | null>(0);
  const [hours, setHours] = useState<number | null>(null);
  let result: number | null = null;
  let error: string | null = null;
  if (price !== null && residual !== null && hours !== null) {
    try {
      result = depreciationPerHour(price, residual, hours);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  return (
    <div className="rounded-control border border-line bg-surface-2 p-4 sm:col-span-2">
      <p className="mb-3 flex items-center gap-2 text-[13px] font-medium">
        <Calculator size={15} className="text-primary" /> Calculadora de depreciação
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumField label="Preço da impressora" prefix="R$" value={price} onChange={setPrice} />
        <NumField
          label="Valor de revenda no fim"
          prefix="R$"
          value={residual}
          onChange={setResidual}
        />
        <NumField label="Vida útil estimada" unit="h" value={hours} onChange={setHours} min={1} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">
          {error
            ? error
            : result === null
              ? "(preço − revenda) ÷ horas de vida útil"
              : `= ${result.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 4 })} por hora`}
        </span>
        <Button
          size="sm"
          disabled={result === null}
          onClick={() => result !== null && onUse(result)}
        >
          Usar este valor
        </Button>
      </div>
    </div>
  );
}

export function MarkupVsMargin() {
  return (
    <div className="flex gap-3 rounded-control bg-primary-soft p-4 text-[13px] sm:col-span-2">
      <Info size={16} className="mt-0.5 shrink-0 text-primary" />
      <div>
        <p className="font-medium">Markup e margem não são a mesma coisa</p>
        <p className="mt-1 text-muted">
          <strong className="text-ink">Markup</strong> é quanto se soma ao custo: custo R$ 60 com
          40% de markup = R$ 84. <strong className="text-ink">Margem</strong> é quanto do preço é
          lucro: para 40% de margem, preço = 60 ÷ (1 − 0,40) = R$ 100. Com o mesmo número, a margem
          sempre dá um preço maior.
        </p>
      </div>
    </div>
  );
}

export function ProfileEditor({
  data,
  onChange,
}: {
  data: ProfileData;
  onChange(next: ProfileData): void;
}) {
  const setCost = (key: keyof CostProfile, value: number | null) =>
    onChange({ ...data, cost: { ...data.cost, [key]: value } });
  const setVolume = (key: keyof VolumeFields, value: number | null) =>
    onChange({ ...data, volume: { ...data.volume, [key]: value } });
  const setPricing = (patch: Partial<PricingSettings>) =>
    onChange({ ...data, pricing: { ...data.pricing, ...patch } });
  const p = data.pricing;
  const status = resolveCostProfile(data);
  const pricingIssues = validatePricingSettings(p);

  const costField = (key: keyof CostProfile) => {
    const meta = PROFILE_FIELDS[key];
    const extra = COST_UNITS[key];
    return (
      <NumField
        key={key}
        label={meta.label}
        unit={extra.prefix ? UNIT_ONLY(meta.unit) || undefined : meta.unit}
        prefix={extra.prefix ? "R$" : undefined}
        hint={extra.hint}
        max={extra.max}
        min={key === "timeFactor" || key === "postProcessingFactor" ? 0.01 : 0}
        value={data.cost[key]}
        onChange={(v) => setCost(key, v)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {status.ok ? (
          <Badge tone="success">Custo completo</Badge>
        ) : (
          <Badge tone="warning">A confirmar: {status.missing.join(", ")}</Badge>
        )}
        {pricingIssues.length > 0 && (
          <Badge tone="danger">{pricingIssues.map((i) => i.message).join("; ")}</Badge>
        )}
      </div>

      <Section title="Material e energia">
        {costField("filamentPricePerKg")}
        {costField("wastePercent")}
        {costField("printerWatts")}
        {costField("energyTariffPerKwh")}
      </Section>

      <Section title="Máquina, mão de obra e falhas">
        {costField("depreciationPerHour")}
        {costField("maintenancePerHour")}
        <DepreciationHelper
          onUse={(v) => setCost("depreciationPerHour", Math.round(v * 10000) / 10000)}
        />
        {costField("laborPerHour")}
        {costField("failurePercent")}
      </Section>

      <Section
        title="Calibração"
        description="Corrigem o tempo do fatiador e o seu tempo de pós-processamento. Os pedidos fechados sugerem valores."
      >
        {costField("timeFactor")}
        {costField("postProcessingFactor")}
      </Section>

      <Section
        title="Estimativa por STL"
        description="Usada só quando você importa um STL (sem fatiar). Gramas = volume × densidade × [maciço + (1 − maciço) × preenchimento]; horas = gramas ÷ vazão."
      >
        {(Object.keys(VOLUME_FIELDS) as Array<keyof VolumeFields>).map((key) => (
          <NumField
            key={key}
            label={VOLUME_FIELDS[key].label}
            unit={VOLUME_FIELDS[key].unit}
            hint={VOLUME_FIELDS[key].hint}
            max={key === "infillPercent" ? 100 : key === "solidFraction" ? 1 : undefined}
            value={data.volume[key]}
            onChange={(v) => setVolume(key, v)}
          />
        ))}
      </Section>

      <Section
        title="Preço"
        description="Cada método só aparece no comparador quando seus campos estão preenchidos."
      >
        <MarkupVsMargin />
        <NumField
          label="Markup sobre o custo"
          unit="%"
          value={p.markupPercent}
          onChange={(v) => setPricing({ markupPercent: v })}
        />
        <NumField
          label="Margem sobre o preço"
          unit="%"
          max={99}
          value={p.marginPercent}
          onChange={(v) => setPricing({ marginPercent: v })}
        />
        <NumField
          label="Meta por hora de máquina"
          prefix="R$"
          unit="/h"
          value={p.machineHourRate}
          onChange={(v) => setPricing({ machineHourRate: v })}
        />
        <NumField
          label="Preço por grama"
          prefix="R$"
          unit="/g"
          value={p.pricePerGram}
          onChange={(v) => setPricing({ pricePerGram: v })}
        />
        <Field label="Método da faixa “recomendado”">
          {({ id }) => (
            <Select
              id={id}
              value={p.recommendedMethod}
              onValueChange={(v) =>
                setPricing({ recommendedMethod: v as PricingSettings["recommendedMethod"] })
              }
              options={(["margin", "markup", "machineHour", "perGram", "marketplace"] as const).map(
                (m) => ({
                  value: m,
                  label: METHOD_LABELS[m],
                }),
              )}
            />
          )}
        </Field>
        <Field label="Arredondamento">
          {({ id }) => (
            <Select
              id={id}
              value={p.rounding}
              onValueChange={(v) => setPricing({ rounding: v as RoundingMode })}
              options={(Object.keys(ROUNDING_LABELS) as RoundingMode[]).map((r) => ({
                value: r,
                label: ROUNDING_LABELS[r],
              }))}
            />
          )}
        </Field>
        <NumField
          label="Margem mínima (faixa “mínimo”)"
          unit="%"
          max={99}
          value={p.minimumMarginPercent}
          onChange={(v) => setPricing({ minimumMarginPercent: v })}
        />
        <NumField
          label="Acréscimo da faixa “premium”"
          unit="%"
          value={p.premiumPercent}
          onChange={(v) => setPricing({ premiumPercent: v })}
        />
        <NumField
          label="Preço mínimo por unidade"
          prefix="R$"
          value={p.minimumUnitPrice}
          onChange={(v) => setPricing({ minimumUnitPrice: v })}
        />
      </Section>

      <Card
        title="Desconto por quantidade"
        description="Aplicado sobre o preço recomendado (método 7)."
      >
        <div className="flex flex-col gap-2">
          {p.quantityTiers.length === 0 && (
            <p className="text-sm text-muted">Nenhuma faixa cadastrada.</p>
          )}
          {p.quantityTiers.map((tier, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
              <NumberInput
                aria-label={`Faixa ${i + 1}: a partir de`}
                value={tier.minQuantity}
                integer
                min={1}
                prefix="a partir de"
                suffix="un."
                onChange={(v) =>
                  setPricing({
                    quantityTiers: p.quantityTiers.map((t, j) =>
                      j === i ? { ...t, minQuantity: v ?? 1 } : t,
                    ),
                  })
                }
              />
              <NumberInput
                aria-label={`Faixa ${i + 1}: desconto`}
                value={tier.discountPercent}
                max={99}
                prefix="desconto"
                suffix="%"
                onChange={(v) =>
                  setPricing({
                    quantityTiers: p.quantityTiers.map((t, j) =>
                      j === i ? { ...t, discountPercent: v ?? 0 } : t,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover faixa"
                onClick={() =>
                  setPricing({ quantityTiers: p.quantityTiers.filter((_, j) => j !== i) })
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
                setPricing({
                  quantityTiers: [
                    ...p.quantityTiers,
                    {
                      minQuantity: (p.quantityTiers.at(-1)?.minQuantity ?? 1) * 2 || 2,
                      discountPercent: 0,
                    },
                  ],
                })
              }
            >
              Adicionar faixa
            </Button>
          </div>
        </div>
      </Card>

      <Section
        title="Marketplace"
        description="Taxas da plataforma em que você vende. Confirme os valores atuais com o marketplace: o app não traz nenhum."
      >
        <NumField
          label="Taxa percentual"
          unit="%"
          max={99}
          value={p.marketplaceFeePercent}
          onChange={(v) => setPricing({ marketplaceFeePercent: v })}
        />
        <NumField
          label="Taxa fixa por venda"
          prefix="R$"
          value={p.marketplaceFixedFee}
          onChange={(v) => setPricing({ marketplaceFixedFee: v })}
        />
        <NumField
          label="Frete pago por você"
          prefix="R$"
          value={p.marketplaceShipping}
          onChange={(v) => setPricing({ marketplaceShipping: v })}
        />
        <NumField
          label="Margem desejada no marketplace"
          unit="%"
          max={99}
          value={p.marketplaceMarginPercent}
          onChange={(v) => setPricing({ marketplaceMarginPercent: v })}
        />
      </Section>
    </div>
  );
}
