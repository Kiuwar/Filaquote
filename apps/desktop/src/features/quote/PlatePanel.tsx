import type { PlateSample, QuantityTiersResult } from "@filaquote/engine";
import { AlertTriangle } from "lucide-react";
import type { PlateData } from "../../domain/quote";
import { Button } from "../../ui/Button";
import { NumberInput } from "../../ui/NumberInput";
import { Switch } from "../../ui/Switch";
import { decimal, duration, money, percent } from "../../ui/format";
import { useBambuFile } from "./FileImport";
import { FileButton } from "../../ui/FileButton";

const EMPTY: PlateData = {
  a: { copies: 1, printHours: 0, grams: 0, purgeGrams: 0 },
  b: { copies: 2, printHours: 0, grams: 0, purgeGrams: 0 },
  enabled: false,
};

function SampleRow({
  title,
  sample,
  onChange,
}: {
  title: string;
  sample: PlateSample;
  onChange(s: PlateSample): void;
}) {
  const file = useBambuFile();
  return (
    <div className="rounded-control border border-line bg-surface-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium">{title}</p>
        <FileButton accept=".3mf" onFile={file.load}>
          Ler do .gcode.3mf
        </FileButton>
      </div>
      {file.error && <p className="mb-2 text-xs text-danger">{file.error}</p>}
      {file.result && (
        <div className="mb-2 flex flex-wrap gap-2">
          {file.result.plates.map((p) => (
            <Button
              key={p.index}
              size="sm"
              onClick={() =>
                onChange({ ...sample, printHours: p.printHours, grams: p.grams, purgeGrams: 0 })
              }
            >
              Mesa {p.index}: {duration(p.printHours)}, {decimal(p.grams)} g
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumberInput
          aria-label={`${title}: cópias`}
          value={sample.copies}
          integer
          min={1}
          suffix="cópias"
          onChange={(v) => onChange({ ...sample, copies: v ?? 1 })}
        />
        <NumberInput
          aria-label={`${title}: horas`}
          value={sample.printHours}
          suffix="h"
          onChange={(v) => onChange({ ...sample, printHours: v ?? 0 })}
        />
        <NumberInput
          aria-label={`${title}: gramas`}
          value={sample.grams}
          suffix="g"
          onChange={(v) => onChange({ ...sample, grams: v ?? 0 })}
        />
        <NumberInput
          aria-label={`${title}: purga`}
          value={sample.purgeGrams ?? 0}
          suffix="g purga"
          onChange={(v) => onChange({ ...sample, purgeGrams: v ?? 0 })}
        />
      </div>
    </div>
  );
}

/** Função 6: preço por quantidade a partir da mesa cheia. */
export function PlatePanel({
  plate,
  tiers,
  problems,
  onChange,
}: {
  plate: PlateData | null;
  tiers: QuantityTiersResult | null;
  problems: string[];
  onChange(plate: PlateData | null): void;
}) {
  if (!plate) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        Fatie a mesma peça com 1 cópia e com a mesa cheia para separar o gasto por mesa do gasto por
        cópia.
        <Button size="sm" onClick={() => onChange(EMPTY)}>
          Informar as duas mesas
        </Button>
      </div>
    );
  }
  const plateProblems = problems.filter((p) => p.startsWith("Mesa cheia"));
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <SampleRow
          title="Mesa com poucas cópias"
          sample={plate.a}
          onChange={(a) => onChange({ ...plate, a })}
        />
        <SampleRow
          title="Mesa cheia"
          sample={plate.b}
          onChange={(b) => onChange({ ...plate, b })}
        />
      </div>
      {plateProblems.map((p) => (
        <p key={p} className="text-sm text-danger">
          {p}
        </p>
      ))}
      <Switch
        checked={plate.enabled}
        onCheckedChange={(enabled) => onChange({ ...plate, enabled })}
        label="Calcular o custo deste item pela mesa cheia"
        description="Preparo passa a contar por mesa; tempo e filamento seguem o modelo das duas mesas."
      />
      {tiers && (
        <div className="overflow-x-auto rounded-control border border-line">
          {tiers.warnings.map((w) => (
            <p key={w.metric} className="flex gap-2 px-3 pt-2 text-xs text-warning">
              <AlertTriangle size={13} className="shrink-0" /> {w.message}
            </p>
          ))}
          <table className="w-full text-[13px]">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Quantidade</th>
                <th className="px-3 py-2 font-medium">Mesas</th>
                <th className="px-3 py-2 font-medium">Custo/un.</th>
                <th className="px-3 py-2 font-medium">Preço que mantém a margem</th>
                <th className="px-3 py-2 font-medium">Desconto máximo</th>
              </tr>
            </thead>
            <tbody>
              {tiers.tiers.map((t) => (
                <tr key={t.quantity} className="border-t border-line tabular-nums">
                  <td className="px-3 py-2">{t.quantity}</td>
                  <td className="px-3 py-2">{t.plates}</td>
                  <td className="px-3 py-2">{money(t.unitCost)}</td>
                  <td className="px-3 py-2">
                    {money(t.suggestedUnitPrice)}{" "}
                    <span className="text-muted">(−{percent(t.suggestedDiscountPercent)})</span>
                  </td>
                  <td className="px-3 py-2">
                    {t.belowMinMargin ? (
                      <span className="text-warning">abaixo da margem mínima</span>
                    ) : (
                      percent(t.maxDiscountPercent)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Remover dados das mesas
        </Button>
      </div>
    </div>
  );
}
