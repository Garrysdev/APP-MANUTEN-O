---
data: 2026-06-26
projeto: RG Maintenance (CMMS)
tags: [diario, rg-maintenance, agente-noturno, google-tasks]
sessao: agente noturno (01h-07h)
---

# 2026-06-26 — Sessão noturna: tarefas CLAUDE_RG MAINTENANCE

Execução autónoma das tarefas da lista Google Tasks **CLAUDE_RG MAINTENANCE** (18 tarefas).
Código em `G:\rg-maintenance` (Next.js App Router + Firebase). Build validado a cada tarefa.

## ✅ Tarefas concluídas (6) — marcadas no Google Tasks

### 01. Cores por atraso (verde/laranja/vermelho)
- `src/lib/utils.ts` — `taskDelayLevel(dueDate, status)` + `DELAY_CLASSES`/`DELAY_LABELS`
  - verde = no prazo; laranja = atraso ≤1 semana; vermelho = atraso >1 semana
- `src/app/dashboard/tasks/TasksClient.tsx` — coluna Prazo com badge colorido por nível

### 06. Comprimir fotos antes do Firebase
- `src/lib/image.ts` — `compressImage()` (canvas, máx 1600px, JPEG 0.72; ignora GIF)
- `TaskDetailClient.tsx` — `handlePhotoAdd` agora **comprime** em vez de rejeitar fotos grandes

### 12. Filtros no histórico (visualização + exportação)
- `src/app/dashboard/history/HistoryClient.tsx` (novo) — filtros por técnico, equipamento, período (de/até)
- Filtros afetam a lista visível **e** a exportação CSV/Excel/impressão
- `history/page.tsx` simplificado (server → passa dados ao client)

### 14. Relatórios incluem todos os tipos de tarefa
- `src/app/dashboard/reports/page.tsx` — nova secção "Tarefas por Tipo" (breakdown) + tabela "Tarefas Pendentes — Todos os Tipos" (coluna Tipo). Antes só mostrava preventivas.

### 15. Ordenar tabelas por coluna
- `src/lib/useTableSort.tsx` (novo) — hook `useTableSort` + componente `SortableTh` (reutilizável)
- Aplicado à tabela de Tarefas (`TasksClient.tsx`). Planos usam cards (sem colunas).

### 16. Dashboard de Manutenção ordenável + coluna técnico
- `src/app/dashboard/DashboardTasksTable.tsx` (novo) — tabela "Geral de Tarefas" ordenável + **coluna Técnico** + cor de atraso no prazo
- `dashboard/page.tsx` — busca `listUsers`, usa o novo componente

### 07. Permitir capturar fotos (não só importar)
- `assets/AssetsClient.tsx` — input `accept="image/jpeg,…"` → `accept="image/*"` (no mobile passa a oferecer câmara) + compressão `compressImage` no upload
- `profile/ProfileClient.tsx` — avatar comprimido (`compressImage(…, 512)`); já tinha `accept="image/*"`
- Registo de trabalho já tinha captura (input com `capture`). Reforça também a tarefa 06.

## 🔶 Parciais / a confirmar (não marcadas)

- **09. Materiais da BD Stocks:** o registo de trabalho **já** bebe do stock (stock picker em `TaskDetailClient`). Falta ligar o campo "Materiais a utilizar" na *criação* de tarefa (`TasksClient`) ao stock. Parcial.
- **11. Câmara vs Galeria "fazem o mesmo":** tecnicamente são diferentes no mobile (`capture="environment"` vs `multiple`) — só parecem iguais no desktop. Remover prejudicaria técnicos no terreno (PWA). **Aguarda decisão do Rui.**

## ⏳ Por fazer (00–10, 13 + restantes)

00 (meta julho), 02 (import/export Excel no Plano), 03 (criar tarefas no Plano), 04 (periodicidade ao criar tipo Plano), 05 (campos obrigatórios), 07 (capturar fotos), 08 (bug: não grava equipamentos novos), 10 (botões Iniciar/Concluir), 13 (perfil técnico com foto→ícone).

**Nota:** o limite de contexto da sessão obrigou a parar nas 6. As restantes ficam para a próxima sessão noturna. Várias (08, 10) precisam de teste com Firebase ao vivo.

**Estado:** ✅ **7/18 concluídas** e validadas (build verde); 2 parciais documentadas.

## Atualização (retoma) — tarefa 07 adicionada

Após "retoma" do Rui: implementada a tarefa **07** (ver acima). Total **7 concluídas**: 01, 06, 07, 12, 14, 15, 16.
Restantes: 00, 02, 03, 04, 05, 08, 09(parcial), 10, 11(a confirmar), 13. Parar por limite de contexto da sessão — próxima sessão noturna continua.
