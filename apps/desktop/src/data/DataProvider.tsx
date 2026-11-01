import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";
import type { Db } from "./db";

interface DataContextValue {
  db: Db | null;
  /** Muda a cada gravação: as telas recarregam o que mostram. */
  version: number;
  changed(): void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ db, children }: { db: Db | null; children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ db, version, changed }), [db, version, changed]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData precisa de <DataProvider>");
  return ctx;
}

/** O banco aberto. As telas só são mostradas quando ele existe (ver App). */
export function useDb(): Db {
  const { db } = useData();
  if (!db) throw new Error("Banco local indisponível");
  return db;
}

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

/** Carrega dados do banco e recarrega quando algo é gravado ou as dependências mudam. */
export function useLoad<T>(load: (db: Db) => Promise<T>, deps: DependencyList): AsyncState<T> {
  const { db, version } = useData();
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    error: null,
    loading: true,
  });
  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    load(db).then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (err: unknown) =>
        !cancelled &&
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
          loading: false,
        })),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);
  return state;
}
