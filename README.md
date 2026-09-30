# Mondepars Intelligence

Sistema de inteligência de varejo de moda para a Mondepars: vendas consolidadas, estoque por unidade, catálogo (categoria → modelo → cor/tamanho), qualidade dos dados, abastecimento, plano de ação, relatórios e análise assistida por IA.

Stack: TypeScript · React 19 · Vinext/Vite · Cloudflare Worker · D1 (SQLite) + Drizzle · R2 · XLSX.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`docs/PROMPT_COMPLETO_MONDEPARS.md`](docs/PROMPT_COMPLETO_MONDEPARS.md) | Especificação completa do produto e critérios de aceite |
| [`docs/ESTADO_E_REGRAS.md`](docs/ESTADO_E_REGRAS.md) | Estado atual, regras de dados e mapa do código |
| [`docs/VALIDACAO.md`](docs/VALIDACAO.md) | Validação da exportação original |
| [`docs/LEIA_PRIMEIRO.md`](docs/LEIA_PRIMEIRO.md) | Notas de transferência do pacote |
| [`V2-NOTES.md`](V2-NOTES.md) | Notas históricas (podem estar desatualizadas) |
| [`docs/STARTER_README.md`](docs/STARTER_README.md) | README do starter Vinext (hospedagem, migrações locais) |
| `docs/ux-rascunhos/` | Rascunhos de UX não integrados (referência apenas) |

## Executar localmente

Requisitos: Node.js ≥ 22.13 e pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
node tests/v2.test.mjs
pnpm dev            # http://localhost:5173
pnpm build
```

## Planilhas de referência (fixtures)

As planilhas reais da Presence **não são versionadas** (contêm dados comerciais). Coloque-as em `fixtures/` (ignorada pelo git) e rode:

```sh
node tests/detailed-import.test.mjs fixtures
node tests/stock-import.test.mjs fixtures
```

Conciliação esperada: vendas 1.022 linhas / QT 2.681 / R$ 2.268.565,55; estoque 7.051 linhas → 7.039 variações por unidade / saldo 8.445,2.

## Segurança

- Nenhum segredo no repositório. Variáveis de servidor em `.env.example` (`AI_VAULT_KEY`, `APP_ADMIN_EMAIL`).
- Nunca executar `drizzle/0003_real_world_reset.sql` em banco preenchido — é uma limpeza histórica, não um bootstrap.
