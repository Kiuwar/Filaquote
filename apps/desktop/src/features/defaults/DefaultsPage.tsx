import { Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { buildPdfModel } from "../../domain/pdfModel";
import { buildWhatsappMessage } from "../../domain/whatsapp";
import { emptyProfileData } from "../../domain/profile";
import { useAppearance } from "../../settings/appearance";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  QUOTE_DEFAULTS_KEY,
  sanitizeQuoteDefaults,
  type QuoteDefaults,
} from "../../settings/quoteDefaults";
import { useSetting } from "../../settings/useSetting";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Field, Input } from "../../ui/Field";
import { FileButton } from "../../ui/FileButton";
import { NumField } from "../../ui/NumField";
import { Textarea } from "../../ui/Textarea";
import { errorMessage, useToast } from "../../ui/Toast";

const MAX_LOGO_BYTES = 512 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Form({
  initial,
  onSave,
}: {
  initial: QuoteDefaults;
  onSave(v: QuoteDefaults): Promise<void>;
}) {
  const toast = useToast();
  const { appearance } = useAppearance();
  const [v, setV] = useState(initial);
  const set = (patch: Partial<QuoteDefaults>) => setV((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const preview = buildWhatsappMessage(
    v.whatsappTemplate,
    buildPdfModel({
      quote: {
        id: "",
        number: 7,
        version: 1,
        clientId: null,
        status: "rascunho",
        validUntil: "2026-12-15",
        paymentTerms: v.paymentTerms,
        leadTime: v.leadTime,
        notes: "",
        showBreakdown: true,
        createdAt: "",
        updatedAt: "",
        sentAt: null,
        decidedAt: null,
      },
      items: [
        {
          id: "x",
          quoteId: "",
          position: 0,
          name: "Peça de exemplo",
          quantity: 2,
          finish: "",
          profileId: null,
          snapshot: emptyProfileData(),
          input: {
            grams: 0,
            purgeGrams: 0,
            printHours: 0,
            postMinutes: 0,
            prepMinutes: 0,
            extras: [],
          },
          source: "manual",
          plate: null,
          method: null,
          targetPrice: null,
          unitPrice: 25,
          unitCost: 0,
          partId: null,
        },
      ],
      clientName: "Maria Exemplo",
      prefix: v.prefix,
      logo: null,
      primary: appearance.primary,
      today: "2026-11-01",
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Numeração e padrões"
        description="Valem para os próximos orçamentos. Nada vem preenchido: use o que você pratica."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prefixo da numeração" hint={`Ex.: ${v.prefix || "ORC"}-0007`}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={v.prefix}
                maxLength={12}
                onChange={(e) => set({ prefix: e.target.value })}
              />
            )}
          </Field>
          <NumField
            label="Validade padrão"
            unit="dias"
            integer
            value={v.validDays}
            onChange={(validDays) => set({ validDays })}
          />
          <Field label="Condições de pagamento padrão">
            {({ id }) => (
              <Input
                id={id}
                value={v.paymentTerms}
                onChange={(e) => set({ paymentTerms: e.target.value })}
              />
            )}
          </Field>
          <Field label="Prazo de entrega padrão">
            {({ id }) => (
              <Input
                id={id}
                value={v.leadTime}
                onChange={(e) => set({ leadTime: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card
        title="Logo no PDF"
        description="PNG ou JPG, até 512 KB. Sem logo, o PDF usa um selo com o número na cor principal."
      >
        <div className="flex flex-wrap items-center gap-4">
          {v.logo ? (
            <img
              src={v.logo}
              alt="Logo atual"
              className="h-14 max-w-48 rounded-control border border-line bg-white object-contain p-1"
            />
          ) : (
            <span className="text-sm text-muted">Nenhum logo.</span>
          )}
          <FileButton
            accept="image/png,image/jpeg"
            onFile={async (f) => {
              if (f.size > MAX_LOGO_BYTES) return toast("Imagem maior que 512 KB.", "error");
              try {
                set({ logo: await readAsDataUrl(f) });
              } catch (err) {
                toast(errorMessage(err), "error");
              }
            }}
          >
            Escolher logo
          </FileButton>
          {v.logo && (
            <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => set({ logo: null })}>
              Remover
            </Button>
          )}
        </div>
      </Card>

      <Card
        title="Mensagem do WhatsApp"
        description="Marcadores: {cliente}, {numero}, {total}, {validade}, {itens}, {prazo}, {pagamento}."
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set({ whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE })}
          >
            Restaurar padrão
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea
            aria-label="Modelo da mensagem"
            className="min-h-40"
            value={v.whatsappTemplate}
            onChange={(e) => set({ whatsappTemplate: e.target.value })}
          />
          <div className="rounded-control bg-surface-2 p-3 text-sm whitespace-pre-wrap">
            <p className="mb-1 text-xs font-medium text-muted">Prévia</p>
            {preview}
          </div>
        </div>
      </Card>

      <div>
        <Button
          variant="primary"
          icon={<Save size={15} />}
          disabled={!dirty}
          onClick={async () => {
            try {
              await onSave(sanitizeQuoteDefaults(v));
              toast("Padrões salvos.");
            } catch (err) {
              toast(errorMessage(err), "error");
            }
          }}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

export function DefaultsPage() {
  const setting = useSetting(QUOTE_DEFAULTS_KEY, sanitizeQuoteDefaults);
  if (!setting.value) return null;
  return <Form key={JSON.stringify(setting.value)} initial={setting.value} onSave={setting.save} />;
}
