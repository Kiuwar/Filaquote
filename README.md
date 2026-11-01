# Filaquote

App de desktop para makers de impressão 3D orçarem peças e exportarem o orçamento em PDF.
Windows primeiro; Mac depois. Tudo fica no computador: sem conta, sem servidor, sem telemetria.

> Status: **fase 2** (base do app, tema e componentes). Veja o [plano por fases](docs/arquitetura.md#fases).

## Desenvolvimento

Pré-requisitos: Node 22+, pnpm 10 e os [pré-requisitos do Tauri 2](https://v2.tauri.app/start/prerequisites/)
(no Windows: Microsoft C++ Build Tools, WebView2 e Rust).

```bash
pnpm install
pnpm dev          # só a interface, no navegador (http://localhost:1420)
pnpm tauri dev    # app de desktop completo
pnpm tauri build  # instalador (Windows: NSIS em apps/desktop/src-tauri/target/release/bundle/nsis)
```

Verificações (as mesmas do CI):

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

## Estrutura

```
apps/desktop/          interface React + Tailwind e o app Tauri (src-tauri/)
packages/              motor de preço e leitores de arquivo (a partir da fase 3)
docs/                  arquitetura, decisões e documentos de apoio
```

Detalhes em [docs/arquitetura.md](docs/arquitetura.md).

## Instalador sem assinatura

O instalador não tem assinatura de código. O Windows pode mostrar o aviso do SmartScreen
("O Windows protegeu o computador"); para instalar, clique em **Mais informações → Executar assim mesmo**.
