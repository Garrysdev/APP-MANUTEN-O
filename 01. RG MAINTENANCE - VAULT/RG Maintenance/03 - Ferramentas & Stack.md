---
tags: [maintenanceos, stack, ferramentas, tecnologia]
ultima_atualizacao: 2026-06-08
---

# 🛠️ Ferramentas & Stack Técnica

[[00 - Projeto Overview|← Overview]]

## Estado de Configuração

| Ferramenta | Função | Estado | Conta/URL | Notas |
|------------|--------|--------|-----------|-------|
| **Supabase** | Backend, DB, Auth | ⬜ Por criar | — | Criar em supabase.com — grátis |
| **GitHub** | Código-fonte | ⬜ Por criar | — | Criar em github.com — grátis |
| **Vercel** | Hosting / Deploy | ⬜ Por criar | — | Criar em vercel.com — grátis |
| **Next.js** | Framework web | ⬜ Por instalar | — | Claude trata do setup |
| **Tailwind CSS** | Estilos UI | ⬜ Por instalar | — | Claude trata do setup |
| **shadcn/ui** | Componentes UI | ⬜ Por instalar | — | Claude trata do setup |
| **React-PDF** | Geração de PDF | ⬜ Por instalar | — | Claude trata do setup |
| **Stripe** | Pagamentos SaaS | ⬜ Por criar | — | Só na Fase 7 |
| **Resend** | E-mail transacional | ⬜ Por criar | — | resend.com — grátis até 3k/mês |
| **Claude (Cowork)** | Desenvolvimento | ✅ Ativo | Sessão atual | Gera e revê código |

---

## Legenda

| Símbolo | Estado |
|---------|--------|
| ⬜ | Por criar/instalar |
| 🔵 | Em configuração |
| ✅ | Operacional |
| ⚠️ | Com problema |
| ❌ | Substituído |

---

## Decisões de Stack

### Por que Supabase em vez de Firebase?
- PostgreSQL (relacional) é mais adequado para dados estruturados de manutenção
- Open-source e mais barato a escalar
- Autenticação built-in com Row Level Security (RLS)

### Por que PWA em vez de app nativa (React Native)?
- Não requer submissão à App Store / Google Play
- Uma única base de código para PC, iOS e Android
- Updates instantâneos sem aprovação de loja
- Funciona offline com Service Workers

### Por que Vercel em vez de servidor próprio?
- Deploy automático a cada commit no GitHub
- CDN global incluído
- Zero configuração de servidor
- Plano gratuito suficiente para 12 meses

---

## Dependências e Versões

> A preencher quando o projeto for iniciado (Fase 1)

```json
{
  "framework": "Next.js 15+",
  "database": "Supabase (PostgreSQL 15)",
  "ui": "Tailwind CSS 3 + shadcn/ui",
  "pdf": "React-PDF 4+",
  "payments": "Stripe (Fase 7)",
  "email": "Resend"
}
```

---

## Custos Mensais Estimados

| Serviço | Plano | Custo/mês | Limite |
|---------|-------|-----------|--------|
| Supabase | Free | 0€ | 500 MB DB, 50k utilizadores |
| Vercel | Hobby | 0€ | 100 GB bandwidth |
| Resend | Free | 0€ | 3.000 e-mails |
| GitHub | Free | 0€ | Repositórios privados ilimitados |
| Stripe | Pay-as-go | ~1,4% + 0,25€/tx | — |
| **Total** | — | **0€** | Até ao primeiro cliente pago |
