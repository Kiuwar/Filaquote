# Filaquote

App de desktop para quem vive de impressão 3D orçar peças com o custo de verdade e mandar o
orçamento em PDF ou pelo WhatsApp. Windows primeiro; Mac depois. Em português do Brasil.

Tudo fica no seu computador: sem conta, sem servidor, sem telemetria.

## Baixar e instalar

Baixe o instalador `Filaquote_*_x64-setup.exe` na página de
[Releases](https://github.com/Kiuwar/Filaquote/releases) e execute.

O instalador não tem assinatura de código. O Windows pode mostrar o aviso do SmartScreen
("O Windows protegeu o computador"): clique em **Mais informações → Executar assim mesmo**.

## O que ele faz

- **Perfis de cálculo**: quantas "formas de calcular" você quiser, salvas no app. Cada uma
  guarda filamento (com desperdício e purga), energia, depreciação e manutenção da máquina,
  mão de obra, taxa de falha e as regras de preço. Nada vem preenchido: o que falta aparece
  como "a confirmar".
- **Orçamento com várias peças**, quantidade e acabamento. Dados de cada peça por:
  arquivo fatiado do Bambu Studio (`.gcode.3mf`, experimental), STL (volume, com aviso de malha
  aberta e de unidade errada) ou digitação.
- **Comparador de 7 métodos** lado a lado (markup, margem, R$/hora de máquina, R$/grama,
  preço-alvo reverso, marketplace e desconto por quantidade), com a conta explicada e as faixas
  **mínimo, recomendado e premium**, preço mínimo e arredondamento.
- **PDF** gerado no computador, com logo, as cores do app, número e versão. Mostra só o
  preço final ou cada peça; nunca o custo interno nem a margem.
- **Mensagem pronta para o WhatsApp**, a partir de um modelo seu.
- **Histórico** com status (rascunho, enviado, aprovado, recusado, entregue), busca, duplicar
  e nova versão.
- **Clientes** com cadastro mínimo e exclusão dos dados pessoais.
- **Backup** (exportar e importar) e **minuta de aviso de privacidade** para usar com seus
  clientes (revisar com advogado).
- Janela própria com cantos arredondados, **tema claro e escuro** e cores personalizáveis
  com checagem de contraste.

## Funções para quem vive de impressão 3D

- **1. Fechamento do pedido (estimado × real):** ao entregar, registre tempo real, peso pesado,
  reimpressões e pós-processamento. O app mostra o lucro real ao lado do orçado e o resultado
  do mês.

- **2. Calibração pelo histórico:** com os pedidos fechados, o perfil sugere ajustes no fator de
  tempo, no pós-processamento, no desperdício e na taxa de falha (mediana, a partir de 5
  pedidos). Nada muda sem você aceitar.

- **4. Peças recorrentes com preço sempre atual:** a peça guarda a entrada, não o preço. Ao orçar
  de novo, ou ao aprovar um orçamento antigo, o app mostra se o custo subiu e o preço que
  mantém a margem.

- **6. Preço por quantidade a partir da mesa cheia:** com a mesma peça fatiada com 1 e com N
  cópias, o app separa o gasto por mesa do gasto por cópia e monta as faixas de quantidade com
  o desconto máximo até a margem mínima.

Fórmulas em [docs/motor-de-preco.md](docs/motor-de-preco.md).

## Seus dados

Ficam no banco local do Filaquote, na pasta da sua conta do Windows. Arquivos só saem quando
você exporta um PDF, uma mensagem ou um backup. Em **Dados e privacidade**: backup, importação,
exclusão e a minuta do aviso de privacidade.

## Desenvolvimento

Pré-requisitos: Node 22+, pnpm 10 e os [pré-requisitos do Tauri 2](https://v2.tauri.app/start/prerequisites/)
(no Windows: Microsoft C++ Build Tools, WebView2 e Rust).

```bash
pnpm install
pnpm dev          # só a interface, no navegador, com banco em memória (http://localhost:1420)
pnpm tauri dev    # app de desktop completo
pnpm tauri build  # instalador (Windows: NSIS em apps/desktop/src-tauri/target/release/bundle/nsis)
```

Verificações (as mesmas do CI):

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
cd apps/desktop/src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

Publicar uma versão: atualize a versão em `apps/desktop/package.json`,
`apps/desktop/src-tauri/tauri.conf.json` e `apps/desktop/src-tauri/Cargo.toml`, registre no
`CHANGELOG.md` e envie uma tag `vX.Y.Z`. O workflow `release.yml` publica o instalador.

## Estrutura

```
apps/desktop/          interface React + Tailwind e o app Tauri (src-tauri/)
packages/engine/       motor de custo e preço, leitores de STL e 3MF (TypeScript puro, testado)
docs/                  arquitetura, fórmulas e minuta de aviso de privacidade
```

Detalhes em [docs/arquitetura.md](docs/arquitetura.md).
