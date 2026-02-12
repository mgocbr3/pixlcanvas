# STATUS ATUAL DA PLATAFORMA PIXLCANVAS

Data de referência: 12/02/2026

---

## 1) Resumo executivo

Este repositório já roda um stack funcional de Editor + API + Realtime localmente, com integração ao Supabase e fallback para desenvolvimento.

Estado atual (visão macro):

- Frontend Editor: **funcional em desenvolvimento**
- Backend API (Fastify): **funcional para fluxo MVP**
- Realtime (ShareDB + WS relay/messenger): **funcional**
- Banco de dados (Supabase MVP schema): **definido e utilizável**
- Skybox padrão automático em novas cenas: **implementado**
- Deploy de engine em subdomínio (`engine.pixlland.com`): **base pronta**, faltando configurar provedor + DNS
- Produção (hardening, monitoramento, CI/CD, backup, segurança): **parcial / pendente**

---

## 2) Arquitetura geral

### 2.1 Componentes principais

- `editor/`
  - Frontend do PlayCanvas Editor
  - Build com Rollup + Sass
  - Em dev, agora sobe junto com backend/proxy/ws via script `develop`

- `pixlland-api/`
  - API REST em Fastify
  - Integração com Supabase (DB, Storage, Auth)
  - Rota dinâmica `/editor/config.js` para bootstrap do editor

- `pixlland-api/scripts/ws-servers.mjs`
  - Servidores WebSocket para realtime/relay/messenger
  - Seed e manutenção de docs ShareDB
  - Lógica de defaults de cena/projeto

- `engine/`
  - Código e build da engine PlayCanvas
  - Artefatos em `engine/build/`

- `engine-hosting/` (gerado)
  - Artefatos estáticos para publicar a engine em subdomínio
  - Gerado por `node scripts/prepare-engine-hosting.mjs`

### 2.2 Fluxo de execução (dev)

1. `editor/package.json` script `develop` inicia:
   - watch CSS do editor
   - watch JS do editor
   - stack completo da API (`pixlland-api editor:full`)
2. `editor:full` inicia:
   - backend API (`dev`)
   - proxy de editor (`editor:dev`)
   - websockets (`ws:dev`)
3. Navegador usa `http://localhost:3487` (proxy), que serve:
   - arquivos estáticos do editor
   - `/api/*` proxied para backend
   - `/editor/config.js` proxied para backend

---

## 3) Frontend (Editor)

### 3.1 Situação atual

✅ Pronto/funcionando:

- Build e watch de CSS/JS
- Carregamento de `config-loader` para bootstrap
- Inicialização via `editor-root`
- Integração com API/WS via config runtime
- Script unificado de desenvolvimento (`develop`) com backend acoplado

✅ Melhorias recentes:

- `config-loader` não bloqueia localhost sem token
- Envio de `Authorization` apenas quando token existe
- Menos ocorrência de “tela azul” por stack incompleto

⚠️ Observações:

- Em ambiente local, a experiência depende do proxy em `3487` estar ativo
- Se abrir somente frontend estático sem API/proxy/ws, pode quebrar bootstrap

---

## 4) Backend (Fastify API)

Arquivo principal: `pixlland-api/src/server.ts`

### 4.1 Situação atual

✅ Pronto/funcionando:

- CORS configurável
- JWT plugin registrado
- Upload multipart
- Rotas de health, config, projects, scenes, assets, users, editor-misc

### 4.2 Endpoints implementados (estado atual)

#### Health
- `GET /health`

#### Editor bootstrap/config
- `GET /editor/config.js`

#### Projects
- `GET /projects` (auth)
- `POST /projects` (auth)
- `GET /projects/:projectId`
- `GET /projects/:projectId/assets`
- `GET /projects/:projectId/scenes`

#### Scenes
- `GET /scenes` (auth)
- `POST /scenes` (auth)
- `GET /scenes/:sceneId`

#### Assets
- `GET /assets` (auth)
- `POST /assets` (auth)
- `PUT /assets/:assetId` (auth)
- `GET /assets/:assetId`
- `GET /assets/:assetId/thumbnail/:size`
- `GET /assets/:assetId/thumbnail`
- `GET /assets/:assetId/file/:filename`
- `GET /assets/:assetId/download`

#### Users
- `GET /users/:id`
- `GET /users/:id/thumbnail`
- `GET /users/:id/projects`

#### Editor misc / stubs
- tips/opened/events/branch
- store endpoints (stubs)
- `GET /howdoi`

### 4.3 Lacunas de backend (a fazer)

❌ Ainda faltando para produção/comercial:

- Cobertura completa das rotas esperadas do ecossistema Editor (branches avançado, checkpoints, merge/diff, jobs completos, apps/build pipeline)
- Padronização de erros e contratos (schemas OpenAPI)
- Rate limit / proteção de abuso
- Auditoria e telemetria estruturada
- Testes automatizados de integração de rotas críticas

---

## 5) Autenticação e autorização

Arquivo principal: `pixlland-api/src/lib/auth.ts`

### 5.1 Situação atual

✅ Pronto/funcionando:

- Validação de token via Supabase (`auth.getUser`)
- Fallback para token expirado decodificando payload e validando user por admin API
- `getUserId` injetado na request

✅ Modo dev:

- `PIXLLAND_DEV_AUTH_BYPASS=1`
- `PIXLLAND_DEV_USER_ID=<uuid>`
- Permite abrir editor local sem passar token manualmente

⚠️ Risco/atenção:

- `DEV_AUTH_BYPASS` deve ser **sempre desativado em produção**

---

## 6) Realtime (ShareDB + WebSockets)

Arquivo principal: `pixlland-api/scripts/ws-servers.mjs`

### 6.1 Situação atual

✅ Pronto/funcionando:

- Porta 3001: realtime
- Porta 3002: relay
- Porta 3003: messenger
- Seed de docs de `scenes` e `assets` no startup
- Criação on-demand de docs de `settings` e `user_data`
- Merge de defaults quando doc já existe e está incompleto

✅ Skybox default em novas cenas:

- Feature ativa por padrão (`PIXLLAND_DEFAULT_SKYBOX != 0`)
- Cria/garante asset `Pixlland Default Skybox` por projeto/branch
- Faz upload de `engine/examples/assets/cubemaps/helipad.dds` para Supabase Storage
- Preenche `settings.render.skybox` quando ausente

### 6.2 Lacunas de realtime (a fazer)

❌ Ainda faltando:

- Observabilidade mais robusta (métricas, dashboards, alertas)
- Estratégia de escalabilidade horizontal com sticky sessions/adapter
- Resiliência de reconexão e backpressure sob carga real de múltiplos usuários
- Testes de concorrência/consistência OT em cenários complexos

---

## 7) Banco de dados (Supabase)

Arquivo base: `pixlland-api/supabase_mvp.sql`

### 7.1 Situação atual

✅ Pronto/funcionando:

- Tabelas MVP: `users_profile`, `projects`, `project_collaborators`, `branches`, `scenes`, `assets`, `jobs`
- Relacionamentos principais
- RLS habilitado
- Policies definidas por ownership/collaboration

⚠️ Ponto importante:

- Algumas evoluções de schema podem ser necessárias conforme funcionalidades avançadas do editor forem habilitadas

### 7.2 Storage

✅ Buckets previstos:

- `assets`
- `projects`

✅ Uso atual:

- Upload/download de arquivos de assets
- Suporte ao arquivo de skybox default via storage path por projeto/branch/asset

---

## 8) Engine e hosting

### 8.1 Situação atual

✅ Pronto:

- Build da engine disponível em `engine/build/`
- Script de preparação para hosting estático criado:
  - `scripts/prepare-engine-hosting.mjs`
  - comando: `npm run engine:hosting:prepare`
- Documento de deploy criado: `ENGINE_HOSTING.md`

### 8.2 Modelo recomendado

✅ Recomendado (já documentado):

- Publicar engine em hosting estático (Cloudflare Pages)
- Domínio final: `https://engine.pixlland.com/playcanvas.js`
- Config API: `PIXLLAND_ENGINE_URL=https://engine.pixlland.com/playcanvas.js`

### 8.3 O que ainda falta para concluir esse item

❌ Pendente:

- Criar projeto no provedor (Cloudflare Pages)
- Configurar build command/output
- Configurar CNAME `engine` no DNS da Hostinger
- Validar SSL ativo e endpoint `200 OK`

---

## 9) Infra, servidor e ambientes

### 9.1 Desenvolvimento local

✅ Atualmente funcional com:

- Node.js 22.x
- Editor + API + WS em conjunto
- Supabase remoto como backend de dados/storage

### 9.2 Produção

🟡 Parcial:

- Arquitetura existe, mas falta hardening de operação

❌ Itens pendentes de produção:

- Deploy formal dos serviços (API/proxy/ws) com supervisor (PM2/systemd/Docker)
- Reverse proxy com HTTPS e domínio(s) definitivos
- Healthchecks e reinício automático
- Logs centralizados
- Backup e estratégia de recuperação
- Ambientes separados (dev/stage/prod)

---

## 10) Segurança

### 10.1 Estado atual

✅ Base existente:

- JWT via Supabase
- RLS no banco
- CORS configurável

⚠️ Ações urgentes recomendadas:

- Rotacionar chaves que já foram expostas em conversas/prints
- Garantir que `.env` nunca seja commitado
- Revisar CORS para domínios específicos em produção
- Desativar `PIXLLAND_DEV_AUTH_BYPASS` em produção

---

## 11) Checklist consolidado (Pronto x Faltando)

## ✅ Já pronto

- Editor build/watch funcionando
- Stack local unificada via `editor develop`
- API Fastify com rotas MVP
- Integração Supabase (DB + Storage + Auth)
- Realtime ShareDB + relay + messenger
- Bootstrap por `/editor/config.js`
- Modo dev sem token manual (bypass controlado por env)
- Skybox default automático em cenas novas
- Base para hosting de engine em subdomínio

## 🟡 Parcial

- Cobertura de endpoints do editor além do MVP
- Estrutura de monitoramento e operações
- Fluxo de deploy contínuo

## ❌ Ainda faltando

- Produção hardening (TLS, observabilidade, escalabilidade)
- CI/CD completo (build/test/deploy automáticos)
- Testes E2E confiáveis do fluxo editor completo
- Deploy efetivo de `engine.pixlland.com`
- Catálogo completo de recursos não-MVP (merge/diff/apps/jobs avançados/store real)

---

## 12) Próximos passos recomendados (ordem sugerida)

### Prioridade alta (curto prazo)

1. Finalizar deploy do engine em `engine.pixlland.com`
2. Rotacionar credenciais Supabase e atualizar secrets
3. Padronizar `.env` de dev/stage/prod e validar startup sem erro
4. Criar smoke test do fluxo crítico:
   - abrir editor
   - carregar projeto/cena
   - criar asset
   - salvar/propagar realtime

### Prioridade média

5. Subir API/proxy/ws em ambiente estável com HTTPS
6. Implementar observabilidade mínima (logs e health dashboards)
7. Adicionar testes de integração de rotas de assets/scenes/projects

### Prioridade roadmap

8. Fechar endpoints avançados do ecossistema editor
9. Estruturar pipeline de builds/jobs
10. Evoluir para cenário multiusuário com maior escala e confiabilidade

---

## 13) Comandos úteis

### Subir stack local completa

- `cd editor && npm run develop`

### Preparar pacote estático da engine para hosting

- `npm run engine:hosting:prepare`

### Verificar saúde da API

- `curl http://localhost:8788/health`

---

## 14) Observações finais

A plataforma já saiu do estágio de “prova de conceito” e está em um **MVP técnico operacional** para desenvolvimento local com Supabase. O maior gap hoje não é “fazer funcionar”, e sim **endurecer operação de produção** (deploy, monitoramento, segurança e cobertura de funcionalidades avançadas do Editor).
