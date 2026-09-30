# Motor de insights — como funciona

Entrega de 02/10/2026. O motor conecta vendas, produtos, variantes, estoque, metas e ações para responder: o que aconteceu, onde, quais produtos e variantes explicam, quais causas os dados sustentam, o que ainda é hipótese, qual ação avaliar e como acompanhar.

## Diagnóstico do que existia

- **Dados**: totalizações da Presence por unidade × período × referência/cor/tamanho (`total_batches` mantém uma versão ativa por escopo; reimportar substitui), Saldo Estoque por unidade × data (`stock_batches`), vendas transacionais, metas, compras e cadastro opcionais (não usados em produção). Não havia tipo de produto, grade esperada, reservas, trânsito, navegação do e-commerce nem plano de coleção.
- **Identidade**: o modelo era a referência completa; cor e tamanho canônicos em `lib/catalog.ts`. Categoria do estoque só vinha de correspondência inequívoca com as totalizações.
- **Regras**: `lib/findings.ts` gerava faltas, transferências, estoque parado, saldo negativo e qualidade dos dados. Com só totalizações, não havia desempenho comparado, mix, rankings nem grade.
- **IA**: contexto JSON com números calculados e prompts por finalidade. Não havia verificação dos números devolvidos pelo modelo.
- **Ações**: cards com aprovar, concluir e descartar, responsável, prazo e nota. Não havia linha de base nem acompanhamento.
- **Permissões**: todo usuário logado via todas as unidades; só a configuração de IA era restrita ao administrador.

## Camadas

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| A. Dados confiáveis | `lib/identity.ts`, `lib/readiness.ts` | Referência canônica (só espaços e caixa), tabelas explícitas de correspondência e tipo, chave de variante comum a vendas e estoque, período, comparação equivalente, datas de estoque, fontes, sobreposição, conciliação, estoque ausente × zero, capacidades |
| B. Métricas | `lib/metrics.ts` | Definição única de cada indicador (nome, definição, fórmula, granularidade, dados, limitações, denominador zero, ausência) e funções que devolvem `null` em vez de número artificial |
| C. Diagnósticos | `lib/insights.ts` (+ `lib/findings.ts`) | Frentes de desempenho, mix, rankings, grade, diferenças entre unidades, e-commerce, compras e identidade; prioridade, deduplicação e fingerprint |
| D. Interpretação | `lib/analyst.ts`, `lib/ai-context.ts`, `lib/ai-core.ts` | Pergunta → intenção, período e escopo → permissões → insights → resposta com fato, hipótese, recomendação e limitação; a IA só redige, e os números dela são conferidos |
| E. Acompanhamento | `app/findings-board.tsx`, `/api/actions` | Status, responsável, prazo, nota, linha de base na aprovação, data de execução, evolução observada e reabertura quando os números mudam |

## Contrato do insight

Cada insight estende o card existente com: `front`, `scope` (período, comparação, unidades, categoria, referência), `fact`, `metrics`, `evidence`, `hypotheses` (texto, apoio nos dados, o que validar), `suggestion`/`action`, `limitations`, `missing`, `quality` (suficiente / parcial / insuficiente, com motivos), `priority` + `priorityReasons`, `impact: null` (não há método válido para estimar), `follow` (métrica de acompanhamento), `groupKey`, `fingerprint` e `related`.

**Não há nota numérica de confiança.** A qualidade usa critérios explícitos: estoque com mais de `staleDays` dias, saldo não informado, período sem comparação ou indício sem grade esperada.

## Regras importantes

- **Comparação** só entre períodos equivalentes: mesma duração, dois meses completos, ou mês parcial contra mês completo pela média diária (declarado no texto). Entram só as unidades com arquivo nos dois períodos e abertas desde o início do mais antigo.
- **Sem dupla contagem**: cada escopo tem uma versão ativa, e períodos sobrepostos nunca são somados (a análise lê um período por vez e sinaliza a sobreposição). Uma falta coberta por transferência não gera também um card de realocação.
- **Estoque ausente ≠ zero**: referência sem linha no arquivo da unidade aparece como "não consta", com limitação. A linha com saldo 0 é zero informado.
- **Percentual com base pequena** (abaixo de `minBaseAmount`/`minBaseQty`) não é mostrado; a variação absoluta, sim.
- **STR** = vendidas ÷ (vendidas + estoque final), identificado como referência gerencial. Não havia definição anterior no sistema. É distorcido por recebimentos e transferências no período.
- **Grade**: sem grade esperada cadastrada, faltas de tamanho são **indício**, nunca "grade quebrada".
- **Transferências** são oportunidades para avaliar. A quantidade é limite superior pela regra, e o card lista os dados que faltam (reservas, trânsito, entradas previstas, rotas). Nada é executado.
- **Ações em andamento** (aprovadas) caem para prioridade baixa. Uma decisão concluída ou descartada reabre quando o fingerprint muda.
- **Antes e depois** aparece como "evolução observada, não prova de efeito da ação".

## Onde aparece

- **Visão geral**: "Diagnóstico do período" (cards de desempenho, mix, ranking, grade, e-commerce, compras), "Pergunte sobre vendas e estoque" e "Base da análise".
- **Plano de ação, Abastecimento e Qualidade**: os mesmos insights, com Fato / Hipóteses / Recomendação / Limitações em "Ver detalhes" e acompanhamento após a aprovação.
- **Relatório consolidado**: pontos de atenção com fato e hipótese, seção "Limites dos dados" e registro dos achados (`insightSnapshot`), usado por "O que mudou desde o último relatório?".
- **IA** (análise, relatório, apresentação, abastecimento, plano): o contexto recebe `diagnosticoDados`, os insights estruturados e as definições das métricas usadas. Números do texto que não estão no contexto são sinalizados, e leituras feitas antes de uma nova importação aparecem como desatualizadas (`dataVersion`).
- **API** `/api/insights`: `GET` devolve os insights e o diagnóstico; `POST {action:'ask', question, channel, withAI}` responde à pergunta. É o ponto de reuso para dashboards, relatórios e canais futuros (sem integração de WhatsApp nesta entrega).

## O que funciona com os dados atuais (setembro/2026: JK, BC, Ecomm; RJ sem arquivos)

- Resultado por unidade e participação, concentração (29 modelos fazem metade das vendas), ranking em valor e em peças, perfil de mix por unidade × rede.
- Estoque × vendas por unidade, modelo, cor e tamanho: faltas, transferências, reposição, STR alto e baixo, tamanhos que vendem sem saldo (indício), saldo concentrado em um tamanho, variações sem venda, e-commerce sem saldo nos mais vendidos.
- Qualidade: RJ sem arquivo (não é venda zero), período em andamento, saldos negativos e fracionados, referências sem categoria, referências quase iguais.
- Perguntas: as oito do briefing respondem. As que dependem de dados ausentes dizem o que falta (ex.: "apostas da coleção", "queda da JK" sem período anterior).

## O que depende de novas fontes

| Análise | Falta |
|---|---|
| Variação, contribuição, mudança de participação, altas, quedas, entradas e saídas do ranking, modelos novos × recorrentes | Totalização do período anterior equivalente (ex.: agosto/2026) |
| Comparação anual | Mesmo período do ano anterior |
| Realizado × meta | Metas mensais (importação "Metas" ou meta da unidade) |
| Nível "Tipo" na hierarquia | Tabela `reference_types` (referência → tipo) |
| Cobertura, consumo diário, projeção | Vendas por pedido |
| Grade quebrada (afirmação) | Grade esperada por modelo |
| Transferência otimizada | Reservas, trânsito, entradas previstas, rotas |
| Conversão, exposição e fotos do e-commerce | Dados de navegação e catálogo do site |
| Mix planejado × realizado, OTB, recebimentos | Plano de coleção e pedidos de compra |
| Apostas | Cadastro de apostas por referência |

Para planejamento de coleção, compras e apostas, o sistema **detecta a ausência** e informa o que falta. Não há módulo simulado com dados fictícios.

## Configuração

Não há migração de banco. Configurações opcionais:

- `STORE_ACCESS` (variável na Vercel): `email=02,03;email2=BC`. Esses usuários só recebem dados, ações, relatórios de unidade e respostas das próprias unidades. Os totais da "rede" passam a ser só as unidades permitidas. Quem não está na lista, e o administrador, continuam vendo tudo.
- Em `settings` (via `POST /api/settings`, por quem acessa todas as unidades):
  - `insights`: parâmetros `minBaseQty`, `minBaseAmount`, `dropPct`, `materialShare`, `ppThreshold`, `topN`, `strHigh`, `strLow`, `minStock`, `staleDays`, `maxPerFront`.
  - `reference_aliases`: referência de origem → referência canônica. É a única forma de unir referências diferentes.
  - `reference_types`: referência → tipo.

## Testes

- `tests/insights.test.mjs` (em `pnpm test`), com dados sintéticos, cobre:
  - métricas com denominador zero e base pequena;
  - variantes entre fontes (`01 - 38`/`3    - CHUMBO` × `38`/`3 -CHUMBO`) e homônimos;
  - sobreposição sem dupla contagem;
  - período parcial por média diária e períodos incompatíveis;
  - devoluções e ajustes, conciliação, estoque ausente × zero, estoque antigo;
  - produto novo;
  - hipótese nunca vira fato;
  - invalidação por nova posição, ação em andamento;
  - intenções do analista, falha do provedor de IA com resposta mantida e números fora do contexto sinalizados;
  - isolamento por unidade.
- `pnpm test:fixtures` segue passando com as planilhas reais.

## Limitações restantes

- Os insights são recalculados no navegador e no servidor a cada leitura (sem cache). A invalidação é natural; o custo é de cerca de 0,4 s com a base atual.
- A verificação de números é heurística. Ela sinaliza, não bloqueia; valores derivados pela IA (somas, diferenças) aparecem como "não localizados".
- `STORE_ACCESS` não filtra o histórico de importações para usuários restritos (a lista é ocultada por inteiro) nem a apresentação executiva (só aparece para quem vê tudo).
- A identificação de intenção por palavras-chave cobre as perguntas do briefing e variações próximas; perguntas fora desse padrão caem em "prioridades".
