import { sanitizeProfileData, type Profile, type ProfileData } from "../domain/profile";
import { newId, transaction, type Db } from "./db";

interface Row {
  id: string;
  name: string;
  data: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function fromRow(r: Row): Profile {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(r.data);
  } catch {
    // dado corrompido: volta ao perfil vazio em vez de quebrar a tela
  }
  return {
    id: r.id,
    name: r.name,
    isDefault: r.is_default === 1,
    data: sanitizeProfileData(parsed),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listProfiles(db: Db): Promise<Profile[]> {
  const rows = await db.select<Row>(
    "SELECT * FROM profiles ORDER BY is_default DESC, name COLLATE NOCASE",
  );
  return rows.map(fromRow);
}

export async function getProfile(db: Db, id: string): Promise<Profile | null> {
  const rows = await db.select<Row>("SELECT * FROM profiles WHERE id = $1", [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createProfile(db: Db, name: string, data: ProfileData): Promise<string> {
  const id = newId();
  const existing = await db.select<{ n: number }>("SELECT COUNT(*) AS n FROM profiles");
  // O primeiro perfil já nasce padrão.
  const isDefault = (existing[0]?.n ?? 0) === 0 ? 1 : 0;
  await db.execute("INSERT INTO profiles (id, name, data, is_default) VALUES ($1, $2, $3, $4)", [
    id,
    name.trim() || "Perfil sem nome",
    JSON.stringify(data),
    isDefault,
  ]);
  return id;
}

export async function updateProfile(
  db: Db,
  id: string,
  name: string,
  data: ProfileData,
): Promise<void> {
  await db.execute(
    "UPDATE profiles SET name = $2, data = $3, updated_at = datetime('now') WHERE id = $1",
    [id, name.trim() || "Perfil sem nome", JSON.stringify(data)],
  );
}

export async function duplicateProfile(db: Db, id: string): Promise<string | null> {
  const p = await getProfile(db, id);
  if (!p) return null;
  return createProfile(db, `${p.name} (cópia)`, p.data);
}

export async function setDefaultProfile(db: Db, id: string): Promise<void> {
  await transaction(db, async () => {
    await db.execute("UPDATE profiles SET is_default = 0 WHERE is_default = 1");
    await db.execute("UPDATE profiles SET is_default = 1 WHERE id = $1", [id]);
  });
}

/** Exclui o perfil. Orçamentos já feitos guardam uma cópia dos parâmetros e não mudam. */
export async function deleteProfile(db: Db, id: string): Promise<void> {
  const target = await getProfile(db, id);
  await db.execute("DELETE FROM profiles WHERE id = $1", [id]);
  if (target?.isDefault) {
    const next = await db.select<{ id: string }>(
      "SELECT id FROM profiles ORDER BY name COLLATE NOCASE LIMIT 1",
    );
    if (next[0]) await setDefaultProfile(db, next[0].id);
  }
}
