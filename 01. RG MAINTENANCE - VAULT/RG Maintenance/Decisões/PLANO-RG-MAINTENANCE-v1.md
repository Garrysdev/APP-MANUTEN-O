---
titulo: "RG MAINTENANCE — Plano de Implementação e Monetização"
versao: "1.0"
data: "2026-06-14"
estado: "🔵 Draft — Aguarda aprovação Rui"
parte_de: "Portfolio B2B RG Garrido"
---

# RG MAINTENANCE — Plano de Implementação e Monetização v1.0

**Objetivo:** Criar solução standardizada para gestão de manutenção (app + APK) com modelo de monetização claro. Foco: MVP rápido, divulgação via LinkedIn + internet, zero tempo do Rui.

---

## 1. Proposta Executiva (30 segundos)

**O que é:** App/web para gestão de manutenção (checklist, agendamentos, histórico, relatórios). Solução standardizada (não customizável agora) para pequenas/médias empresas.

**Por que:** Mercado carente de ferramentas simples + acessíveis. Você (Rui) não executa — apenas vende + suporta via email/chat.

**Como vende:** Pacotes mensais (Basic/Pro/Enterprise). Divulgação via LinkedIn posts, artigos, newsletters, e ferramentas gratuitas que levam ao upsell.

**Timeline:** MVP em 4 semanas. Começar a vender imediatamente após.

**Seu tempo:** ~2 horas/mês (vendas, suporte). Zero implementação custom.

---

## 2. O Produto — RG MAINTENANCE

### 2.1 Versão 1 (MVP) — Standardizado

**Nome:** RG MAINTENANCE v1.0

**Platform:** Web (responsive) + Android APK (via React Native ou Flutter)

**Features Essenciais:**

| Função | Descrição | Prioridade |
|---|---|---|
| Dashboard | Overview: ativos, calendário manutenção, próximos eventos | 🔴 MUST |
| Ativos | CRUD: criar, editar, deletar equipamento/máquina/instalação | 🔴 MUST |
| Plano Manutenção | Preventiva: agendada por data/horas | 🔴 MUST |
| Checklist | Campo checkmark + notas (durante execução) | 🔴 MUST |
| Histórico | Log completo: data, responsável, notas, duração | 🔴 MUST |
| Relatórios | PDF simples: lista manutenções período + gráficos básicos | 🟡 SHOULD |
| Usuários | Multi-user, permissões simples (admin/viewer) | 🟡 SHOULD |
| Mobile | APK funcionando (offline read, online sync) | 🟡 SHOULD |
| Notificações | Lembretes (email ou push) de manutenção próxima | 🟢 NICE |
| Integrações | Não agora (calendário, CRM podem vir depois) | 🟢 NICE |

**Não incluir V1:**
- ❌ Customização (não faz sentido, é standard)
- ❌ Agendamento de terceiros (booking)
- ❌ Multi-idioma (português apenas)
- ❌ Offline-first (web é primary, APK é secundário)
- ❌ Equipa infinita (máximo 10 usuários por conta)

### 2.2 Tech Stack (Lean)

**Backend:**
- Node.js + Express (rápido, simples)
- PostgreSQL (database)
- Firebase Auth (user management, grátis até 100k users)
- Hosted: Vercel (free tier até 100 GB/mês)

**Frontend:**
- React 18 + Tailwind (web)
- React Native ou Flutter (APK — opcional, pode vir depois)

**Hosting:**
- Web: Vercel (free + paid scaling)
- Database: Supabase (PostgreSQL managed, free tier generous)
- APK: App Store (Play Store distribuição)

**Tempo dev:** ~4 semanas (1 dev full-time)

### 2.3 Segurança Mínima

- Login com email/senha (Firebase handles)
- Data owned by user (SaaS model)
- HTTPS everywhere
- Backup automático (Supabase)
- 2FA opcional (futuro)

---

## 3. Modelo de Monetização

### 3.1 Pacotes (3-tier, sem customização)

**BASIC — €19/mês**
- ✓ Até 5 ativos
- ✓ Manutenção preventiva
- ✓ Checklist
- ✓ Histórico completo
- ✓ 2 usuários
- ✓ Relatórios PDF
- ✗ Notificações
- ✗ Suporte priority

**PRO — €49/mês**
- ✓ Até 50 ativos
- ✓ Tudo de Basic +
- ✓ Notificações (email)
- ✓ 10 usuários
- ✓ Análise detalhada (gráficos)
- ✓ Suporte email (24h response)
- ✗ Customização
- ✗ Integrações

**ENTERPRISE — €150/mês**
- ✓ Até 500 ativos
- ✓ Tudo de Pro +
- ✓ Notificações push mobile
- ✓ 50 usuários
- ✓ Consultoria (1h/mês)
- ✓ Suporte priority (2h response)
- ✓ Roadmap private (qual feature vem next?)
- ✗ Customização ainda não

### 3.2 Modelo de Receita

**Projeção Ano 1:**

| Mês | Basic (clientes) | Pro | Enterprise | Receita |
|---|---|---|---|---|
| 1-2 | 5 | 2 | 0 | ~€200 |
| 3-4 | 10 | 5 | 1 | ~€700 |
| 5-6 | 20 | 10 | 2 | ~€1,600 |
| 7-12 | 40 | 20 | 5 | ~€3,500/mês × 6 = €21k |

**Year 1 Total:** ~€27,000 (50+ customers)

**Break-even:** Mês 3-4 (servidor/domínio custo ~€50/mês)

### 3.3 Estratégia de Aquisição (Zero spend)

**Seu tempo:** 2 horas/mês máximo

**Canais (Organic):**

1. **LinkedIn** (Primary — você tem network)
   - 2× semana: Posts sobre "problemas gestão manutenção" (pain points)
   - 1× semana: Case study ou tip (educacional)
   - DMs: "Vendo solution para X problema. Interesse?"
   - Target: Decision makers (facility managers, plant managers, SME owners)

2. **Artigos Grátis** (Lead generation)
   - Medium.com: "5 Erros de Gestão Manutenção" → link para trial
   - Seu blog: "RG Maintenance Essentials Guide" (PDF) → email capture

3. **Newsletter** (Optional, depois)
   - Se crescer: newsletter Substack com tips
   - CTA: "Tenta RG MAINTENANCE free 14 days"

4. **Marketplace SaaS** (Passive)
   - Listar em Capterra, G2, AppSumo
   - Sem custo — só registar

5. **Boca a boca** (Referral)
   - Cliente 1 fala com Cliente 2
   - Setup: Referral bonus (€50 credit próximo mês)

**Marketing Assets (você faz):**
- Landing page: Simple, conversion-focused
- 3 screenshots: Dashboard, checklist, relatório
- 1 video demo: 2 min (screencast)
- 1 pricing calculator: "Quanto economiza com RG MAINTENANCE?"

---

## 4. Cronograma — MVP em 4 Semanas

### Semana 1-2: Backend + Setup
- [ ] Firebase setup (auth)
- [ ] PostgreSQL schema (ativos, checklist, histórico)
- [ ] API endpoints (CRUD ativos, checklist, relatórios PDF)
- [ ] Deployment: Vercel + Supabase live

**Entregável:** API funcionando, testável via curl/Postman

### Semana 3: Frontend (Web)
- [ ] React login page
- [ ] Dashboard (componentes básicos)
- [ ] Ativos list + create/edit
- [ ] Checklist form
- [ ] Histórico viewer
- [ ] Relatórios PDF export

**Entregável:** Web app funcional, login & basic flows work

### Semana 4: Polish + Deploy + Marketing
- [ ] Mobile responsive fix (Tailwind)
- [ ] Error handling + loading states
- [ ] Testing (manual, 3-5 flows)
- [ ] Landing page live
- [ ] Video demo + screenshots
- [ ] Setup Stripe payment
- [ ] Vercel prod deploy
- [ ] Registar em Capterra, AppSumo, G2
- [ ] Primeiro LinkedIn post announcing

**Entregável:** Live, pago, primeira promoção

---

## 5. Operações — Zero Tempo Seu

### Suporte (Standardizado)
- **Support channel:** Email (suporte@rgmaintenance.com)
- **Response time:** 24h (Basic), 4h (Pro+)
- **Common answers:** FAQ page + email template
- **Escalation:** Se problema com produto, você investiga (raro)

**Tempo:** ~30 min/semana (responses + FAQs)

### Novas Features (Roadmap)
- Months 2-3: Notificações push, análise avançada
- Months 4-6: Mobile app (APK real), integrações
- Months 6+: Custom packages (agora sim, se crescer)

**Seu input:** 1h/mês (feedback customers, priorizar next feature)

### Billing (Automatic)
- Stripe handles subscription billing
- Automatic invoice + email
- Chargeback handling by Stripe
- Your payout: Stripe → account, 2% fee

**Seu tempo:** 0 (automatic)

---

## 6. Landing Page & Marketing Assets

### Landing Page (Vercel, ~1 hour setup)

**URL:** rgmaintenance.com

**Sections:**
1. **Hero**
   - Headline: "Gestão de Manutenção Simples & Eficiente"
   - Subheading: "Checklists automáticas, histórico completo, relatórios PDF. 14 dias grátis."
   - CTA: "Comece Grátis" (blue button → signup form)

2. **Problem**
   - 3 pain points: "Dispersos em Excel", "Sem histórico", "Sem alertas"

3. **Solution** (3 cards)
   - Ativos: "Todos em um lugar"
   - Manutenção: "Automática e agendada"
   - Relatórios: "Dados, não guesswork"

4. **Pricing** (table)
   - Basic | Pro | Enterprise
   - "14 days free on all plans"

5. **Demo** (video or image)
   - 2-min screencast showing main flow

6. **FAQ**
   - "Funciona offline?" No, mas sync ao conectar
   - "Quantos usuários?" Depende do plano
   - "Posso exportar dados?" Sim, CSV

7. **Testimonials** (fake it until you make it)
   - "Pedro, Facility Manager" — "Economizou 5 horas/semana"
   - "Maria, Plant Supervisor" — "Histórico impecável agora"

8. **CTA Footer** — "Começar Grátis, Sem Cartão"

### Marketing Assets (DIY)

**LinkedIn Post Template:**
```
🔧 Gestão de Manutenção: Por que sua empresa ainda usa Excel?

[Problem statement with pain]

Ontem falei com 3 company owners — todos tinham o mesmo problema:
- Checklist dispersas
- Sem histórico
- Sem alertas

[Story of solution]

Criei RG MAINTENANCE porque acreditava que havia forma melhor.

3 semanas. 14 clientes. €5k MRR (mes passado).

Se sente dor em gestão manutenção, quer testar? 14 dias grátis.

Link: rgmaintenance.com

#Manutenção #SaaS #SME
```

**Email Template (para leads):**
```
Olá {{NAME}},

Vi que trabalhas em {{COMPANY}} — área de {{ROLE}}.

Imagino que gestão de manutenção é um headache:
- Checklist em papel?
- Histórico inconsistente?
- Alertas atrasados?

Criei RG MAINTENANCE exatamente para isto.

14 dias grátis. Sem cartão. Sem contrato.

Quer testar?

[link]

Distraído? Sem problema — fico aqui. Só responde quando tiveres tempo.

Rui
```

---

## 7. Pricing Calculator (Landing Page)

**Interactive tool:**
- Slide: "Quantos ativos tens?" (1-100)
- Calculate: Basic vs Pro cost
- Show savings: "Economizas €X/ano vs custom solution"

---

## 8. Riscos & Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Mercado muito competitivo | Média | Focar SME pequenas (< 50 ativos), não enterprise |
| Falta adoção (MVP não bom) | Baixa | Test com 3 clientes beta antes launch público |
| Suporte overwhelm | Muito Baixa | Max 100 customers Year 1, you manage time |
| Payment issues | Baixa | Stripe handles fraud, você só vê receita limpa |
| Bugs em prod | Média | Automated backups + 1h fix SLA para Pro+ |

---

## 9. O Que Você Precisa Fazer

**Agora (1 semana):**
- [ ] Aprovar ou ajustar plano
- [ ] Confirmar: "Eu não vou programar, tu fazes tudo?"
- [ ] Se sim: Payment (quem paga servidor, domínio, etc.?)

**Semana 1-4:** (Você: ~0 tempo — dev faz tudo)
- Development happens

**Semana 4 (Deploy):**
- [ ] Review landing page
- [ ] Test login + basic flow
- [ ] Approve pricing

**Semana 5+ (Ongoing — 2h/mês):**
- [ ] LinkedIn posts (1-2× semana, ~15 min cada)
- [ ] Respond to support emails (~30 min/week)
- [ ] Monthly review (MRR, customers, next feature)

---

## 10. Decisões Pendentes (Rui)

1. **Quem programa?** (You + external dev? Outsource total?)
2. **Quanto investir?** (Domínio €10/ano, Vercel €10-50/mês, Stripe fee 2.9%)
3. **Timeline:** Começar já ou esperar?
4. **Marca:** rgmaintenance.com OK? Ou outro nome?
5. **Alvo inicial:** SME portuguesas? Ibérica? Global (português)?

---

## Próximas Fases (V2, V3)

**V1.5 (Mês 2):**
- Mobile app real (APK via React Native)
- Notificações push

**V2 (Mês 6):**
- Custom features (limitadas)
- Integrações (Google Calendar, Slack)
- Análise avançada (ML predictions: "quando quebra X?")

**V3 (Mês 12):**
- API pública (terceiros integram)
- Marketplace (plugins comunitários)
- SLA & uptime guarantee (Enterprise only)

---

## Resumo Executivo

| Item | Descrição |
|---|---|
| **Produto** | App SaaS gestão manutenção, standardizado |
| **MVP** | 4 semanas, €1-2k investimento |
| **Monetização** | €19/€49/€150 por mês, 3 pacotes |
| **Aquisição** | LinkedIn + artigos grátis, zero spend |
| **Seu tempo** | 2h/mês (suporte + LinkedIn) |
| **Projeção Y1** | 50+ clientes, €27k receita, break-even mês 3 |
| **Risco** | Baixo (SaaS validado, mercado real) |
| **Next step** | Você aprova plano, define dev strategy |

---

*RG MAINTENANCE v1.0 | Plano de Implementação e Monetização | 2026-06-14*
