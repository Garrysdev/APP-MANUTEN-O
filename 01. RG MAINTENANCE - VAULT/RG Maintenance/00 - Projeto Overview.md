---
projeto: RG Maintenance
nome_app: "RG Maintenance"
versao: "1.0"
inicio: 2026-06-08
estado: "🟢 Fase 1 em curso — Gate A1 pendente (deploy online)"
gestor: Rui Garrido
logo: "Logo RG Maintenance fornecido (azul navy + monograma RG)"
cor_principal: "#1B4F72"
tags: [rg-maintenance, projeto, overview]
---

# ⚙️ RG Maintenance — Visão Geral do Projeto

> Sistema Multiplataforma de Gestão de Manutenção

## Identidade Visual

- **Nome:** RG Maintenance
- **Logo:** Monograma RG em azul navy com tagline "Maintenance"
- **Cor principal:** #1B4F72 (azul navy — confirmado no logo)
- **Referência de design:** Mockup fornecido pelo Rui (app mobile dark navy)

## Resumo

Aplicação profissional de registo e gestão de intervenções de manutenção, com:
- **Dashboard PC** para gestores (KPIs, ordens de trabalho, relatórios)
- **App móvel PWA** para técnicos (iniciar/concluir, observações, materiais, fotos)
- **Login individual** por técnico e gestor
- **Diário de manutenção** automático
- **Relatórios PDF** com cabeçalho RG Maintenance

## Referência de Design (Mockup)

Screens identificados no mockup do Rui:
- Dashboard com Key Performance (métricas financeiras + operacionais)
- Service Requests com categorias (Report Items, Service Requests, Events)
- Formulário "Create New Report" (nome, datas)
- PDF com cabeçalho RG Maintenance (nome projeto, empresa, inspector)
- Reports screen com filtro, data, mensagem e envio
- Navegação: Home / Reports / Reports / Settings + botão FAB +

## Índice do Projeto

| Nota | Descrição |
|------|-----------|
| [[01 - Plano de Implementação]] | Fases, objetivos e entregáveis |
| [[02 - Cronograma]] | Estado atual de cada fase e gates de aprovação |
| [[03 - Ferramentas & Stack]] | Tecnologias e estado de configuração |
| [[04 - Monetização]] | Planos, preços e projeções |
| [[Diário de Progresso/2026-06-08 - Sessão 1]] | Sessão 1 — plano e branding aprovados |
| [[Diário de Progresso/2026-06-10 - Sessão 2]] | Sessão 2 — Fase 1 a correr localmente |
| [[Diário de Progresso/2026-06-10 - Sessão 3]] | Sessão 3 — Setup global Claude Code (hooks, Playwright) |
| [[Decisões/Log de Decisões]] | Registo de decisões e aprovações |
| [[Templates/Check-in Semanal]] | Modelo para o check-in semanal |

## Estado Atual

```
Semana:    1 de 12
Fase:      Fase 1 — Setup & Base (em curso)
Progresso: █░░░░░░░░░  ~8%
Próximo:   Gate A1 — Rui cria contas (GitHub/BD/Vercel) e faz deploy online
```

## KPIs de Progresso

| Indicador | Valor |
|-----------|-------|
| Fases concluídas | 0 / 7 (Fase 1 em curso) |
| Gates aprovados | 1 / 9 (A0) |
| Semanas decorridas | 1 / 12 |
| Última atualização | 2026-06-10 |

## Gate A0 — Estado

- [x] Nome do produto: **RG Maintenance** ✅
- [x] Logo fornecido ✅
- [x] Stack técnica aprovada ✅
- [x] Fase 0 (planeamento) concluída → Fase 1 iniciada ✅

**Gate A0 considerado concluído** — o código avança independentemente. As 3 questões de negócio abaixo continuam em aberto (ver [[Decisões/Log de Decisões|Decisão #003]]) mas não bloqueiam a Fase 1:
- [ ] Domínio preferido (ex: rgmaintenance.pt)?
- [ ] Início: uso interno primeiro ou SaaS desde o início?
- [ ] Quantos técnicos prevê ter nos primeiros 3 meses?

## Links Rápidos

- 📄 `RGMaintenance_Plano_Implementacao.docx` (em `G:\MANUTENÇÃO\MANUTENÇÃO\`)
- 📄 `RGMaintenance_Cronograma_Detalhado.docx` / `RGMaintenance_Cronograma_Ferramentas.docx`
- 📄 `RGMaintenance_Plano_Monetizacao.docx`
- 📄 `RGMaintenance_Contexto_Claude.md` — contexto técnico completo para sessões Claude
- 📄 `HANDOFF - CLAUDE_CLI.md` — ponto de entrada para sessões Claude CLI
- 💻 Código: `G:\rg-maintenance\` (Next.js, a correr em `localhost:3000`)
- 🔗 [Vercel](https://vercel.com) — hosting (criar conta)
- 🔗 [GitHub](https://github.com) — código-fonte (criar conta)
- ⚠️ Base de dados: decisão pendente Supabase → Firebase (ver Decisão #010)
