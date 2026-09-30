# Auditoria do sistema — 30/09/2026

Base auditada: produção atual (totalizações JK, BC e Ecomm; Saldo Estoque JK, BC e Ecomm; RJ sem arquivos; sem vendas por pedido). Reproduzida localmente com as mesmas planilhas (`scripts/dev-seed.mjs`) e inspecionada em desktop (1440 px) e celular (390 px).

## Lógica quebrada (corrigido)

| # | Onde | Problema | Correção |
|---|---|---|---|
| 1 | Plano de ação | Só listava decisões baseadas em vendas diárias; com totalizações + estoque ficava vazio | Motor de achados (`lib/findings.ts`) com cards: falta com saldo em outra unidade, falta sem saldo na rede, estoque parado que vende em outra unidade, estoque parado, saldo negativo, qualidade dos dados |
| 2 | Sugestão de transferência | Poderia esvaziar a origem | A origem preserva o que ela mesma vendeu no período (ou metade do saldo, se não vendeu) |
| 3 | Qualidade dos dados | "5.272 SKUs sem cadastro" e lista de códigos internos | Estoque Presence traz modelo/cor/tamanho: não conta como falta de cadastro |
| 4 | Qualidade dos dados | RJ aparecia como "estoque desatualizado" | Novo status "Sem estoque importado"; "Sem vendas diárias" quando só há totalizações |
| 5 | Estoque | "Variantes em risco" contava todo saldo zerado, sem histórico de venda | Cartões: saldo, sem saldo, saldo negativo, posições antigas |
| 6 | Estoque | Posição com mais de 1 dia marcada como desatualizada (importação é semanal) | Limite de 7 dias (`STALE_DAYS`); recomendações seguem com a regra própria |
| 7 | Relatórios automáticos | Um novo "Consolidado · Automático" por arquivo importado (3 duplicados, até 160 KB cada, com todas as variações) | Um por período, atualizado a cada importação de vendas ou estoque; duplicados antigos ficam ocultos na lista |
| 8 | Central de relatórios | "Gerar relatório" desativado sem vendas diárias | Gera o consolidado do período mais recente |
| 9 | Visão geral | Clicar redirecionava para Vendas consolidadas | Visão geral consolidada: números, pontos de atenção, unidades e categorias |
| 10 | `proxy.ts` | Interceptava rotas internas `/_next/*` | Excluídas do proxy |

## Usabilidade e interface (corrigido)

- Barra "Hoje / 7 dias / Este mês" e datas escondidas quando não há vendas diárias (não tinham efeito).
- Estoque: colunas "Vendas/janela" e "Cobertura" escondidas sem vendas diárias; "Ocultar saldos zerados" ligado por padrão (5.272 → linhas com saldo).
- Abastecimento: sem vendas diárias mostra faltas, transferências e estoque parado em vez de zeros e "importe dados".
- Vendas consolidadas: lista de negativos e ajustes recolhida.
- Seletor "Fonte dos dados" com uma única opção virou rótulo.
- IA: linguagem simples, sem nomes de campos ou "(fonte: …)"; plano de ação e abastecimento em cards (achado → sugestão, responsável, prazo, como validar); demais textos com títulos e listas formatados.

## Relatórios mais fáceis de ler

Consolidado v2 (`lib/consolidated-report.ts` + `app/report-view.tsx`): 3 números principais; "Em resumo" em frases curtas; tabela por unidade com participação e barras; categorias que mais vendem; 10 modelos em destaque; estoque por unidade (zeradas/negativas); até 6 pontos de atenção com sugestão; leitura da IA; "Como ler este relatório". Relatórios antigos continuam abrindo.

## Pendências e recomendações

- Importar totalização e Saldo Estoque do RJ.
- Os 3 relatórios automáticos duplicados antigos seguem no banco (ocultos); podem ser apagados.
- Vendas por pedido (transacionais) liberariam consumo diário, cobertura e projeção de abastecimento.
- Lint da base original ainda tem erros antigos (`any`, efeitos com setState) fora dos arquivos novos.
- Ambiente local de auditoria: `node scripts/dev-seed.mjs` (Postgres em memória com as planilhas de `fixtures/`) + `next dev` com `DEV_AUTH_EMAIL` (login liberado apenas em desenvolvimento).
