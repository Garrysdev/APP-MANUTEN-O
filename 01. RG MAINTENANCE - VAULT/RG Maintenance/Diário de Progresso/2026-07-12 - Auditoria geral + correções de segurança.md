---
data: 2026-07-12
projeto: RG Maintenance (CMMS)
tags: [diario, rg-maintenance, auditoria, seguranca, git]
sessao: diurna (com Rui presente)
---

# 2026-07-12 — Auditoria geral + correções de segurança

Rui pediu auditoria geral (planos, monetização, cronograma, segurança, SWOT) — mesma metodologia
usada no EneaSpirit. Report completo em `REPORTS/REPORT-AUDITORIA-GERAL-RGMAINTENANCE-2026-07-12.html`.

## Conclusões principais
- **App muito à frente dos documentos**: live no Vercel (HTTP 200), 14 módulos de dashboard,
  Stripe test mode, PWA, dados reais importados (894 equipamentos + 605 planos) — mas o cronograma
  dizia "semana 1 de 12" e o log de decisões estava parado desde 10-06.
- **Bloqueio de monetização = Decisão #003** (interno vs SaaS + domínio), aberta desde 08-06.
  Recomendação dada: uso interno primeiro na fábrica → caso de estudo → lançamento SaaS.
- **Achado crítico de segurança**: JSON da service account Firebase Admin na raiz do projeto,
  fora do .gitignore.
- Positivo: `firestore.rules` multi-tenant bem desenhadas; sem segredos hardcoded no src.

## Correções aplicadas (aprovadas pelo Rui)
1. `.gitignore` reforçado: `*adminsdk*.json`, `*service-account*.json`, `scratch/`
2. JSON da service account **apagado** da raiz (verificado antes: nenhum código o referencia —
   a app lê `FIREBASE_PRIVATE_KEY` do `.env.local`)
3. `git init` + commit inicial (135 ficheiros; verificado que `.env.local` e chaves ficaram fora;
   `.env.example`/`.env.local.example` só têm placeholders)
4. Cronograma reconciliado com a realidade (fases 1–3 concluídas, 4–5 construídas por validar,
   semana 5 de 12)
5. Decisões #010 (Firebase) e #011 (correções de auditoria) registadas no Log

## ⏳ Pendente do Rui
- **Rotar a chave da service account** na consola Firebase (Project Settings → Service accounts →
  Generate new private key invalida... nota: gerar nova NÃO invalida a antiga — é preciso apagar a
  key antiga em IAM → Service Accounts → Keys) e atualizar `FIREBASE_PRIVATE_KEY` no `.env.local`
  e nas env vars do Vercel
- Decisão #003 (interno vs SaaS + domínio)
- Clarificar autorização de uso dos dados SOREB/RG no produto
- Pendências de 26-06 que se mantêm: validar importação no browser; importar para a empresa real
  "UR"; decidir os 35 planos órfãos
