# Filaquote

App de desktop para makers de impressão 3D orçarem peças e exportarem o orçamento em PDF.
Windows primeiro; Mac depois. Tudo fica no computador: sem conta, sem servidor, sem telemetria.

> Status: **fase 3** pronta (motor de preço, leitura de STL e 3MF, perfis de cálculo).
> Veja o [plano por fases](docs/arquitetura.md#fases).

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
packages/engine/       motor de custo e preço (TypeScript puro, testado)
docs/                  arquitetura, decisões e documentos de apoio
```

Detalhes em [docs/arquitetura.md](docs/arquitetura.md). Fórmulas do motor em
[docs/motor-de-preco.md](docs/motor-de-preco.md).

## Funções para quem vive de impressão 3D

Escolhidas na etapa de propostas. Cada uma entra em um PR próprio: primeiro o cálculo, testado no
motor; depois a migration e a tela, quando existir a base de orçamentos que ela usa.

- **1. Fechamento do pedido (estimado × real):** cálculo pronto no motor
  ([como funciona](docs/motor-de-preco.md#função-1-fechamento-do-pedido-estimado--real-closurets)).
  A seguir: migration e tela de fechamento junto do histórico de orçamentos (fase 5).

- **2. Calibração pelo histórico:** cálculo pronto no motor
  ([como funciona](docs/motor-de-preco.md#função-2-calibração-pelo-histórico-calibrationts)).
  A seguir: tela de sugestões no perfil de cálculo, depois do fechamento (fase 5).

- **4. Peças recorrentes com preço sempre atual:** cálculo pronto no motor
  ([como funciona](docs/motor-de-preco.md#função-4-peças-recorrentes-com-preço-sempre-atual-recurringts)).
  A seguir: migration da tabela de peças e aviso na aprovação, junto da tela de orçamento (fase 4).

- **6. Preço por quantidade a partir da mesa cheia:** cálculo pronto no motor
  ([como funciona](docs/motor-de-preco.md#função-6-preço-por-quantidade-a-partir-da-mesa-cheia-platets)).
  A seguir: importar as duas mesas do 3MF do Bambu Studio e mostrar as faixas na tela de orçamento.

## Instalador sem assinatura

O instalador não tem assinatura de código. O Windows pode mostrar o aviso do SmartScreen
("O Windows protegeu o computador"); para instalar, clique em **Mais informações → Executar assim mesmo**.
