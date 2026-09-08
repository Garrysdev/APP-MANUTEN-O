---
tags: [rg-maintenance, decisoes, aprovacoes]
ultima_atualizacao: 2026-07-12
---

# 📋 Log de Decisões & Aprovações

[[../00 - Projeto Overview|← Overview]]

---

## Decisão #001 — 2026-06-08

**Tipo:** Aprovação de conceito e stack técnica
**Estado:** ✅ Aprovado (implicitamente — Rui avançou com o plano)

Análise e expansão da ideia. Stack: Supabase + Next.js + PWA + Vercel.
Modelo de negócio: SaaS com multi-tenancy (RLS).

---

## Decisão #002 — 2026-06-08

**Tipo:** Nome e identidade do produto
**Estado:** ✅ Confirmado pelo Rui

**Nome:** RG Maintenance
**Logo:** Monograma RG azul navy (#1B4F72) fornecido
**Referência de design:** Mockup mobile dark navy fornecido

---

## Decisão #004 — 2026-06-10

**Tipo:** Decisão técnica
**Estado:** ✅ Aplicado

**Descrição:** Projeto de código movido de `G:\MANUTENÇÃO\MANUTENÇÃO\rg-maintenance` para `G:\rg-maintenance`. O caminho original (com acentos e múltiplos níveis) excedia os 260 caracteres do Windows e corrompia a instalação do pacote `next` via npm. O Vault Obsidian permanece no local original — apenas o código foi movido.
**Impacto no cronograma:** nenhum

---

## Decisão #003 — 2026-07-12 (resolvida)

**Tipo:** Domínio e modelo de lançamento
**Estado:** ✅ Decidido pelo Rui

**Modelo de lançamento: USO INTERNO PRIMEIRO.** Usar a app a sério na fábrica SOREB/RG
durante 4–8 semanas (empresa real "UR"), refinar com feedback real e recolher métricas.
Só depois: landing + caso de estudo → Stripe live + InvoiceXpress → primeiros clientes Pro.
Racional: vender com prova social (894 equipamentos / 605 planos geridos) em vez de promessas;
menor risco e sem pressão imediata de compliance/RGPD para terceiros.

**Domínio:** decidir mais tarde — não é urgente na fase interna. Registar apenas quando
se aproximar o lançamento público (candidatos: rgmaintenance.pt preferencial por reforçar
"local + português", ou rgmaintenance.com para expansão).

**Impacto no cronograma:** Fase 7 (SaaS) adiada para depois da validação interna; foco imediato
passa a ser pôr a app em produção real na fábrica.

---

## Decisão #010 — 2026-06 (registada retroativamente na auditoria de 2026-07-12)

**Tipo:** Decisão técnica
**Estado:** ✅ Aplicado

**Descrição:** Stack de base de dados mudou de Supabase para **Firebase** (Auth + Firestore + Admin SDK). As regras `firestore.rules` implementam o multi-tenancy por `companyId` (leituras scoped, escritas só via Admin SDK no servidor). Storage de fotos via **Cloudinary** (partilhado com EneaSpirit). Esta decisão estava referida no Plano de Implementação mas nunca tinha sido registada aqui.
**Impacto no cronograma:** nenhum

---

## Decisão #011 — 2026-07-12

**Tipo:** Decisão técnica / segurança
**Estado:** ✅ Aplicado (auditoria)

**Descrição:** Correções da auditoria geral: (1) ficheiro JSON da service account Firebase Admin removido da raiz do projeto (redundante — a app lê do `.env.local`) — **a chave deve ser rotada na consola Firebase pelo Rui**; (2) `.gitignore` reforçado (`*adminsdk*.json`, `*service-account*.json`, `scratch/`); (3) repositório git inicializado com commit inicial (135 ficheiros, verificado sem segredos).
**Impacto no cronograma:** nenhum

---

## Template para nova decisão

```markdown
## Decisão #00X — YYYY-MM-DD
**Tipo:** [Aprovação de fase / Decisão técnica / Decisão de negócio]
**Estado:** [✅ Aprovado / ⏳ Aguarda / ❌ Rejeitado]
**Descrição:** ...
**Impacto no cronograma:** [nenhum / +X semanas]
```
