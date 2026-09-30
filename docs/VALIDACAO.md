# Validação da cópia exportada

Executada em 30/09/2026 com Node.js 24 e dependências da mesma base/lockfile.

- TypeScript: `tsc --noEmit` passou.
- `tests/v2.test.mjs`: 67 verificações passaram.
- `tests/detailed-import.test.mjs`: três fixtures de totalização passaram; 1.022 variações, conciliação de quantidades/centavos, persistência e reenvio duplicado.
- `tests/stock-import.test.mjs`: quatro fixtures de estoque passaram; 7.039 variações por unidade, preservação de saldos, gravação/leitura, substituição da posição e compatibilidade anterior.
- Testes de persistência executados em SQLite em memória com adaptador de teste. Não escrevem no banco de produção.
- Chamadas de IA simuladas; nenhuma credencial real foi usada.
- Esta exportação não inclui validação visual dos rascunhos de UX.
- Build da mesma base publicado com sucesso na etapa anterior desta conversa. Não houve nova publicação nesta exportação.
