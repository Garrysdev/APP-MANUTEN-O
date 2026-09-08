# HANDOFF — Projecto RG Maintenance
**Para:** Claude CLI (migração de Cowork/claude.ai)
**Data de criação:** 2026-06-10
**Autor:** Rui Garrido (garrido.rui@gmail.com)
**Língua de trabalho:** Português de Portugal (sempre — nunca inglês ou pt-BR)

---

## 0. Instruções para o Claude CLI

Lê este ficheiro inteiro antes de fazer qualquer coisa neste projecto. Depois lê também:
- `G:\MANUTENÇÃO\MANUTENÇÃO\RGMaintenance_Contexto_Claude.md` — contexto técnico completo (stack, BD, ficheiros, branding, monetização)
- `G:\MANUTENÇÃO\MANUTENÇÃO - VAULT\RG Maintenance\02 - Cronograma.md` — estado em tempo real de fases/gates
- `G:\MANUTENÇÃO\MANUTENÇÃO\MANUTENÇÃO - VAULT\RG Maintenance\Decisões\Log de Decisões.md` — decisões aprovadas

Sempre que o Rui pedir para trabalhar neste projecto, começa por confirmar o estado actual (secção 3) antes de avançar.

---

## 1. Identidade do Projecto

**RG Maintenance** — plataforma SaaS de gestão de manutenção (CMMS).

- **Proprietário:** Rui Garrido
- **Modelo de trabalho:** Claude constrói tudo — Rui só aprova em gates definidos (A0–A7b)
- **Cor principal:** `#1B4F72` (azul navy)
- Detalhes completos de branding, stack e BD → ver `RGMaintenance_Contexto_Claude.md`

---

## 2. Regras Absolutas (NUNCA violar)

1. **Língua:** sempre pt-PT. "ficheiro" não "arquivo", "ecrã" não "tela", "telemóvel" não "celular"
2. **Gates:** nunca avançar de fase sem aprovação escrita do Rui ("AX aprovado")
3. **Código:** guardar sempre em `G:\rg-maintenance\` (⚠️ path mudou em 2026-06-10, ver secção 5)
4. **Vault Obsidian:** ao concluir trabalho relevante, atualizar `02 - Cronograma.md`, `Log de Decisões.md` e criar entrada em `Diário de Progresso/`
5. **Base de dados:** NÃO criar contas/projecto Supabase nem implementar RLS — decisão pendente de mudar para Firebase (ver secção 6). Aguardar instrução explícita do Rui.

---

## 3. Estado Actual (2026-06-10)

```
Gate A0:  ✅ CONCLUÍDO — Nome, logo, stack e Fase 0 aprovados
Fase 0:   ✅ CONCLUÍDA
Fase 1:   🟢 EM CURSO — scaffold corrigido e a correr localmente:
            - http://localhost:3000/login → 200 OK
            - npm install OK (340 pacotes), dev server estável
Gate A1:  ⬜ PENDENTE — falta deploy online (depende de contas externas)
```

**Bloqueio actual:** Gate A1 precisa que o Rui crie contas (GitHub + BD + Vercel) e siga `SETUP.md`. Adicionalmente, a escolha de BD (Firebase vs Supabase) tem de ficar resolvida antes de gerar os ficheiros de backend definitivos.

---

## 4. Localização dos Ficheiros

| O quê | Caminho |
|---|---|
| Código da app | `G:\rg-maintenance\` ⚠️ **path novo** (era `G:\MANUTENÇÃO\MANUTENÇÃO\rg-maintenance\`) |
| Pasta de documentação/planeamento | `G:\MANUTENÇÃO\MANUTENÇÃO\` |
| Vault Obsidian | `G:\MANUTENÇÃO\MANUTENÇÃO - VAULT\RG Maintenance\` |
| Contexto técnico completo | `G:\MANUTENÇÃO\MANUTENÇÃO\RGMaintenance_Contexto_Claude.md` |
| Guia de setup Fase 1 | `G:\rg-maintenance\SETUP.md` |
| Este ficheiro | `G:\MANUTENÇÃO\MANUTENÇÃO\HANDOFF - CLAUDE_CLI.md` |

---

## 5. Nota Técnica — Path Longo do Windows

O caminho original do código (`G:\MANUTENÇÃO\MANUTENÇÃO\rg-maintenance\...`) tem acentos e muitos níveis — combinado com os paths internos profundos do Next.js (`node_modules\next\dist\client\components\react-dev-overlay\...`), excede os 260 caracteres do Windows e corrompe a instalação do pacote `next` via `npm install`.

**Solução aplicada:** código movido para `G:\rg-maintenance\` (path curto). O Vault Obsidian e os documentos de planeamento ficaram no local original — só o código mudou.

Se voltar a aparecer "Directory not empty" ao apagar `node_modules`, usar:
```powershell
Remove-Item -LiteralPath "\\?\<caminho completo>" -Recurse -Force
```

---

## 6. Decisão Pendente — Base de Dados (Supabase → Firebase)

O Rui decidiu (2026-06-10) mudar de **Supabase para Firebase**. Ainda **não implementado** — fica para uma tarefa dedicada a criar no Vault Obsidian.

Impacto quando essa tarefa avançar:
- `supabase/schema.sql` → estrutura equivalente em Firestore
- `src/lib/supabase/client.ts` e `server.ts` → SDK Firebase (Auth + Firestore)
- `src/types/database.ts` → tipos Firestore
- `src/middleware.ts` → auth guard com Firebase Auth
- RLS policies → Firestore Security Rules

O scaffold actual da Fase 1 (UI, layout, rotas, branding) continua válido — só a camada de dados/autenticação será substituída.

---

## 7. Tarefas Pendentes (Rui)

### Alta prioridade
1. Decidir e detalhar a migração Supabase → Firebase numa nova tarefa no Vault Obsidian
2. Seguir `SETUP.md` em `G:\rg-maintenance\` para Gate A1 (GitHub + BD + Vercel)

### Quando Gate A1 estiver pronto
3. Dizer "A1 aprovado" → Claude avança para Fase 2 (Autenticação & Multi-Tenant)

---

## 8. Log de Sessões Anteriores (resumo)

| Data | Sessão | O que foi feito |
|---|---|---|
| 2026-06-08 | 1 | Planeamento completo, stack aprovada, Gate A0 parcialmente confirmado |
| 2026-06-10 | 2 (Cowork) | Scaffold da Fase 1 gerado (Next.js + Supabase + Tailwind + shadcn) |
| 2026-06-10 | 2 (Claude CLI, local) | Corrigido `package.json`, projecto movido para `G:\rg-maintenance`, criados `tsconfig.json` e `.env.local`, `npm install` OK, dev server a correr (`/login` → 200) |
| 2026-06-10 | 2 (Claude CLI, local) | Decisão registada: BD muda para Firebase (pendente). Criado este HANDOFF + actualizado `RGMaintenance_Contexto_Claude.md`, `02 - Cronograma.md`, `Log de Decisões.md` |
| 2026-06-19 | 3 (Claude CLI, local) | **Build reparado.** `npm run build` falhava (queries Supabase tipadas → `never`) por incompatibilidade `@supabase/ssr@0.5.2` × `supabase-js@2.108.1`. Upgrade ssr → 0.12.0 + `database.ts` completado (GenericSchema: Views/Functions/Enums/CompositeTypes + Relationships + FK users→companies) + `.eslintrc.json`. Agora build+tsc+lint verdes. ⚠️ `npm audit`: 1 crítica (Next 15.1.0) por resolver. Ver `Diário de Progresso/2026-06-19 - Sessão 1.md` |

---

*Actualizar este ficheiro sempre que algo estrutural mudar no projecto (path, stack, gates).*
*Versão: 1.0 — 2026-06-10*
