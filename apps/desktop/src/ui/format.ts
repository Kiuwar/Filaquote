const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const dec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const money = (n: number | null | undefined) => (n == null ? "—" : brl.format(n));
export const percent = (n: number | null | undefined) => (n == null ? "—" : `${pct.format(n)}%`);
export const decimal = (n: number | null | undefined) => (n == null ? "—" : dec.format(n));

export function duration(hours: number | null | undefined): string {
  if (hours == null) return "—";
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "2026-11-01" ou "2026-11-01 12:00:00" → "01/11/2026". */
export function dateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
