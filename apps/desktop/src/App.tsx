import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { AppearancePage } from "./features/appearance/AppearancePage";
import { ComingSoon } from "./features/placeholder/ComingSoon";
import { findNavItem, type PageId } from "./shell/navigation";
import { Sidebar } from "./shell/Sidebar";
import { TitleBar } from "./shell/TitleBar";
import { WindowFrame } from "./shell/WindowFrame";
import { cn } from "./ui/cn";

function PageContent({ page }: { page: PageId }) {
  switch (page) {
    case "aparencia":
      return <AppearancePage />;
    case "novo":
      return (
        <ComingSoon
          phase={4}
          items={[
            "Várias peças por orçamento, com quantidade e acabamento",
            "Entrada por STL, G-code/3MF do Bambu Studio ou digitação manual",
            "Comparador lado a lado dos 7 métodos de preço",
          ]}
        />
      );
    case "orcamentos":
      return (
        <ComingSoon
          phase={5}
          items={[
            "Histórico com status (rascunho, enviado, aprovado, recusado)",
            "Busca e duplicar",
            "PDF e mensagem pronta para WhatsApp",
          ]}
        />
      );
    case "clientes":
      return (
        <ComingSoon
          phase={5}
          items={["Cadastro local de clientes", "Excluir os dados de um cliente"]}
        />
      );
    case "perfis":
      return (
        <ComingSoon
          phase={3}
          items={[
            "Criar, nomear e salvar várias formas de calcular",
            "Impressora, material, energia, mão de obra, extras e taxa de falha",
            "Ficam salvas no computador e voltam ao abrir o app",
          ]}
        />
      );
    case "dados":
      return (
        <ComingSoon
          phase={6}
          items={[
            "Exportar e importar backup",
            "Minuta de aviso de privacidade (revisar com advogado)",
          ]}
        />
      );
  }
}

export function App({ storageError }: { storageError?: string }) {
  const [page, setPage] = useState<PageId>("aparencia");
  // Anima só a troca de página; o primeiro desenho acontece com a janela ainda oculta.
  const [navigated, setNavigated] = useState(false);
  const nav = findNavItem(page);
  const goTo = (id: PageId) => {
    setNavigated(true);
    setPage(id);
  };

  return (
    <WindowFrame>
      <TitleBar subtitle={nav.label} />
      <div className="flex min-h-0 flex-1">
        <Sidebar current={page} onSelect={goTo} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div
            key={page}
            className={cn(
              "mx-auto flex max-w-4xl flex-col gap-5 p-8",
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
                  Não foi possível abrir o banco de dados local. As preferências desta sessão não
                  serão salvas. Detalhe: {storageError}
                </span>
              </div>
            )}
            <PageContent page={page} />
          </div>
        </main>
      </div>
    </WindowFrame>
  );
}
