import { useCallback } from "react";
import { useData, useDb, useLoad } from "../data/DataProvider";
import { createDbKeyValueStore } from "../data/kv";
import { parseJson } from "../data/json";

/** Preferência guardada na tabela `settings`, lida e gravada como JSON. */
export function useSetting<T>(key: string, sanitize: (value: unknown) => T) {
  const db = useDb();
  const { changed } = useData();
  const state = useLoad(
    async (d) => sanitize(parseJson(await createDbKeyValueStore(d).get(key), undefined)),
    [key],
  );
  const save = useCallback(
    async (value: T) => {
      await createDbKeyValueStore(db).set(key, JSON.stringify(value));
      changed();
    },
    [db, key, changed],
  );
  return { value: state.data, loading: state.loading, save };
}
