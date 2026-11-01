# Motor de preço

Pacote `packages/engine`: TypeScript puro, sem interface, sem dependências e testado com Vitest.
A interface só chama estas funções e exibe o resultado.

## Regras

- **Nenhum valor padrão.** Preço do filamento, tarifa, depreciação, hora de trabalho e taxa de
  falha vêm sempre do _perfil de cálculo_ preenchido pelo usuário. O motor não sugere números.
- Os cálculos não arredondam. `roundMoney` arredonda para centavos só na hora de exibir.
- Entradas inválidas (negativas, não numéricas, percentual ≥ 100%) geram `EngineInputError`,
  que lista todos os campos com problema em português.

## Custo base (`costBreakdown`)

| Parcela     | Fórmula                                                     |
| ----------- | ----------------------------------------------------------- |
| Material    | (gramas + purga) × (1 + desperdício %) × R$/kg ÷ 1000       |
| Energia     | potência (W) ÷ 1000 × horas × tarifa (R$/kWh)               |
| Máquina     | horas × (depreciação/h + manutenção/h)                      |
| Mão de obra | (preparo + pós-processamento × fator) ÷ 60 × valor da hora  |
| Falha       | (material + energia + máquina) × taxa de falha %            |
| Extras      | soma de embalagem, frete, insumos etc.                      |
| **Total**   | material + energia + máquina + falha + mão de obra + extras |

- **horas** = tempo do fatiador × fator de tempo (calibração; 1 = sem ajuste).
- **Taxa de falha** é um percentual sobre o custo de produção, porque uma falha desperdiça
  material, energia e máquina, mas não embalagem, frete ou pós-processamento.
- **Depreciação/h** pode ser calculada com `depreciationPerHour(preço, valor residual, vida útil em h)`.

## Margem × markup

Para um custo de R$ 60 e um preço de R$ 100:

- **Markup** é o percentual somado ao custo: (100 − 60) ÷ 60 = **66,7%**.
- **Margem** é o percentual do preço que é lucro: (100 − 60) ÷ 100 = **40%**.

Com markup de 40%, o preço seria R$ 84 e a margem, só 28,6%. Para ter margem de 40%, o preço é
custo ÷ (1 − 0,40) = R$ 100 (`priceForMargin`).

## Função 6: preço por quantidade a partir da mesa cheia (`plate.ts`)

**Problema:** desconto por quantidade costuma ser chutado. Numa mesa cheia, parte do gasto é por
mesa (aquecimento, calibração, linha de purga e, em multicolor, purgas de troca de cor, que
acontecem por camada e não por peça) e parte é por cópia.

**Entrada:** a mesma peça fatiada duas vezes com números diferentes de cópias (por exemplo, 1 e 8),
com tempo, filamento e purga de cada mesa. Hoje esses dados são digitados; a importação do 3MF do
Bambu Studio vem com a leitura de arquivos da fase 3.

**Conta** (`fitPlateModel`), para tempo, filamento e purga:

- por cópia = (valor da mesa maior − valor da mesa menor) ÷ (diferença de cópias)
- por mesa = valor da mesa menor − cópias × por cópia
- para Q unidades com até N por mesa: mesas = ⌈Q ÷ N⌉ e total = mesas × por mesa + Q × por cópia

Se os dados fogem do modelo, o motor usa a hipótese que não subestima o custo e avisa:
fixo negativo vira "sem desconto por mesa" e unitário negativo vira "tudo por mesa".

**Faixas** (`quantityTiers`): para cada quantidade (padrão 1, N, 2N e 4N), o custo completo do
motor base, com preparo por mesa e pós-processamento e embalagem por cópia. Mostra:

- **custo unitário**;
- **preço sugerido:** mantém a margem do preço de tabela, ou seja, repassa a economia;
- **desconto máximo:** até onde dá para descontar sem ficar abaixo da margem mínima;
- **aviso** quando o preço de tabela já fica abaixo da margem mínima.

O frete entra à parte no orçamento, não nas faixas.
