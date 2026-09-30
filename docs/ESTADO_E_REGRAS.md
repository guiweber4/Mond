# Estado da transferência

## Referência da versão

- Exportação: 30/09/2026.
- Fonte funcional: commit `b8a5cbe3ddc8fbca43b00b1033d2e8ac8dba02ca`.
- Site anterior: https://mondepars-retail-intelligence.guiweber.chatgpt.site
- Uso pretendido: iniciar um novo projeto, preservando o sistema anterior.
- Modificação de configuração na cópia: removido somente o vínculo `project_id` de `.openai/hosting.json`.
- Arquivo derivado removido: `tsconfig.tsbuildinfo`, cache que será regenerado pelo TypeScript.

## Implementado e publicado nesta conversa

### Totalizações

Leitura das colunas REFERENCIA, NM_GRUPO, DESCRICAO, TAMANHO, COR, QT e VALOR; compatibilidade com o formato sem variantes e com VLR_MEDIO opcional. Chave inclui referência, tamanho e cor. TOTAL é conferido, não somado como produto. Negativos e ajustes preservados. Nova importação de unidade/período substitui a versão ativa. Há consulta por modelo/variação, filtros simples de cor/tamanho, exportação e relatórios.

### Estoque

Leitura de Referência, Descrição Item, Descrição, Descrição_1 e Saldo Base. Unidade sugerida pelo nome do arquivo, data confirmada pelo usuário. Identidade sintética por referência, tamanho e cor. Linhas repetidas são somadas, preservando `sourceBalances`. Saldos negativos e fracionados preservados. TOTAL conciliado. Snapshots ativos em `stock_batches`; mesma unidade/data substitui o conjunto completo. Cadastro ausente não impede mostrar nome, cor e tamanho trazidos no estoque.

### Fluxo de importação

Envio JSON com arquivo codificado e linhas normalizadas; limites e validação no servidor. D1 usa inserção por lotes JSON e ativação atômica do conjunto. Timeout explícito no cliente e na atualização de dados. Resposta inválida não é tratada como sucesso. Reenvio idêntico considera a versão ativa dos snapshots.

## Ainda pendente / pontos para a nova sessão

- Concluir e integrar a revisão ampla de UX/UI, especialmente dropdown categoria → modelo e grade de cor/tamanho.
- Integrar o catálogo visual à fonte correta: a página atual de produtos usa vendas transacionais; uma base com somente totalizações precisa de um caminho explícito para o novo explorador.
- Revisar correspondência entre códigos sintéticos do estoque, referência das totalizações e SKUs oficiais. As identidades da base não garantem esse vínculo automaticamente.
- Categoria de estoque não vem nas fixtures. Usar somente correspondência inequívoca de referência com cadastro/totalizações, ou sinalizar ausência/conflito.
- Não assumir reservas, trânsito, unidade de medida, datas diárias, custos ou pedidos a partir desses arquivos.
- Relatórios automáticos ainda são calculados no fluxo servidor de importação. Avaliar separar essa etapa para que uma geração demorada não atrase a confirmação de dados persistidos.
- O período de totalização da base ainda começa com setembro de 2026. Substituir por seleção coerente e confirmada no novo sistema.
- Reavaliar indicadores de “sem venda observada” quando só existe totalização e o SKU não tem histórico transacional correspondente.
- API Presence, coleta autônoma e envio agendado de relatórios não estão conectados. Atualização horária enquanto a página está aberta consulta a base já importada.
- Chamadas reais de provedores de IA dependem de credenciais/configuração. Testes de adaptadores usam respostas simuladas.

## Mapa do código

| Caminho | Responsabilidade |
|---|---|
| `app/page.tsx` | Shell, navegação, painéis de vendas/estoque e ações de tela |
| `app/globals.css` | Estilos e responsividade |
| `app/importer.tsx` | Leitura de Excel, formato, mapeamento, validação e confirmação |
| `app/totals-panel.tsx` | Vendas consolidadas e exportação |
| `app/operations-panel.tsx` | Qualidade, planejamento e decisões |
| `app/ai-panel.tsx` | Configuração e análise de IA |
| `app/api/import/route.ts` | Validação e persistência de importações |
| `app/api/data/route.ts` | Leitura da base ativa e histórico |
| `app/api/reports/route.ts` | Relatórios salvos |
| `app/api/actions/route.ts` | Registro de decisões |
| `app/api/settings/route.ts` | Unidades e parâmetros |
| `app/api/ai/route.ts` | Operações administrativas e análise de IA |
| `lib/imports.ts` | Mapeamento e normalização dos tipos de planilha |
| `lib/presence-stock.ts` | Parser e validação específicos do Saldo Estoque |
| `lib/totals.ts` | Identidade, consolidação e relatórios de totalização |
| `lib/model.ts` | Tipos, cálculos de vendas e inventário |
| `lib/operations.ts` | Qualidade, projeções e abastecimento |
| `lib/db.ts` | Acesso a D1/R2 e consultas de versões ativas |
| `lib/request.ts` | Requisições com tratamento de timeout |
| `lib/ai-core.ts` e `lib/ai-server.ts` | Provedores, criptografia e controle de chamadas |
| `db/schema.ts` e `drizzle/` | Schema e migrações |
| `tests/` | Regressões e testes com fixtures |

## Migrações

`0000` cria a estrutura básica. `0001` acrescenta recursos de IA. `0002` acrescenta totalizações. `0003_real_world_reset.sql` registra uma limpeza histórica explicitamente solicitada naquela instalação. `0004` acrescenta snapshots de estoque. Inspecione cada arquivo antes de aplicar; não executar reset como operação recorrente.

## Referências reais para conferência

Totalizações: BC 212 variações / QT 497 / R$ 472.946,10; ECOMM 270 / 648 / R$ 504.001,68; JK 540 / 1.536 / R$ 1.291.617,77. Total: 1.022 / 2.681 / R$ 2.268.565,55.

Estoque: JK 2.365 linhas → 2.362 variações / saldo 2.202; BC 804 → 804 / 2.044; ECOMM 2.111 → 2.106 / 1.723,2; RJ 1.771 → 1.767 / 2.476. Total: 7.051 linhas → 7.039 variações por unidade / saldo 8.445,2.

São números das fixtures, não uma afirmação sobre a base de produção. O pacote não lê nem exporta essa base.
