# Changelog

## v0.1.0 — primeira versão

- Janela própria com cantos arredondados (Windows 10 e 11), tema claro e escuro, cores
  personalizáveis com checagem de contraste.
- Perfis de cálculo: custo de material, energia, máquina, mão de obra, extras e falha; regras de
  preço; calculadora de depreciação.
- Orçamento com várias peças: entrada por 3MF fatiado do Bambu Studio (experimental), STL ou
  digitação; comparador de 7 métodos; faixas mínimo, recomendado e premium; preço mínimo e
  arredondamento.
- PDF local com logo, cores, número e versão; mensagem pronta para o WhatsApp.
- Histórico com status, busca, duplicar e nova versão; clientes com exclusão de dados pessoais.
- Funções 1 (fechamento estimado × real), 2 (calibração), 4 (peças recorrentes com custo
  atualizado) e 6 (preço por quantidade a partir da mesa cheia).
- Backup (exportar e importar, numa transação), apagar todos os dados e minuta de aviso de
  privacidade.

Limitações conhecidas:

- A importação do 3MF segue a estrutura do Bambu Studio documentada por leitores de código
  aberto, mas ainda não foi validada com arquivos de usuários: confira os valores lidos.
- G-code puro não é lido nesta versão.
- O instalador não tem assinatura de código (aviso do SmartScreen).
