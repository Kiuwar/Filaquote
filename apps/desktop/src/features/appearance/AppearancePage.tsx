import { AlertTriangle, Check, Monitor, Moon, Sun, Wand2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAppearance } from "../../settings/appearance";
import { PALETTES } from "../../theme/palettes";
import { checkContrast, fixColorContrast, type ThemeMode } from "../../theme/theme";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ColorField } from "../../ui/ColorField";
import { cn } from "../../ui/cn";
import { Field, Input } from "../../ui/Field";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { Select } from "../../ui/Select";
import { Switch } from "../../ui/Switch";

const MODE_OPTIONS = [
  { value: "light", label: "Claro", icon: <Sun size={15} /> },
  { value: "dark", label: "Escuro", icon: <Moon size={15} /> },
  { value: "system", label: "Sistema", icon: <Monitor size={15} /> },
] as const satisfies ReadonlyArray<{ value: ThemeMode; label: string; icon: ReactNode }>;

const ratioFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatRatio(n: number): string {
  return `${ratioFormat.format(n)}:1`;
}

function ContrastPanel() {
  const { appearance, update } = useAppearance();
  const checks = checkContrast(appearance);
  const failing = checks.filter((c) => !c.ok);

  const autoFix = () => {
    update({
      primary: fixColorContrast(appearance.primary),
      accent: fixColorContrast(appearance.accent),
      paletteId: null,
    });
  };

  return (
    <div className="rounded-control border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Contraste</h3>
          {failing.length === 0 ? (
            <Badge tone="success" icon={<Check size={12} />}>
              Tudo legível
            </Badge>
          ) : (
            <Badge tone="warning" icon={<AlertTriangle size={12} />}>
              {failing.length === 1
                ? "1 ponto abaixo do mínimo"
                : `${failing.length} pontos abaixo do mínimo`}
            </Badge>
          )}
        </div>
        {failing.length > 0 && (
          <Button size="sm" variant="primary" icon={<Wand2 size={14} />} onClick={autoFix}>
            Corrigir automaticamente
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["primary", "accent"] as const).map((role) => (
          <div key={role}>
            <h4 className="mb-1.5 flex items-center gap-2 text-[13px] font-medium">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: appearance[role] }}
                aria-hidden="true"
              />
              {role === "primary" ? "Cor principal" : "Cor de destaque"}
            </h4>
            <ul className="flex flex-col gap-1">
              {checks
                .filter((c) => c.role === role)
                .map((c) => (
                  <li
                    key={c.id}
                    aria-label={`${c.label}: ${formatRatio(c.ratio)}, mínimo ${formatRatio(c.min)}`}
                    className="flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="flex items-center gap-1.5">
                      {c.ok ? (
                        <Check size={14} className="text-success" />
                      ) : (
                        <AlertTriangle size={14} className="text-warning" />
                      )}
                      {c.shortLabel}
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        c.ok ? "text-muted" : "font-medium text-warning",
                      )}
                    >
                      {formatRatio(c.ratio)}{" "}
                      <span className="text-muted">(mín. {formatRatio(c.min)})</span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Mínimos do WCAG 2.x: 4,5:1 para texto e 3:1 para elementos de interface. A mesma cor é usada
        nos temas claro e escuro, por isso as duas checagens.
      </p>
    </div>
  );
}

function Preview() {
  const [weight, setWeight] = useState("42");
  const [finish, setFinish] = useState("lixado");
  const [detail, setDetail] = useState(true);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Salvar orçamento</Button>
          <Button>Duplicar</Button>
          <Button variant="ghost">Cancelar</Button>
        </div>
        <Field label="Peso da peça" hint="Exemplo de campo com unidade.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={weight}
              inputMode="decimal"
              suffix="g"
              onChange={(e) => setWeight(e.target.value)}
            />
          )}
        </Field>
        <Field label="Acabamento">
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={finish}
              onValueChange={setFinish}
              options={[
                { value: "bruto", label: "Bruto de impressão" },
                { value: "lixado", label: "Lixado" },
                { value: "pintado", label: "Pintado" },
              ]}
            />
          )}
        </Field>
        <Switch
          checked={detail}
          onCheckedChange={setDetail}
          label="Mostrar detalhamento no PDF"
          description="Exemplo de chave liga/desliga."
        />
      </div>
      <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge>Rascunho</Badge>
          <Badge tone="primary">Enviado</Badge>
          <Badge tone="success">Aprovado</Badge>
          <Badge tone="danger">Recusado</Badge>
        </div>
        <div className="mt-auto rounded-control bg-primary p-4 text-on-primary shadow-raised">
          <p className="text-xs opacity-80">Exemplo de destaque</p>
          <p className="text-2xl font-semibold tracking-tight">Preço recomendado</p>
          <p className="text-xs opacity-80">Valores reais chegam na fase 4.</p>
        </div>
        <div className="rounded-control bg-accent p-3 text-sm font-medium text-on-accent">
          Cor de destaque
        </div>
      </div>
    </div>
  );
}

export function AppearancePage() {
  const { appearance, update } = useAppearance();
  return (
    <div className="flex flex-col gap-5">
      <Card title="Tema" description="Siga o Windows ou fixe claro ou escuro.">
        <SegmentedControl
          label="Tema"
          value={appearance.mode}
          onChange={(mode) => update({ mode })}
          options={MODE_OPTIONS}
        />
      </Card>

      <Card title="Paletas prontas" description="Todas passam na checagem de contraste.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PALETTES.map((p) => {
            const active = appearance.paletteId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => update({ primary: p.primary, accent: p.accent, paletteId: p.id })}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-control border bg-surface-2 p-3 text-left",
                  "transition-all duration-(--fq-dur) ease-fq hover:-translate-y-0.5 hover:shadow-raised",
                  active
                    ? "border-primary shadow-[0_0_0_3px_var(--fq-primary-soft)]"
                    : "border-line",
                )}
              >
                <span className="flex -space-x-2">
                  <span
                    className="h-7 w-7 rounded-full border-2 border-surface"
                    style={{ background: p.primary }}
                  />
                  <span
                    className="h-7 w-7 rounded-full border-2 border-surface"
                    style={{ background: p.accent }}
                  />
                </span>
                <span className="text-sm font-medium">{p.name}</span>
                {active && <Check size={16} className="ml-auto text-primary" />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title="Cores personalizadas"
        description="Escolha a cor principal e a de destaque. Ficam salvas neste computador, para o seu usuário do Windows."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField
            label="Cor principal"
            value={appearance.primary}
            onChange={(primary) => update({ primary, paletteId: null })}
          />
          <ColorField
            label="Cor de destaque"
            value={appearance.accent}
            onChange={(accent) => update({ accent, paletteId: null })}
          />
        </div>
        <div className="mt-4">
          <ContrastPanel />
        </div>
      </Card>

      <Card title="Pré-visualização" description="Componentes do app com as cores atuais.">
        <Preview />
      </Card>
    </div>
  );
}
