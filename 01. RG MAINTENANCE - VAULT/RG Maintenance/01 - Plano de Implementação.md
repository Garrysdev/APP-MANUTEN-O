---
tags: [maintenanceos, plano, fases]
ultima_atualizacao: 2026-06-08
---

# 📋 Plano de Implementação

[[00 - Projeto Overview|← Overview]]

## Fases do Projeto

### Fase 1 — Setup & Base (Sem. 1–2)
**Estado:** 🔵 Em curso

**Progresso:**
- [x] Inicializar projeto Next.js (scaffold Next.js 15 + Tailwind + shadcn)
- [x] Esquema de base de dados definido (`supabase/schema.sql` — pendente adaptação para Firebase, ver Decisão #010)
- [x] App a correr localmente (`localhost:3000/login` → 200 OK)
- [ ] Criar repositório no GitHub
- [ ] Configurar base de dados (Supabase → **Firebase**, decisão pendente)
- [ ] Deploy inicial no Vercel

**Objetivos:**
- Criar repositório no GitHub
- Configurar base de dados (Firebase)
- Inicializar projeto Next.js
- Deploy inicial no Vercel (página em branco funcional)
- Definir esquema da base de dados (tabelas: users, technicians, tasks, interventions, materials, assets)

**Critérios de aprovação pelo Rui:**
- [ ] URL do projeto acessível online
- [ ] Login de teste funcional
- [ ] Base de dados criada com estrutura correta

---

### Fase 2 — Autenticação (Sem. 2–3)
**Estado:** ⬜ Pendente

**Objetivos:**
- Login e registo de utilizadores (Supabase Auth)
- Perfis: Gestor e Técnico
- Proteção de rotas (gestor não acede à vista de técnico e vice-versa)
- Recuperação de senha por e-mail
- Sessão persistente

**Critérios de aprovação pelo Rui:**
- [ ] Login com e-mail + password funciona
- [ ] Dois utilizadores de teste criados (1 gestor, 1 técnico)
- [ ] Redirecionamento correto por perfil

---

### Fase 3 — Dashboard Gestor (Sem. 3–6)
**Estado:** ⬜ Pendente

**Objetivos:**
- KPIs em tempo real (tarefas abertas/em curso/concluídas)
- Criar e atribuir ordens de trabalho
- Calendário de manutenções preventivas
- Lista de técnicos e disponibilidade
- Histórico com filtros (data, técnico, equipamento, estado)
- Gestão de equipamentos/ativos

**Critérios de aprovação pelo Rui:**
- [ ] Criar uma tarefa e atribuí-la a um técnico
- [ ] Ver KPIs atualizados em tempo real
- [ ] Filtrar histórico por técnico

---

### Fase 4 — App Técnico PWA (Sem. 6–8)
**Estado:** ⬜ Pendente

**Objetivos:**
- Interface mobile-first responsiva
- Lista de tarefas atribuídas
- Botão Iniciar Intervenção (timestamp automático)
- Campos: observações + materiais consumidos
- Upload de fotografias
- Botão Concluir Intervenção (timestamp automático)
- Modo offline com sincronização

**Critérios de aprovação pelo Rui:**
- [ ] Instalar a PWA no telemóvel
- [ ] Completar uma intervenção de ponta a ponta
- [ ] Verificar que funciona sem Internet

---

### Fase 5 — PDF & Diário (Sem. 8–9)
**Estado:** ⬜ Pendente

**Objetivos:**
- Geração de PDF profissional por intervenção
- Logotipo da empresa no cabeçalho
- Tabela de materiais consumidos
- Fotos incluídas no PDF
- Diário de manutenção (tabela cronológica)
- Exportação para Excel (.xlsx)

**Critérios de aprovação pelo Rui:**
- [ ] Gerar PDF de uma intervenção real
- [ ] Exportar diário do mês para Excel
- [ ] PDF com logotipo correto

---

### Fase 6 — Testes & Polimento (Sem. 9–10)
**Estado:** ⬜ Pendente

**Objetivos:**
- Testes com utilizadores reais (técnicos e gestor)
- Correções de usabilidade
- Notificações por e-mail (tarefa atribuída, prazo a aproximar)
- Design responsivo validado em iOS e Android
- Performance e carregamento < 3s

**Critérios de aprovação pelo Rui:**
- [ ] Aprovação após sessão de teste com técnico real
- [ ] Sem bugs críticos identificados

---

### Fase 7 — SaaS & Lançamento (Sem. 10–12)
**Estado:** ⬜ Pendente

**Objetivos:**
- Integração Stripe (planos Starter/Pro/Business/Enterprise)
- Portal de self-service do cliente
- Página de marketing (landing page)
- Onboarding dos primeiros clientes
- Documentação de utilizador

**Critérios de aprovação pelo Rui:**
- [ ] Subscrição de teste com cartão Stripe
- [ ] Primeiro cliente externo onboarded
- [ ] Landing page publicada

---

## Legenda de Estados

| Símbolo | Significado |
|---------|-------------|
| ⬜ | Pendente |
| 🔵 | Em curso |
| ✅ | Concluída |
| 🔴 | Em atraso |
| ⏸️ | Em pausa / bloqueada |
