# Mondepars — V2 operacional

## Uso

1. Confirme códigos, status e datas das seis unidades em **Lojas e metas**.
2. Em **Dados e integrações**, importe Produtos, Vendas, Estoque, Metas, Fechamentos de referência e Pedidos de compra. Cada tipo tem planilha modelo e mapeamento de colunas.
3. Envie posições completas de estoque, incluindo zeros. Preserve posições diárias para estimar disponibilidade. Use IDs estáveis para atualizar itens de venda e compra; recebimentos parciais atualizam o pedido existente.
4. Revise **Qualidade dos dados**: totais de receita e peças contra fechamentos extraídos da Presence. Fechamento zerado confirma um dia sem movimento.
5. Configure prazos, mínimos, múltiplos e rotas em **Abastecimento**. O e-commerce tem estoque próprio e só participa das rotas explicitamente cadastradas.
6. No **Plano de ação**, atribua responsável, prazo e nota. A aprovação registra decisão, sem executar movimentação na Presence. Conclua após executar e importe nova posição. Transferências aprovadas, e concluídas ainda sem posição posterior, protegem o excedente da origem contra alocação repetida.
7. Em **Inteligência artificial**, cadastre uma ou mais conexões (nome, provedor, modelo e chave), teste e escolha a principal. A reserva exige autorização explícita. Alterar provedor exige nova chave; deixar chave em branco na edição mantém a atual.

## Cálculos e limites

- Receita líquida: itens vendidos após descontos, menos devoluções; sem frete. Cancelamentos excluídos. Ticket médio mantém a definição da V1.
- Disponível: físico menos reservado. Janela de consumo de até 28 dias na V2. Havendo pelo menos 7 dias de estoque positivo e fechamento conciliado, estima consumo nesses dias; sem isso usa média observada, identificada como preliminar.
- Recomendações exigem pelo menos 14 dias de vendas observadas, cadastro do SKU, estoque com no máximo 1 dia de defasagem e ausência de fechamentos divergentes na unidade. Ausência de controles não confirma completude.
- Projeção de até 90 dias com demanda constante. Sem ajuste sazonal; posições de fim de dia não capturam ruptura intradiária. Saldo negativo representa demanda potencial não atendida, não estoque físico negativo.
- Entradas usam o saldo não recebido de pedidos abertos com data prevista. Entregas passadas são excluídas e destacadas como atrasadas. O campo de estoque “em trânsito” não é somado novamente.
- Compras consideram horizonte máximo entre cobertura desejada e prazo de fornecimento + segurança. Mínimo e múltiplo por SKU respeitados. Rotas ordenadas por prazo e custo estimado, sem otimizador global de frete.
- Os dados de pedido refletem sua última versão importada, inclusive ao consultar uma data anterior. Não representam reconstrução contábil histórica dos pedidos.
- As três lojas futuras permanecem fora das comparações enquanto não estiverem em operação. Histórico insuficiente suspende sugestões quantitativas.
- Relatórios diários, semanais e mensais são gerados a cada importação ou sob demanda. Coleta da Presence e agenda independente dependem da API e ainda não estão ativas. O painel consulta a base importada a cada hora enquanto aberto.

## IA e segurança

Adaptadores: OpenAI Responses, Anthropic Messages, Google Gemini generateContent, Groq, DeepSeek e OpenRouter Chat Completions. Modelo informado pelo administrador, sujeito ao acesso e às capacidades da conta. Endpoints fixos; sem URL arbitrária e sem seguir redirecionamentos.

Credenciais criptografadas com AES-256-GCM no D1, chave mestra `AI_VAULT_KEY` em segredo de ambiente do servidor. Contexto autenticado por conexão e provedor. Apenas sufixo mascarado é retornado; nenhuma chave é guardada em localStorage. Acesso administrativo usa identidade autenticada pelo Sites e `APP_ADMIN_EMAIL`. Manter a chave mestra estável; substituí-la requer recadastrar as chaves dos provedores.

Até 20 solicitações por hora no conjunto do site. Testes contam no limite e consomem tokens. Cada análise pode realizar uma segunda chamada na reserva, se habilitada, apenas para limite, indisponibilidade ou timeout. Erros de autenticação e modelo não disparam reserva. Limite de saída solicitado: 1.500 tokens (128 nos testes), dependente do suporte do modelo. Histórico guarda provedor, modelo, finalidade, tokens informados, duração, resultado e texto; custos monetários não são estimados.

A IA recebe resumos agregados e recomendações calculadas; nomes de clientes e credenciais não entram no contexto. Saída consultiva renderizada como texto, sem alterar métricas ou executar ações. A conexão escolhida pode encaminhar dados a outro provedor quando a reserva tiver sido autorizada. A chave e as políticas de tratamento de dados de cada conta devem ser administradas pelo proprietário.

## Verificação

`node tests/v2.test.mjs` cobre conciliação, compras parciais e atrasadas, reserva entre decisões, mínimos, unidades futuras, estoque próprio, importação, consistência dos relatórios, criptografia e envelopes dos seis provedores com respostas simuladas. Nenhuma chave real foi fornecida para validar chamadas externas.

`node node_modules/typescript/bin/tsc --noEmit` verifica tipos. Migração aditiva em `drizzle/0001_typical_lenny_balinger.sql`; a migração anterior permanece intacta.

## Excel de totalização da Presence (setembro/2026)

Quatro unidades atuais: JK · Shopping JK (`02`), RJ · Shopping Leblon (`05`), Ecomm · Ecommerce (`03`) e BC · Bela Cintra (`BC`, identificador interno a confirmar na Presence). Duas unidades futuras em implantação. A atualização de nomes/status aplica-se aos cadastros padrão antigos; configurações personalizadas permanecem preservadas.

Importar em **Dados e integrações → Presence · Totalização por produto**. Cabeçalhos reconhecidos: `REFERENCIA`, `NM_GRUPO`, `DESCRICAO`, `QT`, `VALOR`, `VLR_MEDIO`. Unidade sugerida pelo nome do arquivo e setembro/2026 preenchido como período; conferir ambos antes de confirmar. O período declarado não confirma o fechamento completo do mês.

Os valores são armazenados como totais por referência/unidade/período, separados das transações. A nova importação completa da mesma unidade/período substitui a anterior, inclusive referências omitidas. Reenvio idêntico à versão atual é ignorado. Arquivos originais e histórico de versões continuam preservados; nenhuma linha é artificialmente convertida em pedido ou dia de venda.

**Vendas consolidadas** apresenta valor, saldo de peças, ranking de referências, mix de categorias, comparação por unidade, fontes, ajustes negativos, relatório salvo e exportação. Ausência de arquivo é apresentada como dado ausente, sem venda zero presumida. Períodos diferentes são selecionados separadamente; não se rateiam totais mensais para dias ou semanas.

A análise de IA desta tela utiliza os totais consolidados reais, com métricas desconhecidas explicitamente ausentes. Continua exigindo chave/modelo e conexão principal configurados em **Inteligência artificial**. Não cria reposições, estoque, margem ou ticket a partir de totalizações.

Validação com os quatro Excel enviados: 544 linhas, incluindo 10 linhas com valores/quantidades negativos e o ajuste de −R$ 86 com quantidade zero no e-commerce. Quantidades e valores em centavos reconciliados ao arquivo de origem. Os arquivos de referência foram usados para teste e não inseridos automaticamente na base publicada.
