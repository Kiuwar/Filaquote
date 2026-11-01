import { Copy, Plus, Save, SlidersHorizontal, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useData, useDb, useLoad } from "../../data/DataProvider";
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  listProfiles,
  setDefaultProfile,
  updateProfile,
} from "../../data/profiles";
import {
  emptyProfileData,
  resolveCostProfile,
  type Profile,
  type ProfileData,
} from "../../domain/profile";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { EmptyState } from "../../ui/EmptyState";
import { Field, Input } from "../../ui/Field";
import { useConfirm } from "../../ui/Modal";
import { errorMessage, useToast } from "../../ui/Toast";
import { ProfileEditor } from "./ProfileEditor";

function Editor({ profile, onSaved }: { profile: Profile; onSaved(): void }) {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(profile.name);
  const [data, setData] = useState<ProfileData>(profile.data);
  const dirty = name !== profile.name || JSON.stringify(data) !== JSON.stringify(profile.data);

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast(message);
      onSaved();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-end gap-3 bg-bg/90 px-1 pt-1 pb-3 backdrop-blur">
        <div className="min-w-56 flex-1">
          <Field label="Nome do perfil">
            {({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
        </div>
        <Button
          variant="primary"
          icon={<Save size={15} />}
          disabled={!dirty}
          onClick={() => run(() => updateProfile(db, profile.id, name, data), "Perfil salvo.")}
        >
          Salvar
        </Button>
        <Button
          icon={<Copy size={15} />}
          onClick={() => run(() => duplicateProfile(db, profile.id), "Perfil duplicado.")}
        >
          Duplicar
        </Button>
        {!profile.isDefault && (
          <Button
            icon={<Star size={15} />}
            onClick={() => run(() => setDefaultProfile(db, profile.id), "Agora é o perfil padrão.")}
          >
            Tornar padrão
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Excluir perfil"
          onClick={async () => {
            const ok = await confirm({
              title: `Excluir “${profile.name}”?`,
              description: "Orçamentos já feitos guardam uma cópia dos parâmetros e não mudam.",
              confirmLabel: "Excluir",
              danger: true,
            });
            if (ok) await run(() => deleteProfile(db, profile.id), "Perfil excluído.");
          }}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      <ProfileEditor data={data} onChange={setData} />
    </div>
  );
}

export function ProfilesPage() {
  const db = useDb();
  const { changed } = useData();
  const toast = useToast();
  const profiles = useLoad(listProfiles, []);
  const [selected, setSelected] = useState<string | null>(null);

  const list = profiles.data ?? [];
  const current = list.find((p) => p.id === selected) ?? list[0];

  const create = async () => {
    try {
      const id = await createProfile(db, `Perfil ${list.length + 1}`, emptyProfileData());
      setSelected(id);
      changed();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  if (profiles.loading) return null;
  if (list.length === 0) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="Nenhum perfil de cálculo ainda"
        description="Um perfil guarda uma forma de calcular: preço do filamento, energia, máquina, mão de obra e regras de preço. Crie quantos quiser."
        action={
          <Button variant="primary" icon={<Plus size={15} />} onClick={create}>
            Criar primeiro perfil
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 flex w-56 shrink-0 flex-col gap-2">
        {list.map((p) => {
          const status = resolveCostProfile(p.data);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={cn(
                "cursor-pointer rounded-control border p-3 text-left transition-all duration-(--fq-dur) ease-fq",
                p.id === current?.id
                  ? "border-primary bg-surface shadow-[0_0_0_3px_var(--fq-primary-soft)]"
                  : "border-line bg-surface hover:shadow-raised",
              )}
            >
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                {p.isDefault && <Badge tone="primary">Padrão</Badge>}
                {!status.ok && <Badge tone="warning">A confirmar</Badge>}
              </span>
            </button>
          );
        })}
        <Button icon={<Plus size={15} />} onClick={create}>
          Novo perfil
        </Button>
      </div>
      {current && (
        <Editor
          key={`${current.id}:${current.updatedAt}`}
          profile={current}
          onSaved={() => {
            changed();
          }}
        />
      )}
    </div>
  );
}
