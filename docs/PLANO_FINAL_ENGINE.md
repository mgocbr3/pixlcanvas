# PLANO DE FINALIZAÇÃO DA ENGINE (PIXLCANVAS)

Data: 12/02/2026

## 1. Situação atual (baseline real)

- Build da engine: ✅ OK (`npm --prefix engine run build`)
- Testes automatizados: ✅ OK (`1605 passing`, `2 pending`, `0 failing`)
- Artefatos principais gerados: ✅ `playcanvas.js`, `playcanvas.min.js`, `playcanvas.min.mjs`, `playcanvas.d.ts`
- Hosting estático da engine: 🟡 base pronta no repo (script + guia), falta deploy efetivo no domínio

## 2. Definição de pronto (Definition of Done)

A engine será considerada “finalizada para uso de plataforma” quando:

1. Build e testes rodarem de forma reproduzível em CI/CD
2. Artefato versionado/publicado automaticamente por release
3. `engine.pixlland.com/playcanvas.js` estiver online com HTTPS e cache adequado
4. Backend estiver apontando para engine hospedada em produção
5. Houver smoke tests cobrindo bootstrap do editor com a engine hospedada
6. Houver rollback simples para versão anterior da engine

## 3. O que já está pronto

- Pipeline local de build funcional
- Test suite extensa e estável
- Script de preparação para hosting (`npm run engine:hosting:prepare`)
- Documento de deploy de engine (`ENGINE_HOSTING.md`)
- Suporte em config para URL custom da engine (`PIXLLAND_ENGINE_URL`)

## 4. O que falta

### M1 — Publicação da engine (prioridade alta)
- [ ] Criar projeto de hosting estático (Cloudflare Pages recomendado)
- [ ] Configurar build command: `npm run engine:hosting:prepare`
- [ ] Configurar output dir: `engine-hosting`
- [ ] Configurar DNS CNAME `engine` -> `<projeto>.pages.dev`
- [ ] Validar `https://engine.pixlland.com/playcanvas.js` com HTTP 200

### M2 — Integração de produção
- [ ] Atualizar env de produção: `PIXLLAND_ENGINE_URL=https://engine.pixlland.com/playcanvas.js`
- [ ] Validar editor carregando a engine remota
- [ ] Validar cache busting/versionamento (query/hash/release path)

### M3 — CI/CD da engine
- [ ] Workflow CI para `engine build + test`
- [ ] Publicação automática de artefatos para hosting em push na `main` (ou release tag)
- [ ] Gate de qualidade: falhar merge se build/test falhar

### M4 — Qualidade operacional
- [ ] Smoke test de runtime do editor usando engine hospedada
- [ ] Monitorar disponibilidade (`playcanvas.js` uptime)
- [ ] Plano de rollback da engine (última versão estável)

### M5 — Segurança e governança
- [ ] Política de releases (semver/changelog)
- [ ] Pin de versão da engine no backend/editor
- [ ] Revisão periódica de dependências críticas

## 5. Sequência recomendada (execução)

1. Fechar M1 (deploy real em `engine.pixlland.com`)
2. Fechar M2 (apontar backend para domínio)
3. Fechar M3 (automatizar CI/CD)
4. Fechar M4 e M5 (confiabilidade + governança)

## 6. Próximo passo imediato (agora)

- Executar M1: criar projeto no Cloudflare Pages e publicar `engine-hosting`
- Após publicar, validar:
  - `https://engine.pixlland.com/playcanvas.js`
  - carregamento do editor com engine externa

## 7. Critério de aceite final

- Editor abre sem fallback local e usando engine remota
- Não há regressão em testes de engine
- Deploy da engine é repetível e automatizado
- Existe rollback documentado
