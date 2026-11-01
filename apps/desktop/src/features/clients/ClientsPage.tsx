import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { countClientQuotes, deleteClient, listClients } from "../../data/clients";
import { useData, useDb, useLoad } from "../../data/DataProvider";
import type { Client } from "../../domain/quote";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { Input } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import { errorMessage, useToast } from "../../ui/Toast";
import { ClientFormModal } from "./ClientFormModal";

function DeleteClientModal({ client, onClose }: { client: Client; onClose(): void }) {
  const db = useDb();
  const { changed } = useData();
  const toast = useToast();
  const quotes = useLoad((d) => countClientQuotes(d, client.id), [client.id]);
  const run = async (deleteQuotes: boolean) => {
    try {
      await deleteClient(db, client.id, deleteQuotes);
      changed();
      toast("Dados do cliente excluídos.");
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  const n = quotes.data ?? 0;
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Excluir os dados de ${client.name}?`}
      description={
        n === 0
          ? "Nome, telefone, e-mail e observações serão apagados deste computador."
          : `Nome, telefone, e-mail e observações serão apagados. Há ${n} orçamento(s) dessa pessoa: você pode mantê-los sem identificação (para seu controle financeiro) ou apagá-los também.`
      }
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          {n > 0 && (
            <Button variant="danger" onClick={() => run(true)}>
              Apagar tudo
            </Button>
          )}
          <Button variant={n > 0 ? "primary" : "danger"} onClick={() => run(false)}>
            {n > 0 ? "Apagar só os dados pessoais" : "Excluir"}
          </Button>
        </>
      }
    />
  );
}

export function ClientsPage() {
  const [search, setSearch] = useState("");
  const clients = useLoad((db) => listClients(db, search), [search]);
  const [editing, setEditing] = useState<Client | null | undefined>(undefined);
  const [removing, setRemoving] = useState<Client | null>(null);
  const list = clients.data ?? [];

  return (
    <>
      <div className="flex items-center gap-3">
        <Input
          className="flex-1"
          prefix={<Search size={15} />}
          placeholder="Buscar por nome, telefone ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing(null)}>
          Novo cliente
        </Button>
      </div>
      {!clients.loading && list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description="Os dados ficam só neste computador. Dá para exportar em backup ou excluir a qualquer momento."
        />
      ) : (
        <Card className="p-2">
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "Sem contato"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${c.name}`}
                  onClick={() => setEditing(c)}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${c.name}`}
                  onClick={() => setRemoving(c)}
                >
                  <Trash2 size={15} />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editing !== undefined && (
        <ClientFormModal
          key={editing?.id ?? "novo"}
          open
          client={editing}
          onOpenChange={(o) => !o && setEditing(undefined)}
        />
      )}
      {removing && <DeleteClientModal client={removing} onClose={() => setRemoving(null)} />}
    </>
  );
}
