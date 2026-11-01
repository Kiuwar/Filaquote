-- Função 1: fechamento do pedido. Um registro por item entregue, com o que aconteceu de fato
-- (tempo real, peso pesado, reimpressões, pós). Alimenta a calibração (função 2).
CREATE TABLE IF NOT EXISTS closures (
  item_id    TEXT PRIMARY KEY NOT NULL REFERENCES quote_items(id) ON DELETE CASCADE,
  closed_on  TEXT NOT NULL,
  actual     TEXT NOT NULL,
  revenue    REAL NOT NULL,
  fees       REAL NOT NULL DEFAULT 0,
  excluded   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
