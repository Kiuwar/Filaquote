-- Perfis de cálculo: as "formas de calcular" salvas pelo usuário.
-- `data` guarda em JSON os parâmetros de custo, de estimativa por volume (STL) e de preço.
CREATE TABLE IF NOT EXISTS profiles (
  id         TEXT PRIMARY KEY NOT NULL,
  name       TEXT NOT NULL,
  data       TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
