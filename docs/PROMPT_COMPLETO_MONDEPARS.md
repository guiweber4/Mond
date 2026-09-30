# Prompt para criar o novo Mondepars Intelligence

Você é responsável por produto, UX/UI, arquitetura e implementação de um sistema de inteligência de varejo de moda para a **Mondepars**. Crie um sistema funcional, persistente, responsivo e visualmente sofisticado, usando como ponto de partida o código e os arquivos anexados. Execute o trabalho até a entrega; não se limite a apresentar um plano ou protótipo estático.

## 1. Objetivo e contexto

O sistema deve ajudar a equipe a entender vendas, categorias, modelos, tamanhos, cores, estoque por loja e oportunidades de abastecimento. A análise precisa permitir sair de uma visão executiva e chegar à variação específica de um produto com poucos cliques.

A organização central é:

**Unidade e período → categoria → modelo/referência → cor e tamanho → detalhe por unidade.**

Exemplo: selecionar **CALÇAS**, escolher um modelo como **CALÇA KAI** ou **JEANS RETO MONDEPARS**, identificar sua referência, abrir a grade e comparar os saldos ou as vendas de cada tamanho e cor. Categorias e modelos devem vir dos dados reais. Não criar subcategorias, coleções, imagens, preços ou atributos que não foram fornecidos.

Existem cinco posições de lojas físicas e um e-commerce na configuração. Atualmente quatro unidades estão em operação:

| Unidade | Identificador atual | Tipo |
|---|---|---|
| Shopping JK | `02` | Loja física |
| Shopping Leblon / RJ | `05` | Loja física |
| Bela Cintra / BC | `BC` | Loja física |
| Ecommerce | `03` | Canal online com estoque próprio |

As outras duas lojas estão em implantação. Não incluí-las em comparações como se estivessem abertas. `BC` é um identificador interno cuja correspondência na Presence ainda precisa ser confirmada. Preservar configurações editadas pelo usuário e datas de abertura.

## 2. Como utilizar o pacote

1. Leia `LEIA_PRIMEIRO.md`, este prompt e `documentacao/ESTADO_E_REGRAS.md`.
2. Inspecione a pasta `codigo/`. Ela contém a base funcional publicada nesta conversa: interface, backend, cálculos, banco, importadores, testes e configuração de build.
3. Inspecione os sete Excel de `planilhas_referencia/`. São fixtures reais para validar os formatos; não inseri-los em produção sem uma ação explícita de importação.
4. `ux_em_andamento/` contém dois rascunhos iniciados antes desta exportação. Não estão integrados nem publicados. Use-os somente se ajudarem e revise-os antes de incorporá-los.
5. Preserve a lógica correta já existente. Corrija limitações reais e implemente a revisão de UX/UI descrita aqui.

**Este é um novo sistema/projeto.** Não publicar sobre o Site anterior. O `project_id` antigo foi retirado da configuração de hospedagem da cópia para evitar associação acidental. Criar uma nova identidade de projeto, novo banco e novo armazenamento. Se o ambiente oferecer o plugin Sites, seguir suas instruções atuais de criação, autenticação e publicação. Não copiar tokens, sessões, chaves ou bancos de produção.

## 3. Estado da base e escopo da evolução

Já existem na base:

- Importação de Excel/CSV com leitura, mapeamento, validação, amostra e confirmação.
- Totalização por referência, cor e tamanho; compatibilidade com a totalização antiga por referência.
- Importação do Saldo Estoque da Presence com cor e tamanho em colunas de nome repetido.
- Conferência das linhas TOTAL e preservação de valores negativos e fracionados de estoque.
- Persistência em D1 e arquivo original em R2, histórico de importações e substituição de snapshots.
- Visões de vendas, estoque, produtos, qualidade dos dados, abastecimento, ações, relatórios, unidades e conexões de IA.
- Testes de regras, criptografia/adaptadores simulados, totalizações e estoque.

A **revisão ampla de UX/UI ainda deve ser concluída**. Não declarar o novo explorador de categorias/modelos/grade como já integrado ao código publicado. Também existem limitações de correspondência entre o cadastro, os códigos sintéticos de estoque e os totais de vendas: revise explicitamente antes de cruzar fontes ou recomendar ações.

## 4. Fontes e separação dos dados

Manter três conjuntos distintos:

1. **Vendas consolidadas:** totais por unidade e período declarado, com referência e, quando disponíveis, cor/tamanho.
2. **Vendas transacionais:** itens de pedidos com data, ID da venda e ID do item.
3. **Estoque:** posição por unidade, data e variação.

Nunca somar vendas consolidadas às transacionais. Nunca transformar um total mensal em vendas diárias ou pedidos fictícios. Não calcular ticket, margem, velocidade diária ou sell-through quando faltarem as informações necessárias.

Os Excel enviados não contêm o período de venda nem a data do estoque. O usuário deve confirmar esses campos. Não fixar setembro de 2026 como padrão permanente: sugerir datas razoáveis, claramente editáveis, sem afirmar que foram extraídas do arquivo.

## 5. Formato de vendas: Totalização Produto

### Formato novo

| Cabeçalho | Significado |
|---|---|
| `REFERENCIA` | Referência do modelo; preservar código completo |
| `NM_GRUPO` | Categoria, como CALÇAS, CAMISA ou VESTIDO |
| `DESCRICAO` | Nome/descrição do modelo |
| `TAMANHO` | Tamanho com código de grade, por exemplo `01 - 32` |
| `COR` | Código e nome da cor, por exemplo `4 - JEANS CLARO` |
| `QT` | Quantidade líquida totalizada |
| `VALOR` | Valor totalizado da linha |

O formato anterior pode omitir TAMANHO e COR e conter `VLR_MEDIO`. Deve continuar funcionando. Detalhe ausente deve ser mostrado como “Não informado”, sem distribuição artificial entre variações.

Regras:

- A identificação da linha deve incluir unidade, início/fim do período, referência, tamanho e cor. Referência isolada não identifica uma variação.
- Preservar a distinção entre modelos com descrições iguais e referências diferentes.
- Preservar valores/quantidades negativos, linhas zeradas e ajustes financeiros com quantidade zero.
- Remover somente a linha de controle `TOTAL`, identificada pela referência TOTAL e demais atributos de produto vazios. Conferir sua quantidade e valor contra o conjunto de linhas antes de liberar a importação.
- Não descartar erros silenciosamente; informar linha, campo e motivo.
- Valores monetários devem ser reconciliados em centavos. Somar valores das linhas; não reconstruir receita multiplicando quantidade por média arredondada.
- VLR_MEDIO é opcional. Se exibir média calculada, identificar a fórmula e evitar resultados enganosos quando a quantidade líquida for zero/negativa.
- Reenvio idêntico da versão ativa não duplica dados.
- Uma nova versão completa da mesma unidade/período substitui o conjunto anterior, inclusive modelos e variações omitidos.
- Períodos diferentes não se misturam automaticamente. Não somar períodos sobrepostos; manter seleção explícita ou solicitar conciliação.

Fixtures deste pacote:

| Arquivo/unidade | Linhas de produto, sem TOTAL | QT | VALOR |
|---|---:|---:|---:|
| BC | 212 | 497 | R$ 472.946,10 |
| ECOMM | 270 | 648 | R$ 504.001,68 |
| JK | 540 | 1.536 | R$ 1.291.617,77 |
| Total das três fixtures | 1.022 | 2.681 | R$ 2.268.565,55 |

Não há arquivo de totalização RJ neste pacote. Não interpretar essa ausência como venda zero.

## 6. Formato de estoque: Saldo Estoque

Os arquivos apresentam duas colunas com o nome original “Descrição”. O leitor XLSX usado na base diferencia a segunda como `Descrição_1`.

| Cabeçalho lido | Significado |
|---|---|
| `Referência` | Referência do modelo |
| `Descrição Item` | Nome do modelo |
| `Descrição` | Cor, incluindo código, por exemplo `3 - CHUMBO` |
| `Descrição_1` | Tamanho, por exemplo `UNI`, `PP`, `32` ou `42` |
| `Saldo Base` | Saldo informado pela Presence |

Regras:

- Detectar o formato automaticamente pela combinação de cabeçalhos, não só pelo nome do arquivo.
- Sugerir unidade pelo nome do arquivo (JK, BC, ECOMM, RJ), mas permitir confirmação e correção.
- Exigir confirmação da data da posição. O arquivo não fornece essa data.
- Identificar cada variação por referência + cor + tamanho, e cada posição por unidade + data + variação.
- Limpar espaços excedentes para comparação sem perder os códigos/valores originais necessários à rastreabilidade.
- Preservar todos os saldos, inclusive zero, negativos e frações. Não arredondar tecidos ou outros itens fracionados para peças inteiras.
- Não chamar todo saldo de “peças”: o arquivo não traz unidade de medida. Usar “Saldo informado” e explicar a ausência de unidade de medida.
- Consolidar linhas repetidas da mesma referência/cor/tamanho pela soma, preservando o número de linhas e saldos originais para auditoria. Descrições incompatíveis para a mesma combinação devem gerar erro ou conflito explícito.
- Existem repetições com saldos −1 e +1 que se compensam. Não deduplicar simplesmente apagando uma das linhas.
- Conferir a linha TOTAL e excluí-la dos produtos importados.
- Reservas e trânsito não são informados. Não apresentá-los como zero confirmado nem garantir “estoque livre” com base somente no Saldo Base.
- Valores negativos devem permanecer visíveis, sem serem apagados por um cálculo de disponibilidade que use máximo com zero.
- A nova importação completa para a mesma unidade/data substitui toda a posição anterior, inclusive variações que desapareceram do arquivo.
- Posições em datas diferentes preservam histórico. A consulta usa a última posição disponível por unidade até a data escolhida.
- Reimportar um arquivo antigo após uma correção pode torná-lo a versão atual novamente; a verificação de duplicidade deve considerar a versão ativa, não qualquer hash histórico.

Fixtures deste pacote:

| Unidade | Linhas antes de consolidar, sem TOTAL | Variações finais por unidade | Saldo total |
|---|---:|---:|---:|
| JK | 2.365 | 2.362 | 2.202 |
| BC | 804 | 804 | 2.044 |
| ECOMM | 2.111 | 2.106 | 1.723,2 |
| RJ | 1.771 | 1.767 | 2.476 |
| Total | 7.051 | 7.039 | 8.445,2 |

As 7.039 variações são contadas por unidade; não significam 7.039 modelos ou SKUs distintos globalmente. A soma de saldos é uma conciliação numérica, não uma declaração de unidade de medida comum.

## 7. Catálogo e correspondência entre fontes

Separar explicitamente:

- Categoria: agrupamento informado pela fonte.
- Modelo: referência completa + nome, sem tratar nomes iguais como identidade garantida.
- Variação: modelo + cor + tamanho.
- Posição: variação + unidade + data.
- Venda totalizada: variação ou modelo sem detalhe + unidade + período.

No estoque, a categoria não vem no Excel. Reutilizar a categoria de um cadastro ou de totalizações somente quando a referência tiver correspondência inequívoca. Caso contrário, mostrar “Categoria não informada” ou “Conflito de categoria”, sem inferir pelo prefixo do código ou pelo nome.

Para cruzar tamanhos, observar que `01 - 32` nas vendas e `32` no estoque podem representar o mesmo tamanho. Separar código de grade de rótulo de tamanho; não usar `01` sozinho como tamanho universal. Cores também têm espaços e separadores diferentes entre arquivos. Criar uma correspondência canônica auditável, preservar valores brutos e não combinar ambiguidades silenciosamente.

Não confundir códigos sintéticos de variação criados pelo sistema com um SKU oficial da Presence. Documentar a identidade e fornecer estado de correspondência. Manter modelos com referências diferentes separados, ainda que seus nomes sejam iguais.

## 8. UX/UI: direção visual

Quero uma interface mais bonita, madura e agradável, coerente com uma marca de moda. Manter a identidade Mondepars: logotipo tipográfico, sidebar escura em tons de carvão/azul-petróleo, superfícies claras e números com boa hierarquia. Usar tipografia de títulos com personalidade e texto operacional muito legível.

Não quero um dashboard genérico nem uma parede de tabelas. Melhorar:

- Hierarquia: resumo → comparação → exploração → detalhe.
- Espaçamento e alinhamento consistentes.
- Contraste de textos secundários; evitar cinza claro demais.
- Indicadores com nomes claros, unidades e contexto.
- Filtros agrupados por finalidade, com rótulos visíveis e opção de limpar.
- Densidade equilibrada, listas paginadas, cabeçalhos legíveis e rolagem controlada.
- Comportamento responsivo real em desktop e celular, sem esconder dados essenciais.
- Estados de carregamento, vazio, erro, sucesso e dados ausentes.
- Navegação por teclado, foco visível, nomes acessíveis e expansão de modelos com estado anunciado.

Não inventar fotografias de produtos. Se não há imagens reais, usar nomes, referências, grade e dados como protagonistas. Não representar uma cor com um swatch visual impreciso sem correspondência confiável.

## 9. UX/UI: exploração por categoria, modelo e grade

Implementar o mesmo padrão de exploração em vendas consolidadas, produtos e estoque, adaptando as métricas à fonte:

1. **Categoria:** dropdown com as categorias reais e visão do mix. Ao selecionar CALÇAS, só listar seus modelos.
2. **Modelo:** dropdown dependente com nome e referência; mostrar todos os modelos da categoria, com busca quando houver muitos.
3. **Modelo expandido:** resumo do valor/quantidade ou saldo e número de variações.
4. **Grade:** matriz com cores nas linhas e tamanhos nas colunas. Diferenciar zero de dado ausente. Ordenar tamanhos numericamente ou na ordem da grade, não só alfabeticamente.
5. **Detalhe:** tabela filtrável por cor, tamanho e unidade, com valores exatos, datas/período e origem quando apropriado.

Permitir clicar na categoria do gráfico/mix para abrir seus modelos. Clicar em uma célula da grade deve filtrar o detalhe, com forma clara de voltar à grade completa. Ao trocar categoria, limpar um modelo que não pertence à nova categoria. Ao trocar período/unidade, reconciliar filtros que deixaram de existir.

Mostrar o contexto ativo: categoria, modelo, unidade, período e quantidade de resultados. Totais filtrados devem ser claramente identificados; não misturar cards filtrados com totais gerais sem explicação. A paginação deve permitir chegar a todos os resultados, não apenas truncar nos primeiros 100 ou 150.

Vendas e estoque podem compartilhar componentes, mas não devem ser somados ou mesclados como uma única métrica. A grade de vendas mostra QT; a de estoque mostra Saldo Base.

## 10. Telas e fluxos

### Visão geral / Vendas consolidadas

Resumo de valor totalizado, quantidade líquida, unidades com arquivo e cobertura do período. Comparação entre unidades, mix de categorias clicável, modelos em destaque e acesso ao explorador. Informar unidades sem arquivo. Datas diárias, ticket e evolução não aparecem como números reais quando a única fonte é uma totalização.

### Produtos e grade

Explorar catálogo, categoria, modelo e variações sem exigir vendas transacionais se já existem totalizações. Quando ambas as fontes existirem, deixar explícita a fonte escolhida. Nunca gerar uma tela vazia por usar a coleção errada de dados.

### Estoque

Filtros por unidade, data, categoria disponível, modelo, cor, tamanho e situação. Destacar saldos negativos, zerados, fracionados e posições antigas. Disponibilidade, demanda e cobertura dependem de dados válidos; “sem histórico” não é sinônimo de “sem procura”.

### Abastecimento e plano de ação

Preservar regras de consumo, prazos, mínimos, múltiplos, rotas e compras em aberto. Mostrar premissas, origem, destino, quantidade, prazo, qualidade dos dados e responsável. Aprovar uma ação registra uma decisão, sem executar movimentação na Presence.

### Dados e importações

Fluxo visível: selecionar arquivo → reconhecer formato → confirmar unidade/data ou período → conferir colunas → validar e reconciliar → confirmar → mostrar sucesso e abrir os dados. Mostrar histórico com nome, unidade, tipo, data, contagem, situação e motivo da falha.

### Qualidade dos dados

Exibir o que falta, o que diverge e como corrigir: cadastro, categoria ausente, correspondência de variações, totais divergentes, ausência de arquivo, posição antiga e informações insuficientes para recomendações. Não confundir dado ausente com zero.

### Relatórios

Preservar relatórios salvos, exportação e impressão. Separar relatórios consolidados de relatórios transacionais. Incluir período, unidade, fonte e limitações pertinentes. Exportações devem permitir reproduzir os totais da tela; deixar explícito se exportam o recorte filtrado ou a base completa.

### Lojas e metas / IA

Manter cadastro das unidades, status, abertura, metas e configuração de IA. Harmonizar formulários, estados, botões e mensagens com o restante da interface.

## 11. Cálculos e recomendações

- Valores monetários: trabalhar em centavos para somas e conciliação.
- Vendas transacionais: excluir cancelamentos; descontar devoluções; manter a definição de ticket documentada na base.
- Não produzir margem sem custos nem sell-through sem estoque inicial/entradas.
- Consumo diário e cobertura exigem vendas datadas e correspondência de SKU validada. Totalização mensal isolada não satisfaz esse requisito.
- Regras atuais de abastecimento incluem janela de até 28 dias, projeção de até 90 dias, estoque recente, cadastro, mínimos, múltiplos e rotas. Inspecionar `lib/operations.ts` antes de alterar fórmulas.
- Não somar duas vezes pedidos a receber e campo “em trânsito”.
- Preservar a proteção de saldo já comprometido por transferências aprovadas ou concluídas ainda sem posição posterior.
- E-commerce tem estoque próprio; não pressupor transferências com todas as lojas.
- Nenhuma recomendação deve ocultar falta de histórico, reservas desconhecidas, unidade de medida ausente ou correspondência duvidosa.

## 12. IA e integração Presence

Manter múltiplas conexões de IA: OpenAI, Anthropic, Gemini, Groq, DeepSeek e OpenRouter, conforme os adaptadores existentes. Configurar modelo por conexão, principal e reserva opcional autorizada. Não exigir IA para cálculos determinísticos ou importação.

Chaves ficam no servidor, criptografadas com chave mestra própria. Não colocar segredos no frontend, localStorage, código, ZIP ou logs. Apenas retornar indicação mascarada. Registrar uso e erro sem expor credenciais. A IA recebe contexto agregado, interpreta resultados e não inventa números nem executa ações.

A Presence está integrada por arquivos, **não por uma API já configurada**. Não inventar endpoints ou credenciais. A consulta horária do painel só atualiza dados que já foram importados. Coleta automática, envio agendado e integrações futuras devem aparecer como pendentes até terem implementação e validação reais.

## 13. Arquitetura, persistência e importação confiável

Preferir evoluir a stack fornecida: TypeScript, React, Vinext/Vite, componentes existentes, XLSX, Cloudflare Worker, D1/SQLite, Drizzle e R2. Preservar lockfile e contratos quando possível. O projeto não é apenas frontend; não substituir persistência real por localStorage ou arrays fictícios.

Se outra plataforma for necessária, portar explicitamente autenticação, banco, armazenamento, transações e APIs. Não prometer que um Worker com `cloudflare:workers` funciona sem adaptação em um servidor Node genérico.

Requisitos do importador:

- Limites claros de arquivo e linhas (a base usa 8 MB e até 8.000 linhas).
- Validação no cliente para prévia e novamente no servidor.
- Gravação atômica de registros e ativação do snapshot. Falhas não deixam uma posição parcialmente ativa.
- Idempotência por conteúdo/escopo ativo e proteção contra clique duplo.
- Preservação do original e das versões anteriores.
- Operações em lotes compatíveis com os limites do banco/Worker; evitar uma consulta remota por linha.
- Prazo de espera definido e saída de loading em erro ou sucesso.
- Em timeout com resultado incerto, consultar estado antes de reenviar; não declarar falha definitiva nem duplicar automaticamente.
- Confirmação de importação deve refletir dados realmente persistidos. A atualização do painel e geração de relatórios não podem mascarar esse resultado.
- Erros acionáveis, sem spinner infinito e sem mostrar sucesso em resposta inválida.

Manter distinção entre acesso do administrador e demais perfis. Para nova hospedagem fora do Sites, substituir a confiança em cabeçalhos de identidade por autenticação confiável no servidor. Não confiar em cabeçalhos que um visitante possa forjar.

## 14. Migrações e inicialização

Inspecionar todas as migrações antes de aplicar. A base inclui uma migração histórica `0003_real_world_reset.sql` que limpa dados de uma instalação antiga. Ela não é uma rotina de inicialização a repetir em banco preenchido. O novo sistema deve começar em recursos isolados e registrar migrações aplicadas. Se criar um bootstrap limpo, fazê-lo sem apagar o histórico do projeto original nem executar um reset de produção.

O ZIP não contém o banco de produção, arquivos R2 de produção, credenciais ou pacotes instalados. Instalar dependências a partir do lockfile e configurar as variáveis de ambiente necessárias. Os arquivos de referência servem para testes e importação manual.

## 15. Critérios de aceite

Concluir somente quando:

1. Os três arquivos de vendas do pacote conciliam 1.022 linhas, 2.681 de QT e R$ 2.268.565,55.
2. Os quatro de estoque conciliam 7.051 linhas de origem, 7.039 variações por unidade e os quatro totais originais, sem perder negativos/frações.
3. TOTAL não entra como produto, repetição de upload não duplica e substituição de snapshot remove variações ausentes.
4. O formato antigo continua aceito.
5. Categoria CALÇAS filtra somente seus modelos; selecionar um deles mostra apenas suas variações e métricas reconciliadas.
6. Modelos homônimos com referências diferentes permanecem distinguíveis.
7. Cor e tamanho preservam identidade; dados ausentes são diferentes de zero.
8. A grade e a tabela de detalhe reconciliam com o resumo do modelo e da categoria.
9. Troca de categoria, modelo, período e unidade não deixa filtros inválidos ou resultados contraditórios.
10. Busca, ordenação, paginação, expansão e limpeza de filtros funcionam com teclado e em telas pequenas.
11. A tela de Produtos usa as totalizações quando apropriado e não depende de transações inexistentes.
12. Não há loop infinito na confirmação, sucesso falso, gravação parcial ativa ou exposição de segredos.
13. Cálculos/recomendações respeitam limitações das fontes e o estoque próprio de cada unidade.
14. Build e verificação de tipos passam. Rodar os testes relevantes e documentar o que foi efetivamente validado.
15. Inspecionar visualmente desktop e celular quando o ambiente permitir; declarar qualquer limitação de teste real sem alegar validação inexistente.

## 16. Forma de trabalhar e entrega

Comece inspecionando código e fixtures. Faça um diagnóstico curto com prioridades, implemente a solução e preserve o comportamento já correto. Tome decisões rotineiras sem ficar pedindo autorização. Pergunte apenas quando a ambiguidade mudar uma regra de negócio ou exigir acesso que não existe.

Entregue o novo sistema funcional, com código organizado, instruções de execução, evidência dos testes e lista objetiva de limitações remanescentes. Se usar Sites, publique em um **novo projeto privado**, entregue a URL e mantenha o projeto original intacto.

O resultado deve permitir responder rapidamente: **qual categoria vende, qual modelo explica o resultado, quais tamanhos/cores participam e como está o saldo dessa variação em cada unidade — sempre respeitando a qualidade e a granularidade dos dados disponíveis.**
