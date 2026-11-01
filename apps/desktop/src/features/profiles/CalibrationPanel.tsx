import { applyCalibration, suggestCalibration, type CalibratedField } from "@filaquote/engine";
import { Wand2 } from "lucide-react";
import { useState } from "react";
import { listClosedItems, setClosureExcluded } from "../../data/closures";
import { useData, useDb, useLoad } from "../../data/DataProvider";
import { calibrationSample } from "../../domain/closure";
import { resolveCostProfile, type ProfileData } from "../../domain/profile";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { dateBR, decimal } from "../../ui/format";

const LABELS: Record<CalibratedField, { label: string; percent: boolean }> = {
  timeFactor: { label: "Fator de tempo", percent: false },
  postProcessingFactor: { label: "Fator de pós-processamento", percent: false },
  wastePercent: { label: "Desperdício", percent: true },
  failurePercent: { label: "Taxa de falha", percent: true },
};

const show = (v: number | null, percent: boolean) =>
  v === null ? "—" : percent ? `${decimal(v)}%` : `${decimal(v)}×`;

/** Função 2: sugestões de ajuste a partir dos pedidos fechados com este perfil. */
export function CalibrationPanel({
  profileId,
  data,
  onApply,
}: {
  profileId: string;
  data: ProfileData;
  onApply(next: ProfileData): void;
}) {
  const db = useDb();
  const { changed } = useData();
  const closed = useLoad((d) => listClosedItems(d, profileId), [profileId]);
  const [accepted, setAccepted] = useState<CalibratedField[]>([]);
  const cost = resolveCostProfile(data);
  const list = closed.data ?? [];

  if (!cost.ok) return null;
  const samples = list
    .map(({ item, closure }) => calibrationSample(item, closure))
    .filter((s) => s !== null);
  const result = suggestCalibration(cost.value, samples);

  return (
    <Card
      title="Calibração pelo histórico"
      description={`${result.used} pedido(s) fechado(s) com este perfil${result.excluded ? `, ${result.excluded} fora da conta` : ""}. Nada muda sem você aceitar.`}
    >
      <ul className="flex flex-col gap-2">
        {result.suggestions.map((s) => {
          const meta = LABELS[s.field];
          const checked = accepted.includes(s.field);
          return (
            <li
              key={s.field}
              className="flex flex-wrap items-center gap-3 rounded-control bg-surface-2 p-3 text-[13px]"
            >
              <input
                type="checkbox"
                aria-label={`Aceitar ${meta.label}`}
                className="h-4 w-4 accent-(--fq-primary)"
                disabled={s.suggested === null}
                checked={checked}
                onChange={(e) =>
                  setAccepted((a) =>
                    e.target.checked ? [...a, s.field] : a.filter((f) => f !== s.field),
                  )
                }
              />
              <span className="min-w-40 font-medium">{meta.label}</span>
              <span className="tabular-nums">
                atual {show(s.current, meta.percent)} → sugerido{" "}
                <strong>{show(s.suggested, meta.percent)}</strong>
              </span>
              {s.suggested === null ? (
                <Badge>faltam {s.missingSamples} pedido(s)</Badge>
              ) : s.worthApplying ? (
                <Badge tone="primary">vale ajustar</Badge>
              ) : (
                <Badge tone="success">já está bom</Badge>
              )}
              {s.range && (
                <span className="text-xs text-muted">
                  ({s.samples} amostras, de {show(s.range[0], meta.percent)} a{" "}
                  {show(s.range[1], meta.percent)})
                </span>
              )}
              {s.note && <span className="w-full text-xs text-muted">{s.note}</span>}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex justify-end">
        <Button
          variant="primary"
          icon={<Wand2 size={15} />}
          disabled={accepted.length === 0}
          onClick={() => {
            const next = applyCalibration(cost.value, result.suggestions, accepted);
            onApply({ ...data, cost: { ...next } });
            setAccepted([]);
          }}
        >
          Aplicar selecionadas (depois salve o perfil)
        </Button>
      </div>
      {list.length > 0 && (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer text-muted">Pedidos usados ({list.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {list.map(({ item, closure }) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>
                  {item.name} · {dateBR(closure.closedOn)}
                </span>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    className="accent-(--fq-primary)"
                    checked={closure.excluded}
                    onChange={async (e) => {
                      await setClosureExcluded(db, item.id, e.target.checked);
                      changed();
                    }}
                  />
                  atípico (fora da conta)
                </label>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
