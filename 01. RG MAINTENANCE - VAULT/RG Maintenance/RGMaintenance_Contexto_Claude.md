# RG Maintenance — Contexto Completo para Claude CLI

> Ficheiro gerado em 2026-06-10. Carrega este ficheiro no início de cada sessão Claude CLI.
> Contém todo o histórico de decisões, arquitectura, ficheiros criados e estado actual do projecto.

---

## 🏗 IDENTIDADE DO PROJECTO

- **Nome:** RG Maintenance
- **Tipo:** Plataforma SaaS de gestão de manutenção (CMMS)
- **Proprietário:** Rui Garrido (garrido.rui@gmail.com)
- **Modelo de trabalho:** Claude constrói tudo — Rui só aprova em gates definidos
- **Língua de trabalho:** Português de Portugal (pt-PT) — SEMPRE

---

## 🗂 LOCALIZAÇÃO DOS FICHEIROS

| O quê | Caminho |
|---|---|
| Pasta principal | `G:\MANUTENÇÃO\MANUTENÇÃO\` |
| Código da app | `G:\rg-maintenance\` ⚠️ **MOVIDO em 2026-06-10** (era `G:\MANUTENÇÃO\MANUTENÇÃO\rg-maintenance\` — path longo corrompia `npm install`) |
| Vault Obsidian | `G:\MANUTENÇÃO\MANUTENÇÃO - VAULT\RG Maintenance\` |
| Plano Word | `G:\MANUTENÇÃO\MANUTENÇÃO\RGMaintenance_Plano_Implementacao.docx` |
| Cronograma Word | `G:\MANUTENÇÃO\MANUTENÇÃO\RGMaintenance_Cronograma_Ferramentas.docx` |
| Cronograma antigo | `G:\MANUTENÇÃO\MANUTENÇÃO\RGMaintenance_Cronograma_Detalhado.docx` |
| Monetização Word | `G:\MANUTENÇÃO\MANUTENÇÃO\RGMaintenance_Plano_Monetizacao.docx` |
| Guia de setup Fase 1 | `G:\MANUTENÇÃO\MANUTENÇÃO\rg-maintenance\SETUP.md` |
| Dashboard Cowork | Artefacto id: `maintenanceos-dashboard` (nome: "RG Maintenance — Dashboard de Projeto") |
| Check-in semanal | Task agendada: `maintenanceos-checkin-semanal` (segunda-feira 09h05) |

---

## 🎨 BRANDING & DESIGN

- **Cor principal:** `#1B4F72` (azul navy — retirado do logo RG)
- **Logo:** Monograma "RG" em branco sobre fundo navy, com tagline "Maintenance"
- **Paleta secundária:**
  - Azul claro: `#2E86C1`
  - Azul muito claro: `#D6EAF8`
  - Verde: `#148F77`
  - Âmbar: `#D4AC0D`
  - Cinzento: `#5D6D7E`
- **Tipografia:** Inter / system-ui / Arial
- **Mockup de referência:** Rui forneceu mockup mobile dark navy com: Dashboard KPIs, Service Requests, Create Report, Reports, PDF com header RG Maintenance

---

## 🛠 STACK TÉCNICA (DECISÕES FINAIS)

| Componente | Tecnologia | Notas |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 | SSR + Server Actions nativo |
| Estilos | Tailwind CSS + shadcn/ui | Components: tabelas, modais, calendário |
| Backend / BD | Supabase (PostgreSQL) | Free tier: 500 MB |
| Autenticação | Supabase Auth | JWT, sessão persistente |
| Storage | Supabase Storage | Fotos + PDFs por empresa |
| Realtime | Supabase Realtime | KPIs em tempo real |
| Hosting | **Vercel** (não Netlify) | Next.js nativo, deploy automático |
| Email | Resend | Convites + notificações (3.000/mês grátis) |
| PDF | React-PDF + Puppeteer | Geração server-side |
| Excel export | xlsx (SheetJS) | Diário de manutenção |
| Pagamentos | Stripe | Fase 7 — subscrições mensais |
| Play Store | PWABuilder / TWA | Fase 0 — Sem. 10–11 |
| Domínio | A comprar pelo Rui, ligar ao Vercel | 5 min de config, não bloqueante |

**Por que Vercel e não Netlify:** Next.js foi criado pela Vercel. SSR, Server Actions, API Routes e PDF server-side funcionam nativamente. Netlify usa adaptador com limitações conhecidas.

---

## 🏛 ARQUITECTURA DA BASE DE DADOS

### Multi-tenancy com RLS
Uma única base de dados Supabase. Todas as tabelas têm `company_id`. As Row Level Security (RLS) policies garantem que cada empresa só vê os seus próprios dados.

```
Empresa A ──┐
Empresa B ──┼──► Mesma DB Supabase, isolamento via RLS por company_id
Empresa C ──┘
```

### Tabelas

```sql
companies     — id, name, slug, plan, max_technicians, logo_url, created_at
users         — id (= auth.users.id), company_id, email, name, role, active
assets        — id, company_id, name, location, type, serial_number, notes
tasks         — id, company_id, title, description, asset_id, assigned_to, priority, status, due_date, created_by
interventions — id, task_id, company_id, technician_id, started_at, ended_at, observations
materials     — id, intervention_id, company_id, name, reference, quantity, unit
photos        — id, intervention_id, company_id, storage_path, caption
```

### Tipos enumerados
```sql
user_role:     manager | technician
task_status:   pending | in_progress | done | cancelled
task_priority: low | medium | high | urgent
plan_name:     free | starter | pro | business | enterprise
```

### Storage
Bucket: `company-files`
Estrutura: `companies/{company_id}/interventions/{intervention_id}/photos/` e `report.pdf`

### Função auxiliar RLS
```sql
create function get_my_company_id() returns uuid as $$
  select company_id from users where id = auth.uid()
$$ language sql security definer stable;
```

---

## 📋 PLANO DE IMPLEMENTAÇÃO — 9 GATES, 8 FASES

### Estado dos Gates

| Gate | Sem. | Descrição | Estado |
|---|---|---|---|
| **A0** | 0 | Nome + logo + Vercel + Fase 0 aprovada | ✅ **CONCLUÍDO** |
| A1 | 2 | URL online + login de teste funcional | ⬜ Pendente |
| A2 | 3 | Registo empresa + convite técnico + isolamento RLS | ⬜ Pendente |
| A3 | 6 | Fluxo gestor completo (tarefa, KPIs, histórico) | ⬜ Pendente |
| A4 | 8 | Intervenção no telemóvel ponta a ponta + Play Store | ⬜ Pendente |
| A5 | 9 | PDF RG Maintenance + exportação Excel diário | ⬜ Pendente |
| A6 | 10 | 1 dia testes com técnico real, sem bugs críticos | ⬜ Pendente |
| A7a | 12 | Subscrição Stripe + fatura processada | ⬜ Pendente |
| A7b | 12 | 1.º cliente externo na app — **LANÇAMENTO** | ⬜ Pendente |

### Fases e Calendário

| Fase | Nome | Semanas | Estado | Sessões Claude |
|---|---|---|---|---|
| Fase 0 | App Play Store Free | Sem. 10–11 (paralela F7) | ⬜ Pendente | 1 sessão |
| **Fase 1** | Setup & Base | Sem. 1–2 | 🔵 **EM CURSO** | 2 sessões |
| Fase 2 | Autenticação Multi-Tenant | Sem. 2–3 | ⬜ Pendente | 3 sessões |
| Fase 3 | Dashboard do Gestor | Sem. 3–6 | ⬜ Pendente | 6 sessões |
| Fase 4 | App Técnico PWA | Sem. 6–8 | ⬜ Pendente | 4 sessões |
| Fase 5 | PDF & Diário | Sem. 8–9 | ⬜ Pendente | 3 sessões |
| Fase 6 | Testes & Polimento | Sem. 9–10 | ⬜ Pendente | 2 sessões |
| Fase 7 | SaaS & Lançamento | Sem. 10–12 | ⬜ Pendente | 4 sessões |

**Total estimado:** ≈ 24 sessões Claude / ≈ 69 horas / ritmo recomendado: 2–3 sessões/semana

---

## 📁 FICHEIROS DE CÓDIGO CRIADOS (FASE 1)

Pasta: `G:\MANUTENÇÃO\MANUTENÇÃO\rg-maintenance\`

```
rg-maintenance/
├── .env.local.example          ← template de variáveis de ambiente
├── .gitignore
├── SETUP.md                    ← instruções de setup em 5 passos (~20 min)
├── next.config.ts
├── package.json                ← Next.js 15, Supabase, Tailwind, shadcn, lucide
├── postcss.config.js
├── tailwind.config.ts          ← paleta RG navy #1B4F72
├── public/
│   └── manifest.json           ← PWA manifest
├── supabase/
│   └── schema.sql              ← TODAS as tabelas + RLS policies + storage bucket
└── src/
    ├── middleware.ts            ← protecção de rotas (redireciona se não autenticado)
    ├── app/
    │   ├── globals.css          ← estilos globais + .btn-primary, .card, .input, .badge-*
    │   ├── layout.tsx           ← layout raiz + PWA metadata
    │   ├── page.tsx             ← redireciona → /login ou /dashboard
    │   ├── login/
    │   │   └── page.tsx         ← página de login com branding RG
    │   └── dashboard/
    │       ├── layout.tsx       ← auth guard + busca perfil do utilizador
    │       └── page.tsx         ← KPIs + tabela de tarefas recentes
    ├── components/
    │   └── layout/
    │       └── Sidebar.tsx      ← barra lateral responsiva (desktop + drawer mobile)
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts        ← createBrowserClient
    │   │   └── server.ts        ← createServerClient com cookies
    │   └── utils.ts             ← cn(), formatDate(), formatDateTime(), formatDuration()
    └── types/
        └── database.ts          ← tipos TypeScript completos de todas as tabelas
```

### Dependências instaladas (package.json)
```
next@15.1.0, react@19, @supabase/supabase-js@2.47, @supabase/ssr@0.5,
lucide-react, clsx, tailwind-merge, class-variance-authority, date-fns,
@radix-ui/* (dialog, dropdown-menu, label, select, slot, toast)
```

---

## 💰 MONETIZAÇÃO (DECISÕES FINAIS)

### Planos — preço por empresa (não por utilizador!)

| Plano | Preço | Técnicos | Diferencial competitivo |
|---|---|---|---|
| Free | €0 | 1 técnico | Play Store — porta de entrada |
| Starter | €19/mês | até 3 | MaintainX cobra €19/user — nós €19/empresa |
| Pro | €49/mês | até 8 | MaintainX cobra €49/user — nós €49/empresa |
| Business | €99/mês | até 20 | Facilities, multi-local |
| Enterprise | Sob consulta | Ilimitado | Grupos industriais |

**Vantagem principal:** preço por empresa, não por utilizador → 5 técnicos pagam €49/mês na RG Maintenance vs. €245/mês no MaintainX.

### Fase 0 — Play Store (decisão importante)
- A app gratuita (1 técnico) vai para a Play Store na **Semana 10–11**, não antes
- **Motivo:** o upgrade tem que estar operacional antes de captar utilizadores free. Publicar antes = utilizadores sem destino quando querem pagar
- Implementação: PWABuilder/TWA para empacotar a PWA como APK Android — custo único €25 (conta Google Play Developer, o Rui cria)
- iOS: a Apple não aceita PWA wrappers em 2026 — fica para versão futura React Native

### Concorrentes pesquisados
MaintainX (€0–49/user), Limble (€0–55/user), Fiix (€0–75/user), FreeMaint (100% grátis), Mobility Work (europeu, FR)

### Projecções
- Mês 3: MRR ≈ €337 (10 Starter + 3 Pro)
- Mês 12: MRR ≈ €7.385
- Mês 18: Break-even (~€14.000 MRR)
- Mês 24: ARR ≈ €300K (meta)
- Infra: < €100/mês (Supabase + Vercel + Resend)

---

## 🔄 COMO AVANÇAR ENTRE FASES

**Regra de ouro:** Claude nunca avança para a fase seguinte sem aprovação escrita do Rui.

Para avançar:
1. Rui testa o que foi entregue (URL, funcionalidade, etc.)
2. Rui escreve explicitamente "AX aprovado" (ex: "A1 aprovado")
3. Claude inicia a fase seguinte

Para pedir trabalho:
- "avança com a Fase X" → Claude gera o código completo dessa fase
- "actualiza o dashboard" → Claude actualiza o artefacto de monitorização
- "actualiza o vault" → Claude actualiza os ficheiros Obsidian

---

## 📦 VAULT OBSIDIAN

Pasta: `G:\MANUTENÇÃO\MANUTENÇÃO - VAULT\RG Maintenance\`

```
RG Maintenance/
├── 00 - Projeto Overview.md
├── 01 - Plano de Implementação.md
├── 02 - Cronograma.md
├── 03 - Ferramentas & Stack.md
├── 04 - Monetização.md
├── Assets/
│   └── README.md
├── Decisões/
│   └── Log de Decisões.md
├── Diário de Progresso/
│   └── 2026-06-08 - Sessão 1.md
└── Templates/
    └── Check-in Semanal.md
```

---

## 🤖 INSTRUÇÕES PARA O CLAUDE

### Regras fixas
1. **Língua:** sempre pt-PT. "ficheiro" não "arquivo", "ecrã" não "tela", "telemóvel" não "celular"
2. **Gates:** nunca avançar sem aprovação escrita do Rui
3. **Código:** guardar sempre em `G:\MANUTENÇÃO\MANUTENÇÃO\rg-maintenance\`
4. **Documentos Word:** usar a biblioteca `docx` do Node.js com `NODE_PATH=/usr/local/lib/node_modules_global/lib/node_modules`
5. **Vault:** os ficheiros .md do vault são escritos com `cat > "path" << 'EOF'` (heredoc bash) — o Write tool não alcança o caminho do vault
6. **Dashboard:** actualizar via `update_artifact` com id `maintenanceos-dashboard` sempre que gates ou fases mudam

### Quando o Rui diz...
- **"avança com a Fase X"** → gerar código completo, guardar em rg-maintenance/, apresentar ficheiros + instruções do que o Rui tem de fazer
- **"AX aprovado"** → actualizar dashboard (gate → done), actualizar vault, avançar para fase seguinte
- **"actualiza o plano"** → actualizar ficheiros Word e/ou vault Obsidian
- **"pesquisa X"** → fazer WebSearch antes de responder

### Stack de geração de documentos Word
```bash
NODE_PATH=/usr/local/lib/node_modules_global/lib/node_modules node script.js
```
- Cor hex precisa de 6 caracteres (ex: `"FAC000"` não `"FAC00"`) — erro frequente
- Output para `/sessions/happy-busy-hopper/mnt/MANUTENÇÃO/` ou subpastas

### Supabase — padrões de código
```typescript
// Server component
const supabase = await createClient()  // de @/lib/supabase/server
// Client component
const supabase = createClient()        // de @/lib/supabase/client
// RLS activa — queries filtram automaticamente por company_id do utilizador autenticado
```

---

## 📊 ESTADO ACTUAL (2026-07-09)

```text
Gate A0:  ✅ CONCLUÍDO — Nome RG Maintenance, logo, Vercel
Fases 1 a 6: 🟢 CÓDIGO CONCLUÍDO — Toda a lógica de Firebase Auth/Firestore, Dashboard Gestor, App PWA Técnico, Exportação PDF/Excel e Registo Multi-tenant está presente no código actual e funcional localmente. A lista completa de tarefas do Google Tasks foi auditada e já se encontra reflectida no código.
Gate A1:  ✅ CONCLUÍDO — App Vercel online e a responder correctamente (2026-07-09).
Gate A2 e A3: 🟡 PRONTOS PARA TESTE — Todo o código de registo de empresa e dashboard já está na produção. Aguardando testes do utilizador no Vercel.
```

**Próximo passo do Rui:** Como o Vercel já está online, testar a criação de uma conta (nova empresa) em `/register` e explorar o Dashboard. Se encontrar bugs, reportar para correção (Fase 6: Testes & Polimento).

---

## ⚠️ DECISÃO PENDENTE — BASE DE DADOS: Supabase → Firebase

**Atualização 2026-06-10:** O Rui decidiu mudar de **Supabase para Firebase**. Esta mudança:
- **AINDA NÃO foi implementada** — fica para uma tarefa dedicada no Obsidian (a criar pelo Rui)
- Implica reescrever: `supabase/schema.sql` → estrutura Firestore, `src/lib/supabase/*` → SDK Firebase, `src/types/database.ts`, `src/middleware.ts` (auth), e todas as queries RLS → Firestore Security Rules
- **Regra para o Claude:** NÃO avançar com criação de contas/projecto Supabase nem implementar a migração de stack até existir uma tarefa explícita no Vault sobre isto. O scaffold actual (Fase 1) continua válido como referência de UI/estrutura — só a camada de dados muda.

---

## 🗒 LOG DE DECISÕES IMPORTANTES

| # | Decisão | Contexto |
|---|---|---|
| 001 | Stack: Next.js + Supabase + Vercel | Vercel escolhido em vez de Netlify — SSR nativo |
| 002 | Nome: RG Maintenance | Confirmado pelo Rui; logo monograma navy fornecido |
| 003 | Domínio: a comprar mais tarde | Não bloqueante — Vercel liga em 5 min quando comprado |
| 004 | Multi-tenant: RLS na mesma DB | Escala a custo zero por novo cliente |
| 005 | Preço por empresa, não por utilizador | Vantagem competitiva face ao mercado americano |
| 006 | Fase 0 Play Store: Sem. 10–11 | Só após plataforma operacional — upgrade tem de funcionar |
| 007 | iOS App Store: adiado | Apple não aceita PWA wrappers em 2026 |
| 008 | Ficheiros antigos "MaintenanceOS" renomeados | Todos os ficheiros e vault agora dizem "RG Maintenance" |
| 009 | Código movido para `G:\rg-maintenance` | Path longo (`G:\MANUTENÇÃO\MANUTENÇÃO\...`) corrompia `npm install` do pacote `next` (limite 260 caracteres do Windows) |
| 010 | BD: Supabase → Firebase (⏳ pendente implementação) | Decisão de 2026-06-10; aguarda tarefa dedicada no Vault Obsidian — ver secção "DECISÃO PENDENTE" acima |
