import { compareWithSnapshot } from "@filaquote/engine";
import { Repeat, Search } from "lucide-react";
import { useState } from "react";
import { useLoad } from "../../data/DataProvider";
import { listParts, type Part } from "../../data/parts";
import { resolveCostProfile, type ProfileData } from "../../domain/profile";
import { totalJob } from "../../domain/quote";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Input } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import { money, percent } from "../../ui/format";

/** Função 4: o custo desta peça mudou desde o último orçamento? */
export function partChange(part: Part, current: ProfileData | null) {
  if (!part.lastSnapshot || !current || part.lastUnitPrice === null) return null;
  const then = resolveCostProfile(part.lastSnapshot);
  const now = resolveCostProfile(current);
  const job = totalJob(part.input, 1);
  if (!then.ok || !now.ok || "missing" in job) return null;
  return compareWithSnapshot(
    { profile: then.value, job: job.job, price: part.lastUnitPrice },
    now.value,
  );
}

export function PartsPicker({
  open,
  onOpenChange,
  currentProfile,
  onPick,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  currentProfile: ProfileData | null;
  onPick(part: Part): void;
}) {
  const [search, setSearch] = useState("");
  const parts = useLoad((db) => listParts(db, search), [search]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Peças recorrentes"
      description="O preço é recalculado com o perfil padrão de hoje."
    >
      <Input
        prefix={<Search size={15} />}
        placeholder="Buscar peça"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mt-4 flex flex-col gap-2">
        {(parts.data ?? []).length === 0 && (
          <EmptyState
            icon={Repeat}
            title="Nenhuma peça recorrente"
            description="Num item do orçamento, use “Salvar como peça recorrente”."
          />
        )}
        {(parts.data ?? []).map((p) => {
          const change = partChange(p, currentProfile);
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-control border border-line p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted">
                  Último preço: {money(p.lastUnitPrice)}
                  {change && change.stale && (
                    <>
                      {" · "}
                      <Badge tone={change.costDelta > 0 ? "warning" : "success"}>
                        custo {change.costDelta > 0 ? "subiu" : "caiu"}{" "}
                        {percent(Math.abs(change.costDeltaPercent ?? 0))}
                      </Badge>
                      {" · para manter a margem: "}
                      {money(change.priceToKeepMargin)}
                    </>
                  )}
                </p>
              </div>
              <Button size="sm" variant="primary" onClick={() => onPick(p)}>
                Adicionar
              </Button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
