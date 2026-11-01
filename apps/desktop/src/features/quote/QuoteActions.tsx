import type { Quote, QuoteItem, QuoteStatus } from "../../domain/quote";
import type { QuoteDefaults } from "../../settings/quoteDefaults";

/** Ações do orçamento (PDF, WhatsApp, status): chegam na fase 5. */
export function QuoteActions(props: {
  quote: Quote;
  items: QuoteItem[];
  code: string;
  defaults: QuoteDefaults;
  onStatusChanged(status: QuoteStatus): void;
}) {
  void props;
  return null;
}
