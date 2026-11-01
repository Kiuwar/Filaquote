-- Função 4: peças recorrentes. Guardam a ENTRADA (não o preço) e a cópia do perfil e o
-- preço do último orçamento, para mostrar o que mudou desde então.
CREATE TABLE IF NOT EXISTS parts (
  id              TEXT PRIMARY KEY NOT NULL,
  name            TEXT NOT NULL,
  finish          TEXT,
  input           TEXT NOT NULL,
  plate           TEXT,
  notes           TEXT,
  last_snapshot   TEXT,
  last_unit_price REAL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE quote_items ADD COLUMN part_id TEXT REFERENCES parts(id) ON DELETE SET NULL;
