import { Copy, Download, FileText, HardDrive, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import notice from "../../../../../docs/aviso-de-privacidade-minuta.md?raw";
import {
  backupCounts,
  deleteAllData,
  exportBackup,
  importBackup,
  parseBackup,
  type Backup,
} from "../../data/backup";
import { useData, useDb } from "../../data/DataProvider";
import { MIGRATIONS } from "../../data/migrations";
import { copyText, saveFile } from "../../platform/files";
import { useNavigate } from "../../shell/router";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { FileButton } from "../../ui/FileButton";
import { Modal, useConfirm } from "../../ui/Modal";
import { errorMessage, useToast } from "../../ui/Toast";

const SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 1;

const TABLE_LABELS: Record<string, string> = {
  settings: "preferências",
  profiles: "perfis",
  clients: "clientes",
  parts: "peças recorrentes",
  quotes: "orçamentos",
  quote_items: "peças orçadas",
  closures: "fechamentos",
};

export function DataPage() {
  const db = useDb();
  const { changed } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Backup | null>(null);

  const exportNow = async () => {
    try {
      const backup = await exportBackup(db, SCHEMA_VERSION);
      const bytes = new TextEncoder().encode(JSON.stringify(backup, null, 2));
      const path = await saveFile(
        `filaquote-backup-${new Date().toISOString().slice(0, 10)}.json`,
        bytes,
        {
          name: "Backup do Filaquote",
          extension: "json",
        },
      );
      if (path) toast(`Backup salvo: ${path}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const restore = async () => {
    if (!pending) return;
    try {
      await importBackup(db, pending);
      setPending(null);
      changed();
      toast("Backup importado.");
      // Recarrega para aplicar também as preferências de aparência do backup.
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast(`Nada foi alterado: ${errorMessage(err)}`, "error");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card title="Onde ficam seus dados">
        <p className="flex gap-3 text-sm text-muted">
          <HardDrive size={18} className="mt-0.5 shrink-0 text-primary" />
          Tudo fica neste computador, no banco de dados do Filaquote da sua conta do Windows. O app
          não envia nada pela internet e não tem telemetria. Arquivos só saem quando você exporta um
          PDF ou um backup.
        </p>
      </Card>

      <Card
        title="Backup"
        description="Guarde uma cópia em outro lugar (pendrive, nuvem de sua escolha). O backup contém dados de clientes: proteja o arquivo."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Download size={15} />} onClick={exportNow}>
            Exportar backup
          </Button>
          <FileButton
            accept=".json,application/json"
            onFile={async (file) => {
              try {
                setPending(parseBackup(await file.text(), SCHEMA_VERSION));
              } catch (err) {
                toast(errorMessage(err), "error");
              }
            }}
          >
            Importar backup
          </FileButton>
        </div>
      </Card>

      <Card
        title="Excluir dados"
        description="Para atender a um pedido de exclusão, apague os dados de um cliente específico na tela Clientes."
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate({ page: "clientes" })}>Ir para Clientes</Button>
          <Button
            variant="danger"
            icon={<Trash2 size={15} />}
            onClick={async () => {
              const ok = await confirm({
                title: "Apagar todos os dados?",
                description:
                  "Orçamentos, clientes, peças recorrentes, perfis e fechamentos serão apagados deste computador. Faça um backup antes, se quiser guardar.",
                confirmLabel: "Apagar tudo",
                danger: true,
              });
              if (!ok) return;
              try {
                await deleteAllData(db);
                changed();
                toast("Todos os dados foram apagados.");
              } catch (err) {
                toast(errorMessage(err), "error");
              }
            }}
          >
            Apagar todos os dados
          </Button>
        </div>
      </Card>

      <Card
        title="Aviso de privacidade para seus clientes"
        description="Minuta para adaptar e usar com quem pede orçamento. Revise com um advogado antes de usar."
        actions={
          <>
            <Button
              size="sm"
              icon={<Copy size={14} />}
              onClick={async () => (await copyText(notice), toast("Minuta copiada."))}
            >
              Copiar
            </Button>
            <Button
              size="sm"
              icon={<FileText size={14} />}
              onClick={async () => {
                const path = await saveFile(
                  "aviso-de-privacidade-minuta.txt",
                  new TextEncoder().encode(notice),
                  {
                    name: "Texto",
                    extension: "txt",
                  },
                );
                if (path) toast(`Minuta salva: ${path}`);
              }}
            >
              Salvar .txt
            </Button>
          </>
        }
      >
        <pre className="max-h-80 overflow-y-auto rounded-control bg-surface-2 p-4 font-sans text-[13px] leading-relaxed whitespace-pre-wrap select-text">
          {notice}
        </pre>
      </Card>

      <Modal
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Importar este backup?"
        description="Todos os dados atuais deste computador serão substituídos pelos do backup. Se algo der errado, nada é alterado."
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancelar</Button>
            <Button variant="danger" icon={<Upload size={15} />} onClick={restore}>
              Substituir e importar
            </Button>
          </>
        }
      >
        {pending && (
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {Object.entries(backupCounts(pending)).map(([t, n]) => (
              <li key={t}>
                {n} {TABLE_LABELS[t]}
              </li>
            ))}
            <li className="col-span-2 mt-2 text-xs text-muted">
              Exportado em {new Date(pending.exportedAt).toLocaleString("pt-BR")}
            </li>
          </ul>
        )}
      </Modal>
    </div>
  );
}
