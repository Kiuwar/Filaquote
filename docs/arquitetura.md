# Arquitetura do Filaquote

## Visão geral

- **Tauri 2** (Rust) cuida da janela, do arquivo SQLite e, nas próximas fases, do acesso a arquivos.
- **React + TypeScript + Tailwind 4** desenham a interface (`apps/desktop/src`).
- **Motor de preço** em pacote TypeScript puro e testado, separado da interface (`packages/engine`, fase 3).
- **Dados locais** em SQLite via `tauri-plugin-sql`, com migrations versionadas em
  `apps/desktop/src-tauri/migrations`. O banco (`filaquote.db`) fica na pasta de configuração
  do app do usuário do sistema operacional; cada conta do Windows tem os próprios dados.
- Nenhum dado sai da máquina sem ação do usuário. Sem telemetria e sem chamadas de rede.

## Janela com cantos arredondados

A documentação do Tauri (`Window::set_shadow`) diz que, numa janela sem moldura no Windows,
`shadow: true` produz "uma borda branca de 1px e, no Windows 11, cantos arredondados".
O Windows 10 não arredonda janelas nativamente. Por isso o app escolhe o modo ao abrir
(`src-tauri/src/window.rs`):

| Sistema                    | Modo     | Como funciona                                                                                                                                                                                                               |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 11 (build ≥ 22000) | `native` | Sem moldura + `shadow(true)`: cantos e sombra do próprio sistema, encaixe nas bordas da tela.                                                                                                                               |
| Windows 10 e outros        | `css`    | Janela transparente; a interface desenha cantos (`--fq-radius-window`), sombra e uma margem transparente de 12 px (`--fq-frame-gap`) que serve de alça de redimensionamento. Maximizada, a margem e o arredondamento somem. |

Limitações conhecidas do modo `css` (Windows 10):

- A sombra fica limitada à margem de 12 px, então é mais curta que a nativa.
- A margem transparente ainda pertence à janela: clicar nela não chega à janela de trás.
- O redimensionamento usa `startResizeDragging` do Tauri, chamado pelas alças da interface.

A janela nasce oculta e só aparece depois que a interface aplica o tema, para evitar o
clarão branco. Se a interface falhar, o Rust mostra a janela após 4 s.

## Tema e design tokens

- Todas as cores são CSS variables `--fq-*`, gravadas em tempo de execução por
  `src/theme/theme.ts`. Trocar tema ou cor muda a tela na hora, sem recarregar.
- O Tailwind lê esses tokens via `@theme inline` (`src/styles/index.css`), o que gera
  utilitários como `bg-surface`, `text-muted`, `bg-primary` e `rounded-card`.
- As cores neutras de cada tema ficam em `src/theme/tokens.ts`, fonte única que o PDF
  (fase 5) também vai usar.
- **Contraste**: a cor do texto sobre a cor principal e sobre a de destaque é escolhida
  automaticamente (branco ou quase preto). A tela de Aparência checa os mínimos do WCAG 2.x
  (4,5:1 para texto e 3:1 para elementos de interface) nos temas claro e escuro, e oferece
  correção automática, que ajusta só a luminosidade da cor.
- As paletas prontas têm teste automático garantindo que passam em todas as checagens.
- Preferências salvas na tabela `settings` (chave `appearance`, valor JSON).

## Segurança

- CSP restrita (`tauri.conf.json`): só recursos do próprio app; fonte Inter embutida, sem CDN.
  A modificação automática de CSP do Tauri está desligada só para `style-src`, porque
  componentes acessíveis (Radix) injetam estilos em tempo de execução.
- Permissões mínimas em `src-tauri/capabilities/default.json`: controles da janela e SQL.

## Fases

1. Plano e perguntas ✔
2. Base do app, tema e componentes ← atual
3. Motor de preço com testes e perfis de cálculo salvos
4. Tela de orçamento e comparador de métodos
5. PDF e histórico
6. Backup, instalador e CI com Releases
