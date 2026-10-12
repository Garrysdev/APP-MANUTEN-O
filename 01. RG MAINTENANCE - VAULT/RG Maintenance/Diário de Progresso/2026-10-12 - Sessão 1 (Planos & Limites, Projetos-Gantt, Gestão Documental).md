---
data: 2026-10-12
projeto: RG Maintenance (CMMS)
tags: [diario, rg-maintenance, planos, gantt, gestao-documental, bugfix]
sessao: diurna
---

# 2026-10-12 — Planos & Limites, Projetos/Gantt separados, Gestão Documental, 4 bugs de OT

Sessão longa, sequência ao Plano de Monetização. Ponto de partida: Rui pediu revisão a
fundo aos Planos & Preços antes de criar a conta Stripe, com um PDF próprio
(`PLANOS_OUT_2026.pdf`) a pedir limites numéricos por recurso — hoje só havia booleano
✅/❌ por funcionalidade (`src/lib/plans.ts`). A sessão ramificou-se em várias frentes à
medida que iam aparecendo bugs reais ao testar.

## Sistema de Planos & Limites (`src/lib/plans.ts`)

- `LIMITS` ganha limites por recurso: equipamentos, stocks, armazéns, regras de
  segurança, mensagens/mês, planos de manutenção, projetos abertos, Folhas de Registo
  (FR), Instruções de Trabalho (IT).
- Aplicados nas Server Actions de criação dos 7 recursos (mesmo padrão em todos: contar
  os itens atuais da empresa, comparar com `LIMITS[plan]`, bloquear com mensagem de
  upgrade se excedido — espelha o padrão já existente para `maxUsers`).
- `Gerir Utilizadores` e `Histórico` passam a `true` em todos os planos (antes
  exclusivos de Pro+).
- Página pública e billing interna atualizadas: Business sobe de 119€ para 149€/mês,
  Enterprise removido (decisão já tomada antes), números corrigidos.
- Itens pré-definidos de fábrica (armazéns/regras "de origem") não contam para o
  limite — só os criados pela própria empresa.

## Menu lateral reordenado + regate de planos

Grupo "Módulos Starter": Plano de Manutenção, Calendário, Armazéns, Regras de
Segurança, Gestão Documental, Projetos, Gráficos Gantt, Mensagens — Armazéns/Regras/
Mensagens saem de "Base (Free)" e ganham gate real (antes eram grátis sem limite nenhum).

## Projetos e Gráficos Gantt separados

Antes: uma só página (`/dashboard/projects`) com um botão a alternar entre vista de
lista e vista de Gantt, misturando Projetos reais com barras sintéticas de Plano de
Manutenção (PM). Passa a:

- `/dashboard/projects` — lista no mesmo padrão visual das OTs (chips de estado,
  filtros, cartões no telemóvel, tabela + paginação).
- `/dashboard/gantt` — só o Gantt, **só com Projetos** (sem OTs normais, sem barras
  de PM — essas ficam só no Calendário, confirmado que já só mostra ocorrências de
  Plano de Manutenção).
- As duas páginas ligam-se uma à outra por um link no cabeçalho.

**Formulário de Projeto deixou de ser cópia do formulário de OT** (pedido explícito do
Rui): sem Tipo de OT, Criticidade, Legal, seletor de FR/IT obrigatórias nem secção
"Criar/Incluir no PM"; Equipamento deixa de ser obrigatório. `CreateTaskModal` ganha a
prop `isProjectForm`.

**`isProjectTask()`** (`src/lib/task-assignment.ts`, fonte única de verdade sobre "isto
é um Projeto") deixou de classificar como Projeto qualquer OT cuja descrição mencionasse
a palavra "projeto"/"projecto" em texto livre — causava OTs normais a aparecerem na
lista de Projetos só por coincidência de texto. Fica só com sinais estruturados
(criado como Projeto, ou Tipo='projeto').

## Gestão Documental nova (`/dashboard/documents`)

Folhas de Registo (FR) e Instruções de Trabalho (IT) passam de 3+3 modelos fixos no
código (`AVAILABLE_FRS`/`AVAILABLE_ITS`, partilhados por todas as empresas, sem
Firestore) para documentos reais por empresa, com CRUD próprio e limite por plano.
Os 3+3 antigos continuam disponíveis como fallback (mesclados com os reais) até serem
migrados para documentos reais da Empresa UR com os mesmos IDs — **falta esse script de
migração**, bloqueado pela questão das credenciais Sensitive do Vercel (ver abaixo).

## 4 bugs corrigidos

1. **Badge do estado "Prazo" sem estilo** em OTs antigas/importadas — normalização de
   maiúsculas/espaços antes de montar a classe CSS.
2. **Edição de OT importada "revertia" o estado** — `companyId` corrompido no
   documento Firestore (mesma classe de corrupção já documentada para Planos de
   Manutenção/Utilizadores); aplicado o mesmo padrão de auto-reparação a `updateTask`.
3. **Guardar Estado "Concluída" revertia sozinho para "Pendente"** quando a OT não
   tinha Prazo preenchido (a maioria não tem) — a regra usava o campo errado (Prazo em
   vez de Fim da OT). Corrigido para usar a data de Fim da OT (`completedAt`) como
   sinal real de conclusão — preencher/limpar esse campo muda o Estado automaticamente,
   nos dois sentidos. Mesmo bug existia duplicado em `projects/actions.ts`, corrigido lá
   também.
4. **2 fugas de dados cross-tenant** encontradas numa auditoria de código (não
   reportadas pelo Rui): `listInternalMessages` e `listUsers` mostravam mensagens/
   utilizadores legados da Empresa UR a qualquer empresa cliente nova.

## Outras alterações

- Gestor pode agora escrever a data/hora de Início e Fim da OT à mão (antes só
  "carimbar agora") — para fechar uma OT com a data real de término sem adulterar
  métricas como o MTTR.
- "Data Planeada" removida do formulário de OT; "Prazo" renomeado para "Data Limite"
  (opcional, sem relação com o Estado) — simplificação pedida pelo Rui.
- Páginas legais (`/legal/termos`, `/legal/privacidade`) criadas, rascunho com campos
  por confirmar.

## Descoberta importante: variáveis de ambiente "Sensitive" no Vercel

`FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` e as chaves Stripe
em produção estão marcadas "Sensitive" no Vercel — **não há forma de as ler de volta**,
nem por `vercel env pull`, nem por CLI, nem pelo dono do projeto no Dashboard. Isto
tinha levado a uma conclusão errada mais cedo na sessão ("Stripe não está ligado") que
foi corrigida depois de perceber o mecanismo. Implica: para correr qualquer script
administrativo local (seed, migração, diagnóstico direto à BD) é preciso o Rui gerar
uma chave de serviço **nova** no Firebase Console — gerar uma nova não invalida a
antiga que já está em produção.

## Pendente (depende do Rui)

1. **Preço Starter no Stripe** — criar no Dashboard Stripe (conta certa da RG
   Maintenance, modo Live) e dar o `price_...`.
2. **Chave de serviço nova do Firebase** (Console → Definições do Projeto → Contas de
   Serviço → Gerar nova chave privada) — necessária para: corrigir a conta de teste
   `rgb@teste.rg` (login funciona, mas falta o documento Firestore — por isso aparecia
   como Técnico em vez de Gestor/Business) e migrar os 3 FR + 3 IT para documentos reais
   da Empresa UR.

Tudo registado também em `CLAUDE.md` do projeto (commit `a7b2160`).
