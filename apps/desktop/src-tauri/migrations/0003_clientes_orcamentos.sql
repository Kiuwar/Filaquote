-- Clientes, orçamentos e itens. Os dados dos clientes ficam só neste computador.
CREATE TABLE IF NOT EXISTS clients (
  id         TEXT PRIMARY KEY NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id             TEXT PRIMARY KEY NOT NULL,
  number         INTEGER NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  client_id      TEXT REFERENCES clients(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'rascunho'
                 CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado', 'entregue')),
  valid_until    TEXT,
  payment_terms  TEXT,
  lead_time      TEXT,
  notes          TEXT,
  show_breakdown INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at        TEXT,
  decided_at     TEXT,
  UNIQUE (number, version)
);
CREATE INDEX IF NOT EXISTS quotes_client ON quotes (client_id);

-- `profile_snapshot` guarda uma cópia do perfil usado: o orçamento não muda se o perfil mudar.
-- `input` é a entrada por unidade (gramas, tempo, pós, extras) mais o preparo do item.
CREATE TABLE IF NOT EXISTS quote_items (
  id               TEXT PRIMARY KEY NOT NULL,
  quote_id         TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  name             TEXT NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity >= 1),
  finish           TEXT,
  profile_id       TEXT,
  profile_snapshot TEXT NOT NULL,
  input            TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'manual',
  plate            TEXT,
  method           TEXT,
  target_price     REAL,
  unit_price       REAL NOT NULL DEFAULT 0,
  unit_cost        REAL NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS quote_items_quote ON quote_items (quote_id, position);
