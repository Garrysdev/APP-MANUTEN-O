---
tags: [maintenanceos, cronograma, tracking]
data_inicio_planeada: 2026-06-08
semana_atual: 5
ultima_atualizacao: 2026-07-12
---

# 📅 Cronograma — Estado em Tempo Real

[[00 - Projeto Overview|← Overview]]

> Documento detalhado: `G:\MANUTENÇÃO\MANUTENÇÃO\RG Maintenance_Cronograma_Detalhado.docx`
> **Projeto de código agora em:** `G:\rg-maintenance` (movido de `G:\MANUTENÇÃO\MANUTENÇÃO\rg-maintenance` por limite de path do Windows)
> ⚠️ Reconciliado com a realidade na auditoria de 2026-07-12 — o desenvolvimento avançou muito
> mais depressa do que este documento registava (estava parado em "semana 1").

## Semana Atual: 5 de 12

**Data de início planeada:** 2026-06-08  
**Data de fim prevista:** 2026-08-30  
**Estado geral:** 🟢 App live no Vercel (rg-maintenance.vercel.app) com 14 módulos de dashboard, PWA, Stripe em test mode e dados reais da fábrica importados (894 equipamentos + 605 planos). Bloqueio principal: **Decisão #003** (interno vs SaaS + domínio).

---

## Gates de Aprovação (Rui)

| Gate | Semana | O que o Rui testa | Estado |
|------|--------|-------------------|--------|
| A0 | Sem. 0 | Nome + logo + stack + Fase 0 aprovada | ✅ Concluído¹ |
| A1 | Sem. 2 | URL online + login de teste | ⬜ |
| A2 | Sem. 3 | Registo empresa + convite técnico + isolamento de dados | ⬜ |
| A3 | Sem. 6 | Fluxo gestor completo (criar tarefa, KPIs, histórico) | ⬜ |
| A4 | Sem. 8 | Intervenção no telemóvel ponta a ponta (PWA) | ⬜ |
| A5 | Sem. 9 | PDF com logo + exportação Excel do diário | ⬜ |
| A6 | Sem. 10 | 1 dia de testes com técnico real — sem bugs críticos | ⬜ |
| A7a | Sem. 12 | Subscrição Stripe + fatura | ⬜ |
| A7b | Sem. 12 | Primeiro cliente externo na app | ⬜ |

> **Regra:** Claude nunca avança para a fase seguinte sem confirmação escrita do Rui no gate anterior.
>
> ¹ Nome, logo e stack confirmados; domínio e modelo SaaS/interno (ver [[Decisões/Log de Decisões|Decisão #003]]) continuam em aberto — não bloqueiam a Fase 1.

---

## Tabela de Fases

| # | Fase | Semanas Planeadas | Semanas Reais | Estado | Desvio |
|---|------|-------------------|---------------|--------|--------|
| 0 | Pré-arranque | Sem. 0 | Sem. 0 | ✅ Concluída | — |
| 1 | Setup & Base | Sem. 1–2 | Sem. 1–2 | ✅ Concluída (deploy Vercel live; git init feito 12-07) | — |
| 2 | Autenticação & Multi-Tenant | Sem. 2–3 | Sem. 2 | ✅ Concluída (Firebase Auth, roles, firestore.rules multi-tenant) | adiantada |
| 3 | Dashboard Gestor | Sem. 3–6 | Sem. 2–3 | ✅ Construída (14 módulos: tasks, assets, calendar, history, stocks, reliability, finance, reports, knowledge, ai, users…) — falta validação formal A3 | adiantada |
| 4 | App Técnico PWA | Sem. 6–8 | Sem. 3 | 🟡 Construída — falta teste ponta-a-ponta no telemóvel (Gate A4) | adiantada |
| 5 | PDF & Diário | Sem. 8–9 | Sem. 3 | 🟡 Relatórios existem — validar PDF com logo + Excel (Gate A5) | adiantada |
| 6 | Testes & Polimento | Sem. 9–10 | — | 🔵 Parcial (jest configurado, 1 suite; e2e scripts existem) — cobertura insuficiente | — |
| 7 | SaaS & Lançamento | Sem. 10–12 | — | ⬜ Bloqueada pela Decisão #003 (Stripe já integrado em test mode) | — |

---

## Arquitetura BD — Lógica de Cliente

**Modelo escolhido: Multi-Tenant com RLS (Row Level Security)**

- **Uma única base de dados Supabase** partilhada entre todos os clientes
- Cada empresa tem um `company_id` único
- Todas as tabelas têm coluna `company_id` + RLS policy (cada empresa só vê os seus dados)
- Ficheiros (fotos/PDFs) guardados em `companies/{company_id}/...` no Supabase Storage
- **Zero custo adicional** por cliente novo — escalável automaticamente

### Tabelas principais

| Tabela | Função |
|--------|--------|
| `companies` | Uma linha por empresa subscrita |
| `users` | Gestores e técnicos (role: manager / technician) |
| `assets` | Equipamentos/máquinas a manter |
| `tasks` | Ordens de trabalho |
| `interventions` | Execuções registadas (start/end timestamps) |
| `materials` | Materiais consumidos por intervenção |
| `photos` | Fotos before/after (URLs Supabase Storage) |

---

## Instruções para Atualização

Quando o Claude concluir uma fase ou gate:
> "Claude, gate A3 aprovado — atualiza o cronograma."

O Claude irá:
1. Atualizar a tabela de fases e gates com estado e semanas reais
2. Calcular desvio
3. Criar entrada no [[Diário de Progresso/|Diário]]
4. Atualizar o dashboard de monitorização
5. Avisar se alguma fase seguinte está em risco
