---
data: 2026-08-23
projeto: RG Maintenance (CMMS)
tags: [diario, rg-maintenance, auditoria, git]
sessao: diurna
---

# 2026-08-23 — Auditoria de funcionalidades (trabalho feito no Antigravity)

Rui pediu auditoria só de leitura ao código de `G:\rg-maintenance` — trabalho recente foi feito
noutro IDE agêntico (Google Antigravity), não registado neste vault. Objetivo: confirmar o estado
real das funcionalidades face ao roadmap de 9 gates e à auditoria anterior de 12/07.

## Método
- `git log` desde 12/07: 78 commits (repo git só existe desde 12/07, criado nessa auditoria).
- Ritmo por semana: picos em S30 (25 commits, ~20-26 jul) e S32 (30 commits, ~3-9 ago); zero na S33.
- `package.json`, árvore de rotas `src/app/`, `firestore.rules`, `.gitignore`/`git ls-files`
  (procura de segredos), `npm run build`, `npx jest`.

## Conclusões principais
- **Código muito à frente do plano escrito**: 18 módulos de dashboard (vs. os módulos originais de
  Fase 3), incluindo áreas não planeadas em junho — consultor IA com RAG, fiabilidade, financeiro,
  conformidade, base de conhecimento, mensagens.
- **Migração Supabase → Firebase concluída** (estava pendente desde a decisão #010 de 10/06): zero
  deps Supabase, `firebase`+`firebase-admin` em uso, `firestore.rules` multi-tenant por `companyId`,
  todas as escritas de cliente bloqueadas (passam por Server Actions com Admin SDK).
- **Build de produção limpo** (`npm run build` exit 0). Único teste unitário (`finance.test.ts`,
  5 testes) passa. Scripts e2e existem mas não correm em CI — cobertura de testes muito abaixo do
  que seria ideal, mas aceitável na fase atual.
- **Sem segredos hardcoded**; `.env.local` e ficheiros de service account fora do git — as correções
  de segurança da auditoria de 12/07 mantiveram-se.
- **Gates A0–A5 do roadmap**: concluídas no código (e A3 largamente ultrapassada em scope). A4
  (Play Store) parcial — PWA/offline-first no código, empacotamento TWA não verificável a partir
  do código. A6 (teste com técnico real) e A7b (1.º cliente/lançamento) são passos humanos/decisões
  de negócio, não código — por confirmar com o Rui.
- Estimativa dada: **~80% de conclusão técnica face ao roadmap original**, em linha com a
  auto-avaliação do Rui ("mais de 75%") — talvez até conservadora do lado do código.

## Pendente a confirmar com o Rui
- Se a chave da service account Firebase foi rotada (pendente desde a auditoria de 12/07 — não
  verificável a partir do código).
- Decisão #003 (interno vs. SaaS + domínio) continua em aberto desde 08-06 — bloqueia A7b.
- Confirmar se o plano Starter (€19) foi descontinuado — só existem `STRIPE_PRICE_PRO` e
  `STRIPE_PRICE_BUSINESS` nas env vars, sem `STRIPE_PRICE_STARTER`.

## Relatório
Artefacto HTML publicado (auditoria de funcionalidades, comparação com REPORT-AUDITORIA-GERAL de
12/07). Nenhum ficheiro de código foi alterado — auditoria só de leitura.
