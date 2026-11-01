import { useState } from "react";
import { createClient, updateClient, type ClientInput } from "../../data/clients";
import { useData, useDb } from "../../data/DataProvider";
import type { Client } from "../../domain/quote";
import { Button } from "../../ui/Button";
import { Field, Input } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import { Textarea } from "../../ui/Textarea";
import { errorMessage, useToast } from "../../ui/Toast";

/** Cadastro mínimo: só o necessário para orçar e entregar (LGPD: menos dados, menos risco). */
export function ClientFormModal({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  client?: Client | null;
  onSaved?(id: string): void;
}) {
  const db = useDb();
  const { changed } = useData();
  const toast = useToast();
  const [form, setForm] = useState<ClientInput>({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
  });
  const set = (patch: Partial<ClientInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    try {
      const id = client
        ? (await updateClient(db, client.id, form), client.id)
        : await createClient(db, form);
      changed();
      toast(client ? "Cliente atualizado." : "Cliente cadastrado.");
      onSaved?.(id);
      onOpenChange(false);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={client ? "Editar cliente" : "Novo cliente"}
      description="Fica só neste computador. Guarde apenas o necessário para orçar e entregar."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" disabled={!form.name.trim()} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome">
          {({ id }) => (
            <Input
              id={id}
              autoFocus
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp / telefone">
            {({ id }) => (
              <Input
                id={id}
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field label="E-mail">
            {({ id }) => (
              <Input
                id={id}
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field label="Observações">
          {({ id }) => (
            <Textarea id={id} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          )}
        </Field>
      </div>
    </Modal>
  );
}
