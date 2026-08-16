# Guia de administração — DonFlow (template base)

> Cole este arquivo no início de uma conversa nova para dar contexto de arranque sobre como
> administrar um projeto criado a partir deste template. Ele descreve a arquitetura, o passo a
> passo de provisionamento por provedor, e — mais importante — os pontos que já causaram
> incidentes reais no primeiro cliente em produção e que **não podem se repetir**.

## 1. Visão geral

O DonFlow é uma plataforma de agendamento para barbearias: painel interno (barbeiros/master) +
portal do cliente. Stack:

- **Backend**: NestJS 11 + Prisma 7 + PostgreSQL, em `apps/api`.
- **Frontend**: React 19 + Vite 8 + React Router 8 + TanStack Query, em `apps/web`.
- **Monorepo**: npm workspaces (raiz tem `build`, `lint`, `test`, `test:e2e`,
  `test:integration`, `verify` — este último roda tudo).
- Documentação de arquitetura já existe em `docs/architecture/*`, `docs/guides/*` e
  `docs/security/production-security-baseline.md` — leia-os antes de mexer em qualquer coisa
  relacionada a auth, agendamento ou segurança; eles já capturam decisões e incidentes
  anteriores.

Este repositório (`donflow`) é o **template limpo**, sem nenhuma secret e sem nenhuma conexão
com provedores de deploy — é sempre o ponto de partida para um cliente novo, nunca o destino de
um deploy real. O primeiro cliente real vive em um repositório **separado**, criado como uma
cópia espelho deste template no dia em que os dois foram desacoplados.

## 2. Antes de começar (por cliente novo)

Para cada cliente novo, decida antes de criar qualquer conta:

1. **Nome do repositório** — sugestão: `<cliente>_production` (mesmo padrão do primeiro
   cliente), para manter os nomes de projeto consistentes entre GitHub, Vercel e Railway.
2. **Domínio** do cliente (apex + `api.<domínio>`).
3. Um repositório novo e vazio no GitHub (privado), criado a partir deste template — **não**
   reative os workflows/secrets deste repositório template sem revisar; crie as secrets do zero
   no repo do cliente novo.

## 3. Provisionamento passo a passo, por provedor

Nada aqui usa git push/CI para disparar deploy automaticamente — **nenhum dos dois projetos
(Vercel e Railway) fica conectado ao GitHub por push**. O CI do GitHub Actions só valida
(build/lint/test/e2e/integração); o deploy em si é sempre um comando manual (`vercel --prod` /
`railway up`) depois que o CI está verde. Não existe deploy automático por push nesta stack —
isso é intencional, não um esquecimento.

### 3.1 GitHub

- Criar o repositório privado a partir deste template (histórico limpo).
- Cadastrar as secrets do Actions (`Settings → Secrets and variables → Actions`), usadas pelo
  workflow `.github/workflows/backup-database.yml`:
  - `PROD_DATABASE_URL` — connection string do Neon do cliente.
  - `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`, `BACKUP_R2_BUCKET`,
    `BACKUP_R2_ENDPOINT` — token e bucket R2 **dedicados a backup**, escopo mínimo (só esse
    bucket).
- `.github/workflows/ci.yml` não precisa de nenhuma secret (usa Postgres efêmero em serviço
  Docker) — funciona assim que o repo existe.
- Nunca commitar nenhum valor de secret no código, em `.env` versionado, nem colar em chat.

### 3.2 Neon (PostgreSQL)

- Criar um projeto Neon novo (região UE se o cliente for europeu, como o primeiro).
- Obter a connection string **pooled** — é essa que vai virar `DATABASE_URL`.
- Aplicar as migrations antes do primeiro deploy da API:
  ```bash
  npm exec --workspace=apps/api -- prisma migrate deploy
  ```
- Point-in-time recovery do Neon cobre só recuperação de curto prazo — o backup diário real é o
  workflow do GitHub Actions (R2), não o Neon PITR sozinho.

### 3.3 Railway (API)

- Criar um projeto novo, nome sugerido `<cliente>_production`.
- Criar o serviço a partir do Dockerfile em `apps/api/Dockerfile` (builder Docker, não
  Nixpacks).
- Cadastrar **todas** as variáveis de ambiente da API (lista completa em
  `apps/api/.env.example`, mais `DATABASE_URL` da raiz):
  `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SECONDS`, `AUTH_REFRESH_TTL_SECONDS`,
  `AUTH_REMEMBER_REFRESH_TTL_SECONDS`, `MFA_ENCRYPTION_KEY`, `APP_CORS_ORIGINS`,
  `APP_PUBLIC_URL`, `API_PUBLIC_URL`, `ENABLE_API_DOCS=false`, `TRUST_PROXY`,
  `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`,
  `STORAGE_PROVIDER`, `STORAGE_ACCOUNT_ID`, `STORAGE_ACCESS_KEY_ID`,
  `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET_NAME`, `STORAGE_ENDPOINT`,
  `STORAGE_JURISDICTION`, `SENTRY_DSN`, `DATABASE_URL`.
  `JWT_ACCESS_SECRET` e `MFA_ENCRYPTION_KEY` precisam ser strings aleatórias independentes de
  pelo menos 32 caracteres — nunca reaproveitar as de outro cliente.
- Configurar o domínio customizado `api.<domínio-do-cliente>` e confirmar o health check em
  `/api/health`.
- Deploy manual: `railway up --service api --environment production --ci` (rodar a partir da
  raiz do repo).

### 3.4 Vercel (frontend)

- Criar um projeto novo a partir da pasta `apps/web`.
- Variáveis de ambiente: `VITE_API_URL` (ex.: `https://api.<domínio-do-cliente>/api`),
  `VITE_SENTRY_DSN` (opcional).
- **⚠️ Adaptar `apps/web/vercel.json` por cliente** — hoje ele tem placeholders
  (`example.com`/`api.example.com`):
  - o `Content-Security-Policy` (`img-src`, `connect-src`) apontando para
    `https://api.example.com`;
  - os redirects de `www`/`app` para `example.com`.
  Isso **tem que virar o domínio do cliente novo**, senão fotos de perfil e chamadas à API
  quebram silenciosamente (ver seção 5).
- Deploy manual, de dentro de `apps/web`: `vercel --prod --yes`.

### 3.5 Cloudflare

- DNS do domínio do cliente (apex → Vercel, `api` → Railway).
- Bucket R2 dedicado para fotos de perfil (`STORAGE_*` acima) — privado, nunca público.
- Bucket R2 **separado** dedicado a backups, com token próprio de escopo mínimo (nunca reusar o
  token/bucket de fotos para backup, nem vice-versa).

### 3.6 Resend (e-mail transacional)

- Verificar o domínio de e-mail do cliente.
- Gerar uma chave de API de produção dedicada (não reaproveitar a de outro cliente).
- `EMAIL_PROVIDER=resend`, `EMAIL_FROM_ADDRESS` num domínio verificado, `EMAIL_FROM_NAME` com o
  nome do negócio do cliente.

### 3.7 Sentry

- Um projeto (ou dois: API e web) dedicado ao cliente novo.
- DSNs em `SENTRY_DSN` (Railway) e `VITE_SENTRY_DSN` (Vercel).

## 4. Checklist de primeira execução

1. Migrations aplicadas (`prisma migrate deploy`).
2. Bootstrap do master (só uma vez, variáveis `MASTER_*` temporárias, depois remover):
   ```bash
   npm run bootstrap:master --workspace=apps/api
   ```
3. Verificar credenciais do bucket de fotos sem gravar nada:
   ```bash
   npm run storage:check --workspace=apps/api
   ```
4. Testar o envio de e-mail (registro de um cliente de teste, depois apagar essa conta de
   teste — nunca deixar contas de teste misturadas com dados reais).
5. Ativar MFA na conta do master real assim que possível, guardar os códigos de recuperação
   fora do sistema.
6. Confirmar que o workflow `Database backup` está **ativo** (habilitado) no repositório do
   cliente novo — ele vem desabilitado por padrão neste template.
7. Rodar `npm run verify` (build + lint + testes + e2e) antes do primeiro deploy real.

## 5. ⚠️ Pontos de extrema atenção

Lições de incidentes reais já vividos com o primeiro cliente — todas já corrigidas no
código deste template, mas a causa raiz pode voltar se um passo de configuração for esquecido
num cliente novo:

- **CSP (`img-src`/`connect-src` em `vercel.json`) tem que apontar para o domínio do cliente
  novo.** Copiar o `vercel.json` sem trocar o domínio quebra silenciosamente fotos de perfil e
  chamadas à API — sem erro nenhum visível em `curl`, só em navegador real (CSP não é aplicado
  em dev local via proxy Vite nem em `curl`).
- **`img-src` precisa incluir `blob:`.** O editor de avatar usa
  `URL.createObjectURL()` para pré-visualizar a imagem antes do upload; sem `blob:` no CSP, a
  pré-visualização falha silenciosamente e o upload salva uma imagem em branco/preta — sem
  nenhum erro do lado do servidor (todas as validações passam, porque o arquivo gerado é
  tecnicamente válido).
- **`APP_PUBLIC_URL` / `Domain` do cookie CSRF / `APP_CORS_ORIGINS` têm que bater exatamente
  com o domínio real do cliente.** Divergência aqui quebra login e proteção CSRF entre
  subdomínios, de um jeito que só aparece em navegador (CORS/cookies não são simulados por
  `curl`).
- **Nunca testar login com senha errada contra uma conta real de cliente**, nem para "só
  verificar se a rota responde". Já aconteceu nesta sessão: 5 tentativas erradas bloqueiam a
  conta por 15 minutos, e testar isso contra dados reais afeta o cliente de verdade. Para
  smoke-test pós-deploy, usar sempre uma rota pública "segura" (ex.: `POST
  /api/auth/confirm-email` com um token inválido — devolve erro previsível, não toca em conta
  nenhuma).
- **Nunca fazer deploy sem o CI estar verde.** `test:integration` roda contra um Postgres real
  em container — é o gate antes de qualquer `vercel --prod`/`railway up`.
- **Segredos nunca em chat, nunca commitados.** Sempre inseridos direto no painel do provedor
  (GitHub Secrets, Railway Variables, Vercel Environment Variables).
- **Cuidado redobrado com `prisma migrate deploy` contra produção** — sempre com um backup
  recente confirmado antes. Nunca usar `prisma migrate reset` em produção.
- **Bloqueio de login após 5 tentativas erradas (15 min) é comportamento esperado de
  segurança, não bug** — antes de "corrigir", reconstruir a linha do tempo pelos
  `audit_logs`.
- **Testar a restauração do backup pelo menos uma vez por cliente novo**, não só confiar que o
  workflow roda.
- **Nunca `git push --force` nem `reset --hard` nesses repositórios** sem confirmar
  explicitamente com quem pediu.
- O service worker (PWA) usa `virtual:pwa-register` (ver `apps/web/src/lib/
  register-service-worker.ts`) para atualizar sozinho com segurança — se esse arquivo for
  reescrito manualmente no futuro, manter esse import; a alternativa "simples" (sem ele) não
  detecta atualizações de forma confiável e exige o usuário limpar cache manualmente para
  receber correções de segurança.

## 6. Rotina do dia a dia

- Fluxo de deploy: commit → push → aguardar o workflow `CI` do GitHub Actions ficar verde →
  `vercel --prod --yes` (de `apps/web`) e/ou `railway up --service api --environment
  production --ci` (da raiz), conforme o que mudou.
- Logs: Railway (`railway logs` ou painel), Vercel (painel → Deployments → Logs), Sentry (erros
  não tratados de API e web).
- Rollback: aplicação — reimplantar a imagem/build anterior; banco — restaurar de um backup
  verificado, nunca editar histórico de migration.

## 7. Onde estão as credenciais mestras

Só indicando onde procurar — nenhum valor deve estar neste documento nem em nenhum outro
arquivo versionado:

- GitHub: `Settings → Secrets and variables → Actions` do repositório do cliente.
- Railway: `Service → Variables`.
- Vercel: `Project Settings → Environment Variables`.
- Cloudflare: painel do R2 (tokens de API) e DNS.
- Resend: painel → API Keys.
- Neon: painel → Connection Details.
- Senha/segredos mestres do cliente: gerenciador de senhas do responsável pela conta — nunca em
  texto plano em nenhum lugar deste projeto.
