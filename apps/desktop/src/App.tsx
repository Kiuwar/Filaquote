import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useData } from "./data/DataProvider";
import { AppearancePage } from "./features/appearance/AppearancePage";
import { ClientsPage } from "./features/clients/ClientsPage";
import { PartsPage } from "./features/parts/PartsPage";
import { ComingSoon } from "./features/placeholder/ComingSoon";
import { QuotePage } from "./features/quote/QuotePage";
import { ProfilesPage } from "./features/profiles/ProfilesPage";
import { findNavItem } from "./shell/navigation";
import { RouterProvider, type Route } from "./shell/router";
import { Sidebar } from "./shell/Sidebar";
import { TitleBar } from "./shell/TitleBar";
import { WindowFrame } from "./shell/WindowFrame";
import { cn } from "./ui/cn";
import { ConfirmProvider } from "./ui/Modal";
import { ToastProvider } from "./ui/Toast";

function PageContent({ route }: { route: Route }) {
  switch (route.page) {
    case "aparencia":
      return <AppearancePage />;
    case "perfis":
      return <ProfilesPage />;
    case "novo":
      return <QuotePage quoteId={route.quoteId} />;
    case "pecas":
      return <PartsPage />;
    case "orcamentos":
      return <ComingSoon phase={5} items={["Histórico, PDF e WhatsApp"]} />;
    case "clientes":
      return <ClientsPage />;
    case "padroes":
      return <ComingSoon phase={5} items={["Numeração, validade, logo e WhatsApp"]} />;
    case "dados":
      return <ComingSoon phase={6} items={["Backup e privacidade"]} />;
  }
}

export function App({ storageError }: { storageError?: string }) {
  const { db } = useData();
  const [route, setRoute] = useState<Route>({ page: db ? "novo" : "aparencia" });
  // Anima só a troca de página; o primeiro desenho acontece com a janela ainda oculta.
  const [navigated, setNavigated] = useState(false);
  const nav = findNavItem(route.page);
  const navigate = (next: Route) => {
    setNavigated(true);
    setRoute(next);
  };

  return (
    <ToastProvider>
      <ConfirmProvider>
        <RouterProvider navigate={navigate}>
          <WindowFrame>
            <TitleBar subtitle={nav.label} />
            <div className="flex min-h-0 flex-1">
              <Sidebar current={route.page} onSelect={(page) => navigate({ page })} />
              <main className="min-w-0 flex-1 overflow-y-auto">
                <div
                  key={`${route.page}:${route.quoteId ?? ""}`}
                  className={cn(
                    "mx-auto flex max-w-5xl flex-col gap-5 p-8",
                    navigated && "animate-fade-in",
                  )}
                >
                  <header>
                    <h1 className="text-2xl font-semibold tracking-tight">{nav.label}</h1>
                    <p className="mt-1 text-sm text-muted">{nav.description}</p>
                  </header>
                  {storageError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning/10 p-3 text-sm"
                    >
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
                      <span>
                        Não foi possível abrir o banco de dados local, então só a aparência funciona
                        nesta sessão. Detalhe: {storageError}
                      </span>
                    </div>
                  )}
                  {db || route.page === "aparencia" ? <PageContent route={route} /> : null}
                </div>
              </main>
            </div>
          </WindowFrame>
        </RouterProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
