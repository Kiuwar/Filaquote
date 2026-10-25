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
