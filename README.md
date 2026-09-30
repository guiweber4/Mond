# Mondepars Intelligence

Sistema de inteligência de varejo de moda para a Mondepars: vendas consolidadas, estoque por unidade, catálogo (categoria → modelo → cor/tamanho), qualidade dos dados, abastecimento, plano de ação, relatórios e análise assistida por IA.

**Stack:** Next.js 16 (App Router) na **Vercel** · **Supabase** (Postgres, Storage privado e Auth) · TypeScript · React 19 · XLSX.

## Arquitetura

| Camada | Onde | Arquivo |
|---|---|---|
| Páginas e API | Vercel (funções Node, região `gru1`) | `app/`, `app/api/*/route.ts` |
| Banco | Supabase Postgres via pooler, transações reais | `lib/db.ts`, `lib/pg-adapter.ts`, `supabase/migrations/` |
| Arquivos originais | Supabase Storage, bucket privado `imports` | `lib/db.ts` (`bucket()`), `app/api/import/upload` |
| Login | Supabase Auth, validado no servidor a cada requisição | `lib/auth.ts`, `proxy.ts`, `app/login` |

- Importação: o navegador lê e valida a planilha, envia o arquivo original ao Storage por URL assinada e depois envia as linhas; o servidor valida de novo e grava tudo numa única transação (sem snapshot parcial). Reenvio idêntico da versão ativa não duplica.
- Segurança: todas as tabelas têm RLS ligado e nenhuma política, então a chave pública do Supabase não lê nem grava dados; só o servidor acessa o banco. Chaves de IA ficam criptografadas (AES-256-GCM) com `AI_VAULT_KEY`.

## Colocar no ar (primeira vez)

1. **Supabase** — crie um projeto (região São Paulo, `sa-east-1`).
   - SQL Editor: execute, em ordem, os arquivos de `supabase/migrations/` (ou `supabase db push` com a CLI).
   - Authentication → Sign In / Providers: **desative “Allow new users to sign up”**.
   - Authentication → Users → **Add user**: crie as contas da equipe (e-mail + senha, ou convite).
   - Authentication → URL Configuration: *Site URL* = URL da Vercel; adicione `https://<seu-domínio>/auth/callback` em *Redirect URLs*.
2. **Vercel** — importe o repositório `guiweber4/Mond` (framework Next.js, detectado por `vercel.json`).
   - Cadastre as variáveis de `.env.example` em Settings → Environment Variables (Production e Preview).
   - Faça o deploy. Entre com uma conta criada no passo 1.

## Desenvolvimento local

Requisitos: Node.js ≥ 22.13 e pnpm 11.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local   # preencha com um projeto Supabase de desenvolvimento
pnpm dev                     # http://localhost:3000
pnpm typecheck && pnpm test && pnpm build
```

## Testes

`tests/v2.test.mjs` cobre regras e cálculos. Os testes de importação rodam o código real de `lib/db.ts` e a rota de importação sobre **PGlite** (Postgres em memória) com as migrações do Supabase — não tocam em nenhum banco externo.

As planilhas reais da Presence **não são versionadas** (dados comerciais). Coloque-as em `fixtures/` (ignorada pelo git) e rode:

```sh
pnpm test:fixtures
```

Conciliação esperada: vendas 1.022 linhas / QT 2.681 / R$ 2.268.565,55; estoque 7.051 linhas → 7.039 variações por unidade / saldo 8.445,2.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`docs/PROMPT_COMPLETO_MONDEPARS.md`](docs/PROMPT_COMPLETO_MONDEPARS.md) | Especificação completa do produto e critérios de aceite |
| [`docs/ESTADO_E_REGRAS.md`](docs/ESTADO_E_REGRAS.md) | Estado atual, regras de dados e mapa do código |
| [`V2-NOTES.md`](V2-NOTES.md) | Notas históricas da versão anterior (Sites/Cloudflare) |
| `docs/historico/` | Migrações D1 originais (inclusive o reset 0003, nunca reaplicar) e README do starter antigo |
| `docs/ux-rascunhos/` | Rascunhos de UX da sessão anterior (referência) |
