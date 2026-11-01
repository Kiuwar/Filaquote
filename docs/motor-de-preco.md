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

## Função 1: fechamento do pedido, estimado × real (`closure.ts`)

**Problema:** o lucro é medido "no feeling". Reimpressão, pós-processamento mais longo e
embalagem comem a margem sem aparecer.

**Entrada** (`closeItem`): o valor cobrado, as taxas pagas, a entrada usada no orçamento e o
que aconteceu de fato. Tudo opcional, exceto o que mudou:

| Campo real                                | Se não informado                     |
| ----------------------------------------- | ------------------------------------ |
| Tempo de impressão (h)                    | tempo do fatiador × fator de tempo   |
| Peso consumido, pesado (g)                | (gramas + purga) × (1 + desperdício) |
| Preparo e pós-processamento (min)         | orçado (pós × fator de pós)          |
| Extras                                    | os do orçamento                      |
| Reimpressões (g e h perdidos em cada uma) | nenhuma                              |

**Conta:** os mesmos preços do perfil, com as quantidades reais.

- O peso pesado já inclui purga e desperdício, então não leva o percentual de desperdício.
- A falha real é o custo de produção das tentativas perdidas, e não o percentual de reserva do
  perfil: no fechamento, ou falhou ou não falhou.
- Lucro = valor cobrado − taxas − custo. Margem real = lucro ÷ valor cobrado.
- O resultado lista o desvio de cada parcela (real − orçado), da que mais pesou para a que
  menos pesou, e as horas de máquina usadas, contando as reimpressões.

**Resumo do mês** (`summarizeByMonth`): por data de fechamento (AAAA-MM-DD), soma o valor cobrado,
o lucro orçado e o real, o desvio, o custo de reimpressões e as horas de máquina.

Esses fechamentos também alimentam a calibração (função 2).

## Função 2: calibração pelo histórico (`calibration.ts`)

**Problema:** o tempo do fatiador, o desperdício, a taxa de falha e o tempo de pós-processamento
são chutes que se repetem em todos os orçamentos.

**Entrada:** os pedidos fechados (função 1), convertidos com `sampleFromClosure`. Impressões
atípicas (pausa, troca de bico, teste) podem ser marcadas como excluídas.

**Sugestões** (`suggestCalibration`):

| Campo do perfil            | Conta                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fator de tempo             | mediana de (tempo real ÷ tempo do fatiador)                                                                                  |
| Fator de pós-processamento | mediana de (minutos reais ÷ estimados)                                                                                       |
| Desperdício (%)            | mediana de (peso pesado ÷ peso do fatiador − 1); se der negativo, 0% com aviso de que o fatiador superestima                 |
| Taxa de falha (%)          | soma do custo de produção perdido em reimpressões ÷ soma do custo de produção entregue, contando também os pedidos sem falha |

- **Mediana**, não média: uma impressão fora da curva não puxa a sugestão.
- Só sugere com **pelo menos 5 amostras**; antes disso, mostra quantas faltam.
- Marca como "vale aplicar" só mudanças de pelo menos 2% nos fatores ou 1 ponto percentual nos
  percentuais (configurável).
- **Nunca aplica sozinho.** `applyCalibration` aplica só os campos que o usuário aceitou e devolve
  um perfil novo.

## Função 4: peças recorrentes com preço sempre atual (`recurring.ts`)

**Problema:** refazer do zero o orçamento da mesma peça, ou aprovar um orçamento antigo depois
que o filamento ou a energia subiram.

**Princípio:** a peça recorrente guarda as **entradas** (gramas, tempo, preparo, pós, extras),
nunca o preço. Orçar de novo é recalcular com o perfil de hoje.

**Comparação** (`compareWithSnapshot`): recebe o que foi gravado no orçamento anterior (perfil da
época, entrada, preço e taxas) e o perfil de hoje. Devolve:

- custo da época × custo de hoje, com a diferença em R$ e em %;
- margem do preço cobrado com cada um: (preço − taxas − custo) ÷ preço;
- **preço que devolve a margem da época**: (custo de hoje + taxas) ÷ (1 − margem da época);
- os campos do perfil que mudaram, com antes, depois e variação (`profileChanges`);
- `stale` (defasado) quando o custo mudou pelo menos 1% (configurável), para cima ou para baixo.

O app nunca troca o preço sozinho: na aprovação, mostra os dois lados e o usuário decide se
mantém o preço combinado.

## Métodos de preço (`pricing.ts`)

Tudo por unidade: custo do item ÷ quantidade. Método sem parâmetro preenchido aparece como
"a confirmar", com a lista do que falta.

| #   | Método                    | Conta                                                    |
| --- | ------------------------- | -------------------------------------------------------- |
| 1   | Custo + markup            | custo × (1 + markup)                                     |
| 2   | Margem sobre o preço      | custo ÷ (1 − margem)                                     |
| 3   | Meta por hora de máquina  | horas × R$/h + extras                                    |
| 4   | Preço por grama           | gramas × R$/g + extras                                   |
| 5   | Preço-alvo (reverso)      | você digita o preço; o app mostra lucro, margem e markup |
| 6   | Marketplace               | (custo + taxa fixa + frete) ÷ (1 − taxa % − margem %)    |
| 7   | Escalonado por quantidade | recomendado × (1 − desconto da faixa atingida)           |

**Faixas:** _mínimo_ = custo ÷ (1 − margem mínima); _recomendado_ = método escolhido no perfil;
_premium_ = recomendado × (1 + acréscimo). Depois de cada conta: sobe para o **preço mínimo**,
se houver, e aplica o **arredondamento** (nunca para baixo): R$ 0,10, R$ 0,50, real inteiro ou
final ,90.

## Leitura de arquivos

**STL** (`stl.ts`): binário e ASCII. Volume = soma dos volumes sinalizados dos tetraedros
(triângulo + origem), exato para malha fechada. Avisa malha aberta (arestas sem par), normais
invertidas e tamanho implausível; como o STL não guarda unidade, sugere cm, polegadas ou metros
quando a peça fica pequena ou grande demais. Estimativa: gramas = volume (cm³) × densidade ×
[maciço + (1 − maciço) × preenchimento]; horas = gramas ÷ vazão (g/h). Densidade, fração
maciça e vazão vêm do perfil.

**3MF fatiado do Bambu Studio** (`bambu3mf.ts`, **experimental**): lê
`Metadata/slice_info.config` dentro do arquivo `.gcode.3mf` (tempo previsto e peso de cada mesa,
e gramas por filamento). A estrutura foi conferida em dois leitores de código aberto
independentes, mas ainda não em arquivos do usuário: o app mostra os valores lidos para conferir
antes de usar. G-code puro não é lido nesta versão (o formato dos comentários varia e não foi
validado com arquivos reais).
