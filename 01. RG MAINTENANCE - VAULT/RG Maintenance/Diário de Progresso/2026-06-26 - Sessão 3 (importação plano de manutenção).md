---
data: 2026-06-26
projeto: RG Maintenance (CMMS)
tags: [diario, rg-maintenance, importacao, plano-manutencao, excel, firestore]
sessao: diurna (com Rui presente)
---

# 2026-06-26 (Sessão 3) — Importação do cadastro + plano de manutenção (2 Excel reais)

Rui forneceu 2 Excel reais da fábrica (SOREB/RG): `FRMAN09` (registo de intervenções diárias +
cadastro + consumíveis) e `PLMAN01` (Plano de Manutenção Preventiva 2026). Objetivo: importar para o
CMMS e fazer aparecer as tarefas do plano por TAG ao criar uma tarefa tipo "Plano".

## Análise dos ficheiros
- **FRMAN09** (`.xlsb`): CADASTRO_UR (~902 equipamentos), UR (~216 intervenções), CONSUMIVEIS (~248), CÓDIGOS (taxonomia causa/natureza/gravidade), SOREB (reparações externas), KPIs.
- **PLMAN01** (`.xlsx`): folha PM = **~605 tarefas preventivas**, grelha de 52 semanas, **20 periodicidades** (BIANUAL 231, ANUAL 151, TRIMESTRAL 88, SEMANAL 55, TRIANUAL 41…), categoria A/B/C, sufixos `-STP` (externo) e `-legal`.
- Periodicidades confirmadas com o Rui: BIANUAL=2×/ano, BIENAL=2/2 anos, TRIANUAL=3/3 anos.

## Implementação
- `src/types/models.ts` — `Asset` estendido (`area, tag, system, manufacturer, characteristics, criticidadeABC`); `MaintenancePlan` estendido (`periodicidade, periodicidadeLabel, executor, legal, months, tag, area, system`); novos tipos `Periodicidade`/`Executor` + `PERIODICIDADE_LABELS` + `periodicidadeToRecurrence()` (normaliza as 20 → recurrence+valor).
- `scripts/import/parse-manutencao.py` — parser dos 2 Excel (pyxlsb + openpyxl) → `assets.json` (894) + `plans.json` (605). Trata encoding (UTF-8 confirmado íntegro), células de erro (`0x..`), linhas-secção, floats→int. Liga planos a equipamentos por TAG.
- `scripts/import/import-manutencao.mjs` — importador firebase-admin. Dry-run por defeito; `--commit` escreve; `--wipe` limpa antes. IDs determinísticos (hash sha1 de area|tag|name) = idempotente. Batches de 450.
- `src/app/dashboard/tasks/page.tsx` + `TasksClient.tsx` — **feature pedida**: ao criar tarefa tipo "Plano de Manutenção" + escolher equipamento, aparece painel com as tarefas do plano daquela TAG (badges periodicidade/Externo/Legal/meses); clicar pré-preenche título, criticidade, regras de segurança e liga `maintenancePlanId`.
- Fonte dos Excel copiada para `scripts/import/source/` (portabilidade).

## Bug encontrado e corrigido
- 1.ª importação deu **849 equipamentos em vez de 894** — IDs determinísticos colapsavam equipamentos com a mesma TAG/sem-TAG (45 colisões = perda de dados). **Fix:** doc ID passa a incluir hash de `area|tag|name`. Reimportação `--wipe` → 894/894 ✅.

## Verificação (empresa de TESTE `company-rgb-business`)
- **894 equipamentos + 605 planos** gravados. **570 planos ligados** a equipamento por TAG; **35 órfãos** (TAGs sem equipamento no cadastro).
- Spot-check OK: plano `ANUAL-STP` → `anual`/`annual×1`/externo, tag `100 T1 A` → equipamento `TUBAGENS AGUA`.
- `npx tsc --noEmit` e `npm run build` → **verde** (exit 0).

**Estado:** 🟢 Feature completa e testada na empresa de teste. ⏳ Pendente do Rui: (1) validar no browser (localhost:3000, login `rgb@teste.rg`); (2) importar para a empresa **real "UR"** (`rjHNaSUbLm4qTMyKP0oX`); (3) decidir sobre os 35 planos órfãos (criar equipamentos-stub ou deixar).

## Continuação — Página do Plano convertida em tabela com filtros (a pedido do Rui)

Rui pediu que a página do Plano tivesse a mesma lógica de tabela/filtros da de Tarefas, para poder analisar os 605 planos, com editar/apagar linhas.

- `src/app/dashboard/maintenance-plan/MaintenancePlanClient.tsx` — **reescrito** de cards → **tabela** (`useTableSort`/`SortableTh`, mesmo estilo da página de Tarefas). Colunas ordenáveis: Tarefa, Equipamento, TAG, Periodicidade, Executor, Meses, Estado. Por linha: ponto de criticidade + badges Legal/Externo + ativar/desativar + editar + eliminar.
- **Filtros:** pesquisa (tarefa/equipamento/TAG/área/sistema) + dropdowns Periodicidade / Executor / Criticidade / Estado + toggle "Só legais".
- `src/app/dashboard/maintenance-plan/actions.ts` — `parsePlan` estendido para gravar `periodicidade`/`executor`/`legal` e derivar `recurrence`+`recurrenceValue` via `periodicidadeToRecurrence()`. Modal de edição ganhou esses 3 campos.
- `src/app/dashboard/maintenance-plan/page.tsx` — container alargado p/ `max-w-6xl`.
- `npx tsc --noEmit` ✅ + `npm run build` ✅ (Compiled successfully 64s, 10/10 páginas).

**Estado:** 🟢 Página do Plano analisável (tabela + filtros + ordenação + editar/apagar). Pendências da importação real mantêm-se.
