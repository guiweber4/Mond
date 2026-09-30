# Mondepars Intelligence — pacote para nova sessão

Este pacote transfere o código-fonte publicado nesta conversa, as planilhas de referência e a especificação da próxima evolução.

## Como começar no ChatGPT / Codex

1. Anexe `Mondepars_Nova_Sessao.zip` à nova conversa.
2. Cole o conteúdo de `documentacao/PROMPT_COMPLETO_MONDEPARS.md`, ou escreva: **“Abra o ZIP, leia LEIA_PRIMEIRO.md e execute o PROMPT_COMPLETO_MONDEPARS.md. Crie um novo projeto a partir da base fornecida, preserve os importadores e conclua a revisão de UX/UI.”**
3. O código está em `codigo/`. As sete planilhas estão em `planilhas_referencia/`.
4. O novo sistema deve usar projeto, banco e armazenamento próprios. O identificador de hospedagem do sistema anterior foi retirado desta cópia.

## O que foi exportado

- Código de aplicação, componentes, backend, biblioteca de cálculos, importadores, migrações, testes, scripts, assets, configurações e lockfile.
- Base do commit `b8a5cbe3ddc8fbca43b00b1033d2e8ac8dba02ca`, cuja publicação foi confirmada com sucesso nesta conversa.
- Snapshot funcional com importação das totalizações novas e dos quatro formatos Saldo Estoque fornecidos.
- Prompt completo para evolução e revisão de UX/UI.
- Dois rascunhos de exploração de catálogo em `ux_em_andamento/`, fora do código funcional.
- Manifesto SHA-256 para verificar a integridade dos arquivos do pacote.

O pacote não é um dump do banco de produção. Não contém credenciais, histórico Git, dependências instaladas (`node_modules`), dados R2 de produção ou caches de build. As planilhas são cópias dos anexos fornecidos; não foram importadas automaticamente no sistema publicado.

## Estado da revisão visual

A revisão ampla de UX/UI foi iniciada, mas ainda não foi integrada nem publicada. O prompt especifica a experiência categoria → modelo → cor/tamanho, a grade interativa, a melhoria visual e os critérios de aceite. Os rascunhos separados podem ajudar a próxima sessão, mas não constituem uma implementação validada.

## Execução técnica

Requisitos da base: Node.js >=22.13.0; para os testes que usam `node:sqlite`, preferir Node.js 24, versão utilizada na validação desta exportação. Gerenciador indicado no `package.json`: pnpm 11.25.0. Os comandos abaixo assumem um ambiente com acesso às dependências e os runtimes necessários.

```sh
cd codigo
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
node tests/v2.test.mjs
node tests/detailed-import.test.mjs ../planilhas_referencia
node tests/stock-import.test.mjs ../planilhas_referencia
pnpm build
```

O projeto usa React/TypeScript com Vinext/Vite e runtime Cloudflare Workers, D1/SQLite e R2. Não é um projeto Next.js convencional que possa ser movido para qualquer servidor sem adaptação.

No Sites, a próxima sessão deve seguir a skill atual do plugin: configurar o perfil de execução, registrar um novo projeto e provisionar DB/BUCKET. O arquivo `.openai/hosting.json` mantém os nomes lógicos dos bindings sem vínculo com o Site anterior.

Para desenvolvimento local fora do Sites, o perfil sem configuração é `portable`; `pnpm dev` usa a porta 5173. Isso não aplica migrações automaticamente. Após o build, use o Wrangler local e a configuração gerada para inicializar um banco NOVO, aplicando cada migração uma única vez e registrando as aplicadas. Consulte `codigo/README.md` para o formato do comando de migração. Nunca executar a migração histórica de reset em um banco preenchido apenas para “iniciar” o sistema.

`codigo/.env.example` lista variáveis sem valores. A IA é opcional; suas conexões exigem chave mestra de cofre e identificação administrativa configuradas no servidor. Não use dados secretos do projeto anterior.

## Atenção à documentação histórica

`codigo/README.md` descreve o starter e `codigo/V2-NOTES.md` contém anotações de fases anteriores, inclusive contagens, unidades e formatos que evoluíram. Para o estado atual, priorize `documentacao/ESTADO_E_REGRAS.md`, o prompt e o próprio código. Não tratar documentação histórica como prova de uma integração ativa.

`tests/total-import.test.mjs` é um teste legado que espera quatro planilhas antigas, não incluídas neste pacote. Os testes `detailed-import` e `stock-import` usam as sete fixtures presentes.
