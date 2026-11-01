/** As migrations, na ordem, lidas dos mesmos arquivos que o Rust embute no app. */
const files = import.meta.glob("../../src-tauri/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const MIGRATIONS: Array<{ version: number; name: string; sql: string }> = Object.entries(
  files,
)
  .map(([path, sql]) => {
    const name = path.split("/").pop()!;
    return { version: Number(name.slice(0, 4)), name, sql };
  })
  .sort((a, b) => a.version - b.version);
