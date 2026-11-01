import { isTauri } from "./tauri";

/**
 * Pergunta onde salvar e grava o arquivo. Devolve o caminho escolhido, ou `null` se o
 * usuário cancelou. No navegador (desenvolvimento), baixa o arquivo.
 */
export async function saveFile(
  defaultName: string,
  bytes: Uint8Array,
  filter: { name: string; extension: "pdf" | "json" },
): Promise<string | null> {
  if (!isTauri()) {
    const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>]));
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return defaultName;
  }
  const [{ save }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: filter.name, extensions: [filter.extension] }],
  });
  if (!path) return null;
  const finalPath = path.toLowerCase().endsWith(`.${filter.extension}`)
    ? path
    : `${path}.${filter.extension}`;
  await invoke("save_file", { path: finalPath, contents: Array.from(bytes) });
  return finalPath;
}

/** Copia texto para a área de transferência (com alternativa para WebViews antigos). */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
