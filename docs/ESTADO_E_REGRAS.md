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

## Continuação — sessão Claude Code (30/09/2026)

Repositório: `guiweber4/Mond` (branch `claude/vibrant-tesla-iab06g`). Planilhas reais ficam fora do git, em `fixtures/` (ignorada).

### Implementado

- **Explorador categoria → modelo → grade → detalhe** (`app/catalog-explorer.tsx`, `lib/catalog.ts`), usado em Vendas consolidadas, Produtos e grade e Estoque. Categorias em cartões clicáveis + dropdown; modelo em dropdown dependente (com filtro quando há mais de 15); grade cor × tamanho com totais; clique na célula filtra o detalhe; filtro por unidade; paginação completa (sem truncar em 100/150).
- **Identidade**: modelo = referência completa (homônimos separados). Tamanho canônico separa código de grade do rótulo (`01 - 32` → `32`, grade 01). Cor canônica (`3    - CHUMBO` e `3   -CHUMBO` → `3 - CHUMBO`), com valor bruto visível no detalhe. Ausente (—) ≠ zero.
- **Categoria no estoque**: só por correspondência inequívoca da referência nas totalizações; caso contrário “Categoria não informada” ou “Conflito de categoria”. Nas fixtures: 199 de 398 referências.
- **Produtos e grade** usa as totalizações quando existem; vendas transacionais são fonte alternativa explícita, nunca somadas.
- **Mix de categorias clicável** em Vendas consolidadas abre o explorador na categoria.
- **Estoque**: novo status “Saldo negativo” e “Sem histórico de vendas” (substitui “Sem venda observada” quando não há vendas transacionais para o SKU). Tabela paginada.
- **Importador**: período sugerido = mês corrente até hoje (não mais setembro/2026 fixo), com aviso de que não vem do arquivo.
- **Migração 0003** neutralizada para bancos novos; original em `docs/historico/`.
- **UX**: Cormorant Garamond (títulos) + Inter (texto), contraste maior nos textos secundários, foco visível.
- **Teste** `tests/catalog.test.mjs`: CALÇAS filtra só seus modelos, homônimos distintos, grade = detalhe = resumo, ausente ≠ zero, formato antigo, estoque 7.039 variações / 8.445,2.

### Pendências conhecidas

- Hospedagem nova (Cloudflare) ainda não configurada; autenticação atual confia nos cabeçalhos do Sites — precisa ser substituída fora do Sites.
- Lint da base original tem ~80 erros pré-existentes (fora dos arquivos novos).
- Cartão “Variantes em risco” no estoque conta saldos zerados mesmo sem histórico de vendas.
- Relatórios ainda gerados dentro do fluxo de importação.

## Migração para Vercel + Supabase (30/09/2026)

A primeira versão de produção roda em **Vercel + Supabase**, não mais em Sites/Cloudflare.

| Antes | Agora |
|---|---|
| Vinext/Vite + Cloudflare Worker | Next.js 16 (App Router) na Vercel, região `iad1` (mesma do banco, us-east-1) |
| D1 (SQLite) + Drizzle | Supabase Postgres via `postgres.js` (pooler, `prepare:false`); schema em `supabase/migrations/` |
| R2 | Supabase Storage, bucket privado `imports` (arquivo enviado por URL assinada) |
| Cabeçalhos de identidade do Sites | Supabase Auth (`getUser()` no servidor), `proxy.ts` para páginas, 401 nas APIs |

- `lib/pg-adapter.ts` mantém a interface `prepare/bind/first/all/run/batch`; `batch` é uma transação Postgres. SQL específico de SQLite foi reescrito (`json_each` → `json_array_elements`, `json_extract` → colunas geradas `pos_store`/`pos_date`, `"end"` entre aspas).
- A Vercel limita o corpo das requisições a 4,5 MB, então o arquivo original sobe direto ao Storage e a rota recebe só as linhas (até 8.000). A rota confere que o arquivo existe e tem até 8 MB.
- A migração inicial já nasce sem o reset histórico; o gatilho `data_reset`/`__reset_files` não existe mais.
- Acesso: contas criadas no Supabase (cadastro público desativado), `ALLOWED_EMAILS` opcional, `APP_ADMIN_EMAIL` para IA.
- Testes de importação usam PGlite com as mesmas migrações. O driver de produção foi verificado contra PGlite via socket (parâmetros, JSON, rollback, `RETURNING`).

Pendências desta etapa: provisionar o projeto Supabase e o projeto Vercel (exige as contas do usuário); primeira importação real em produção; e-mails de acesso usam o SMTP padrão do Supabase (limite baixo por hora; configurar SMTP próprio se necessário).

## Estado do deploy — passagem para a próxima sessão

- Produção: Vercel (projeto importado de `guiweber4/Mond`, branch `main`) + Supabase (projeto `ynffyfdduupwghjnvkba`, São Paulo). Migrações já executadas; login funcionando; chave pública cadastrada como `SUPABASE_PUBLISHABLE_KEY` (a Vercel bloqueia `NEXT_PUBLIC_` + `KEY`).
- **Resolvido (30/09/2026):** a `DATABASE_URL` precisa ser o *shared pooler* da região do projeto (`us-east-1`, não São Paulo): `postgresql://postgres.ynffyfdduupwghjnvkba:<senha>@aws-1-us-east-1.pooler.supabase.com:6543/postgres`. O painel só mostra o *Dedicated pooler* (`db.<id>.supabase.co`, IPv6), que a Vercel não alcança. O código tenta `aws-0`/`aws-1` e reconhece as duas mensagens de "tenant not found" do Supavisor. Funções da Vercel em `iad1`, junto do banco. `/api/health` → `ok: true`.
- Use o **domínio de produção** da Vercel, não a URL de um deploy específico (ela congela código e variáveis).
- `/api/health` (PR #5) mostra o host do banco em uso, ambiente e commit do deploy.
- Próximo passo: importar as 7 planilhas em produção e conferir JK = 540 variações · 1.536 peças · R$ 1.291.617,77; configurar Site URL/Redirect URL no Supabase Auth para o link por e-mail.

## IA por finalidade (30/09/2026)

`lib/ai-core.ts` define cinco finalidades com instruções e limites próprios: análise do período, leitura de relatório (anexada ao relatório salvo), apresentação executiva (slides `## Título` + marcadores, salva em Relatórios), abastecimento e plano de ação. `lib/ai-context.ts` monta o contexto só com números calculados: vendas consolidadas do período mais recente, saldo por unidade/categoria, sinais vendas × estoque por referência (vendeu e está com saldo ≤ 1, com saldo em outras unidades; saldo ≥ 5 sem venda no período) e, quando houver vendas transacionais, riscos/decisões/qualidade do abastecimento. Sem vendas diárias, a IA é instruída a não estimar consumo, cobertura ou quantidades. Gerar é liberado a qualquer usuário logado; chaves e conexões continuam só com o administrador. Limite global por hora: `AI_HOURLY_LIMIT` (padrão 30). Teste: `tests/ai.test.mjs`.
