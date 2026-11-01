import { createContext, useContext, type ReactNode } from "react";
import type { PageId } from "./navigation";

export interface Route {
  page: PageId;
  /** Orçamento aberto no editor (página "novo"). */
  quoteId?: string;
}

const RouterContext = createContext<((route: Route) => void) | null>(null);

export function RouterProvider({
  navigate,
  children,
}: {
  navigate(route: Route): void;
  children: ReactNode;
}) {
  return <RouterContext.Provider value={navigate}>{children}</RouterContext.Provider>;
}

export function useNavigate(): (route: Route) => void {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useNavigate precisa de <RouterProvider>");
  return ctx;
}
