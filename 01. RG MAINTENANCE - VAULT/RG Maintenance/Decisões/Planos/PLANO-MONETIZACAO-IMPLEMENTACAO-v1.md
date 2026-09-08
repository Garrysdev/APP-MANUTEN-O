---
titulo: Plano de Monetização Integrado — RG Maintenance
versao: "1.0"
data: 2026-06-12
estado: 🟡 Aguarda aprovação do Rui
substitui_execucao_de:
  - (nenhum — primeiro plano de monetização e implementação integrado deste projeto)
mantem_valido:
  - "[[04 - Monetização]] — Modelo de negócio (SaaS), Planos e Preços (Starter/Pro/Business/Enterprise), Concorrência, Canais de Aquisição, KPIs de negócio e Roadmap v2.0 (mantêm-se como referência de catálogo/visão)"
  - "[[01 - Plano de Implementação]] e [[02 - Cronograma]] — cronograma técnico de Fases 1-7 (Sem. 1-12) e gates A0-A7b, que este plano não substitui, apenas referencia/coordena"
tags: [rg-maintenance, monetizacao, plano-integrado]
---

# Plano de Monetização Integrado — RG Maintenance
## Do Catálogo ao Primeiro Cliente Pago — Roadmap de Execução

---

## Resumo Executivo (30 segundos)

- **O quê:** este plano transforma o catálogo de preços e a visão de monetização já definidos em
  [[04 - Monetização]] num **roadmap de execução concreto** — que ações administrativas,
  técnicas e comerciais são precisas, por quem, e quando, para passar de "0 clientes" a "primeiro
  cliente pago" e manter a operação legal/fiscal em ordem ao longo do caminho.
- **Quem aparece / quem está envolvido:** o Rui é o rosto comercial junto da sua rede de
  contactos (Canal 1 de [[04 - Monetização]]) — é o único produto/projeto do Rui onde há
  presença pessoal estruturalmente necessária (venda B2B a empresas de manutenção/facilities
  requer confiança/relação). Claude trata de tudo o resto: código, conteúdos, configuração de
  plataformas, materiais de venda.
- **Quem executa:** Claude (desenvolvimento do produto, conforme [[01 - Plano de Implementação]]
  e [[02 - Cronograma]]) + automações já existentes, nos turnos noturnos (00h-07h, AG-07).
- **O que o Rui faz:** aprova este plano + executa ~9 ações pontuais (a maioria administrativas,
  ~15-20 min cada) distribuídas ao longo das Fases já existentes, mais o esforço comercial do
  Canal 1 (fora do âmbito deste plano — é trabalho de negócio do Rui, não de Claude). Tempo total
  estimado de ações **novas** introduzidas por este plano: **~3h** (ver secção 8).
- **Resultado (Ano 1):** produto em produção (Fase 7 concluída), catálogo SaaS publicado
  (Starter/Pro/Business/Enterprise), faturação automatizada via Stripe operacional, e cenário
  conservador de **~10 clientes Pro pagos aos 6 meses** (~290€/mês de MRR), conforme já projetado
  em [[04 - Monetização]].
- **Próximo passo:** o Rui aprova este documento → Claude regista a aprovação em
  [[../Log de Decisões|Log de Decisões]] e integra os checkpoints financeiros (secção 5) no
  cronograma técnico já em curso (Fase 1, em curso esta semana).

---

## 1. Porquê este plano

[[04 - Monetização]] já define **o quê vender** (4 planos SaaS, 29-199€/mês), **a quem** (indústria,
hotelaria, facilities, construção, hospitais, câmaras), **como adquirir clientes** (4 canais) e
**projeções de receita** (450€/mês conservador aos 6 meses). Esse documento mantém-se válido na
íntegra como catálogo e visão de negócio — **não é repetido aqui**.

O que faltava era ligar essa visão ao que está a acontecer agora no projeto:

- O [[02 - Cronograma]] mostra que o projeto está na **Fase 1 (Setup & Base)**, com a Fase 7
  ("SaaS & Lançamento", onde entra Stripe + onboarding de clientes) prevista só para a Sem. 10-12.
  Sem coordenação, há o risco de chegar à Fase 7 sem a parte administrativa/fiscal pronta
  (atividade aberta nas Finanças, conta Stripe configurada), o que atrasaria o "primeiro cliente
  externo" — exatamente o gate A7b.
- Existe agora um **Estudo Financeiro partilhado** entre todos os projetos do Rui
  (`G:\_CLAUDE 2026\00. TEMPLATES\Estudo-Financeiro-Portugal-Digital.md`, concluído 2026-06-12)
  que sistematiza os passos legais/fiscais por marco de receita — este plano traduz esses marcos
  para o calendário concreto do RG Maintenance (secção 5).
- O padrão "Plano de Monetização e Implementação Integrado" foi aprovado pelo Rui para o
  EneaSpirit (v1, 2026-06-11) como formato reutilizável **"para qualquer um dos seus
  projetos"** — este é a primeira aplicação desse formato ao RG Maintenance.

**O que se mantém válido e não é repetido:**
- [[04 - Monetização]] — planos e preços, projeções, concorrência, canais de aquisição, KPIs,
  roadmap v2.0.
- [[01 - Plano de Implementação]] e [[02 - Cronograma]] — as 7 fases técnicas, gates A0-A7b,
  semanas 1-12. Este plano **não cria um cronograma paralelo**; integra-se no já existente.

---

## 3. Catálogo de Produtos / Ofertas

### 3.1 Tipos de produto/oferta

| # | Produto/Oferta | Formato | Preço | Quem produz | Envolvimento do Rui |
|---|---|---|---|---|---|
| 1 | Plano **Starter** | SaaS, subscrição mensal (grátis) | 0€ | Claude (produto já especificado) | Nenhum — self-service |
| 2 | Plano **Pro** ⭐ | SaaS, subscrição mensal | 29€/mês | Claude | Nenhum — self-service via Stripe |
| 3 | Plano **Business** | SaaS, subscrição mensal | 79€/mês | Claude | Nenhum — self-service via Stripe |
| 4 | Plano **Enterprise** | SaaS + onboarding assistido + formação | 199€+/mês | Claude (produto) + Rui (onboarding/formação) | Alto — única oferta com serviço presencial/remoto incluído |
| 5 | Programa de Parcerias (revenda) | Comissão 20% para empresas de manutenção industrial | — | Claude (materiais de parceiro) | Médio — negociação inicial de cada parceiro (Canal 4, meses 6+) |

> Tabela completa de planos/preços/funcionalidades já existe em [[04 - Monetização]] ("Planos e
> Preços") — não repetida aqui.

### 3.2 Catálogo detalhado — Produto ↔ Fase de desenvolvimento ↔ Pré-requisito de venda

| Produto | Depende de (fase técnica) | Pré-requisito comercial/legal | Pode vender a partir de |
|---|---|---|---|
| Starter (grátis) | Fase 2 (Autenticação multi-tenant) concluída | Nenhum — não gera faturação | Fase 2 (lead magnet / trial) |
| Pro / Business | Fase 3-6 concluídas (Dashboard + PWA + PDF/Diário + Testes) | Atividade independente aberta + Stripe configurado (ver secção 5) | Fase 7 (gate A7a) |
| Enterprise | Fase 6 concluída + capacidade de onboarding/formação | Idem Pro/Business + disponibilidade do Rui para onboarding | Fase 7, após primeiros clientes Pro validados |
| Programa de Parcerias | Produto estável (pós-Fase 7) | Contrato/acordo de comissão por parceiro | Mês 6+ (conforme Canal 4 de [[04 - Monetização]]) |

---

## 4. Funil de Monetização Integrado

```
[Rede de contactos do Rui — Canal 1]      [SEO/Conteúdo — Canal 2]      [LinkedIn — Canal 3]
              │                                     │                          │
              └──────────────────┬──────────────────┴──────────────────────────┘
                                  ▼
                     Trial gratuito 30 dias (Plano Starter)
                          sem cartão de crédito
                                  │
                        ┌─────────┴─────────┐
                        ▼                   ▼
                  Conversão paga       Sem conversão
                  (meta >30%)          (nutrir via conteúdo/SEO)
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
            Pro ⭐   Business   Enterprise
          (29€/mês) (79€/mês)  (199€+/mês, c/ onboarding Rui)
                        │
                        ▼
            Parceiros revendedores (Canal 4, mês 6+)
              comissão 20% → novos trials
```

Este funil é o mesmo já descrito nos "Canais de Aquisição" de [[04 - Monetização]] — a novidade
deste plano é **ligar a entrada no funil (trial) à infraestrutura de cobrança (secção 5)**: o
trial de 30 dias sem cartão só é credível se, no fim desses 30 dias, existir um checkout Stripe
funcional para converter — daí a importância de ter a Fase 7 e o checkpoint financeiro #6
(secção 5) alinhados.

---

## 5. Financeiro — Faturação, Impostos e Plataformas de Pagamento

> **Resumo, não duplicação** — fonte completa:
> `G:\_CLAUDE 2026\00. TEMPLATES\Estudo-Financeiro-Portugal-Digital.md` (documento partilhado
> entre todos os projetos do Rui — EneaSpirit, RG Maintenance, FinBot, FWG). Esta secção resume os
> pontos relevantes para o RG Maintenance e liga-os ao cronograma técnico de
> [[02 - Cronograma]] como **checkpoints transversais de custo-zero de tempo de Claude** — ações
> administrativas pontuais do Rui (~15-20 min cada, na maioria gratuitas) que precisam de
> acontecer antes de certos marcos de receita, sem consumir noites AG-07 de desenvolvimento.

### 5.1 Marcos de Receita Relevantes para o RG Maintenance

| # | Marco | Ação (ver Estudo Financeiro secção 7) | Quando no RG Maintenance |
|---|---|---|---|
| 1 | **Antes da 1ª venda (€0)** | Abrir atividade independente nas Finanças (gratuito, ~15 min online), código de atividade "outras prestações de serviços" (coeficiente 0,35) | **Antes do gate A7a** (Stripe + 1ª subscrição de teste) — pode ser feito em paralelo com qualquer fase anterior, sem pressa |
| 2 | **Confirmar isenção de IVA (art. 53º)** | Isenção até **€15.000/ano** — não cobrar IVA enquanto faturação ≤ esse valor. No cenário conservador (~450€/mês ≈ 5.400€/ano), o RG Maintenance fica confortavelmente dentro da isenção no Ano 1 | Confirmar no mesmo passo do marco 1 |
| 3 | **Confirmar regime simplificado de IRS** | Coeficiente **0,35**, reduzido a **0,175 no 1º ano** (50%) — relevante para o cálculo de margem das projeções (secção 10) | Confirmar no mesmo passo do marco 1 |
| 4 | **Isenção de Segurança Social — primeiros 12 meses** | Automática, sem pedido, se for a 1ª vez (sem atividade independente nos últimos 3 anos) | A partir da abertura de atividade (marco 1) |
| 5 | **1ª venda realizada (1º cliente Pro pago)** | Emitir 1ª fatura via Recibos Verdes (Portal das Finanças, gratuito); confirmar que não há retenção na fonte (clientes B2B portugueses sem contabilidade organizada / clientes via Stripe internacional, geralmente sem retenção) | **Gate A7b** — primeiro cliente externo |
| 6 | **Receita mensal recorrente (várias subscrições/mês via Stripe)** | Migrar de Recibos Verdes manuais para **software de faturação certificado integrado com Stripe** — recomendação: **InvoiceXpress** (pay-per-document) | A partir de ~5-10 clientes Pro ativos (cenário conservador de [[04 - Monetização]], ~6 meses) |
| 7 | **Faturação a aproximar-se de €15.000/ano** | Monitorizar total faturado; planear regime normal de IVA + avaliar OSS se houver clientes B2C noutros países da UE | Só relevante se o cenário **médio/otimista** de [[04 - Monetização]] (1.900-4.720€/mês) se concretizar — vigilância a partir do cenário médio (12 meses) |
| 8 | **Faturação ultrapassa €15.000/ano** | Regime normal de IVA (23%) + OSS + Stripe Tax | Condicional — só no cenário otimista do Ano 2 |
| 9 | **Fim do 1º ano de atividade** | Termina isenção de SS; coeficiente IRS passa de redução 50% para 25% | Marco de calendário a partir da data de abertura (marco 1) — bom momento para revisão de margens face às projeções da secção 10 |

> Marcos adicionais (3º ano, limiar €29.748, transição para ENI/Lda) — ver Estudo Financeiro
> secções 6-7, não relevantes no horizonte deste plano (Ano 1).

### 5.2 Plataformas — Recomendação para o RG Maintenance

Conforme Estudo Financeiro secção 5.1, e alinhado com a stack já definida em
[[03 - Ferramentas & Stack]] (Stripe já listado como "Pagamentos SaaS — só na Fase 7"):

- **Stripe** confirma-se como a plataforma de cobrança correta — suporta subscrições
  recorrentes (essencial para o modelo SaaS mensal Starter/Pro/Business/Enterprise), comissões
  competitivas, e caminho natural para Stripe Tax se/quando o RG Maintenance sair da isenção de
  IVA (marco 8, cenário otimista Ano 2).
- **InvoiceXpress** como software de faturação a integrar com Stripe **quando o volume se tornar
  recorrente** (marco 6 — coincide com ~5-10 clientes Pro ativos). Até esse ponto, **Recibos
  Verdes manuais** (gratuitos) são suficientes — a baixa frequência inicial (poucos clientes nos
  primeiros meses) não justifica o custo/setup do InvoiceXpress desde o dia 1.
- **MB WAY** — não prioritário: o público-alvo do RG Maintenance é B2B (empresas que pagam por
  cartão/transferência via Stripe Checkout), pelo que o checkout Stripe padrão é suficiente.
- **Hotmart/Kiwify** — não aplicáveis a este projeto (modelo de subscrição B2B SaaS, não produtos
  digitais avulsos/lusófonos).

### 5.3 Integração no Cronograma — Checkpoints Transversais

Os 9 marcos acima **não são fases novas** nem alteram [[02 - Cronograma]] — são checkpoints
administrativos pontuais (cada um ~15-20 min, maioria gratuitos) que o Rui pode fazer em paralelo
com qualquer fase técnica em curso. Ver secção 7 para os pontos exatos de inserção (marcados com
💶).

---

## 6. Plataformas / Canais de Venda

| Plataforma/Canal | Para quê | Porquê (encaixa no modelo) | Ação única do Rui |
|---|---|---|---|
| **Stripe Checkout** | Cobrança de subscrições Pro/Business/Enterprise | Suporta planos recorrentes, integra com Next.js/Vercel já usados | Criar conta Stripe (gratuita) — checkpoint 💶 #1, secção 7 |
| **Landing page (Vercel, já no stack)** | Apresentação do produto + início de trial | Já incluído na Fase 7 de [[01 - Plano de Implementação]] | Nenhuma — Claude implementa |
| **LinkedIn (perfil do Rui)** | Canal 3 de [[04 - Monetização]] — casos de sucesso, demos | Audiência B2B (gestores de facilities/manutenção) já alinhada com o público-alvo | Publicar/partilhar conteúdos preparados por Claude (~15 min/semana, a partir da Fase 7) |
| **Rede de contactos direta (Canal 1)** | Primeiros 5 clientes | É o único canal que requer presença pessoal do Rui — relação de confiança B2B | Esforço comercial do Rui (fora do âmbito de tempo deste plano — ver nota na secção 8) |
| **Parceiros revendedores (Canal 4)** | Distribuição via empresas de manutenção industrial | Comissão 20% já definida em [[04 - Monetização]] | Negociação inicial por parceiro (mês 6+, fora do âmbito imediato) |

---

## 7. Cronograma — Checkpoints Financeiros Integrados em [[02 - Cronograma]]

> Este plano **não introduz um cronograma paralelo**. [[02 - Cronograma]] já define as 7 fases
> técnicas (Sem. 1-12) e os gates A0-A7b. A tabela abaixo mostra **apenas os checkpoints novos**
> (💶, administrativos, do Rui) a inserir nesse cronograma já existente — sem consumir noites
> AG-07 de Claude.

| Checkpoint | Marco financeiro (secção 5.1) | Quando inserir | Tempo Rui | Bloqueia alguma fase? |
|---|---|---|---|---|
| 💶 #1 | Abrir atividade independente + confirmar isenção IVA/IRS/SS (marcos 1-4) | Pode ser feito desde já, em paralelo com a Fase 1 (em curso) — sem pressa, mas recomenda-se concluir antes do gate A7a | ~15 min | Não bloqueia Fases 1-6; **bloqueia gate A7a** se não estiver feito |
| 💶 #2 | Criar conta Stripe (gratuita) | Em paralelo com a Fase 6 (Testes & Polimento, Sem. 9-10) — antes do início da Fase 7 | ~10 min | Bloqueia gate A7a se não existir |
| 💶 #3 | 1ª fatura via Recibos Verdes (marco 5) | No momento do gate A7b (primeiro cliente externo) | ~10 min | Não bloqueia — é consequência do gate, não pré-requisito |
| 💶 #4 | Avaliar migração para InvoiceXpress (marco 6) | Após atingir ~5-10 clientes Pro ativos (pós-lançamento, fora da janela de 12 semanas) | ~20 min (decisão + configuração inicial) | Não bloqueia — melhoria operacional |

**Nota sobre contenção:** estes 4 checkpoints somam **~55 min pontuais** do Rui, distribuídos ao
longo de ~10 semanas já planeadas — não introduzem nenhuma noite AG-07 adicional de Claude além
do que já está em [[02 - Cronograma]] para a Fase 7 (integração Stripe, que já estava prevista).

---

## 8. O Que o Rui Precisa de Fazer (Total: ~3h, distribuído ao longo das Fases 1-7)

| # | Ação | Quando | Tempo | Tipo |
|---|---|---|---|---|
| 1 | Aprovar este plano | Agora | 5 min | Decisão |
| 2 | 💶 Abrir atividade independente nas Finanças + confirmar isenções IVA/IRS/SS (checkpoint #1) | Em paralelo com Fase 1 (sem pressa, antes do gate A7a) | 15 min | Ação única |
| 3 | 💶 Criar conta Stripe (gratuita) (checkpoint #2) | Antes do início da Fase 7 (em paralelo com Fase 6) | 10 min | Ação única |
| 4 | Decisão #003 já pendente: domínio, lançamento interno vs SaaS desde o início, nº técnicos previstos (já registada em [[../Log de Decisões|Log de Decisões]] — não duplicada, apenas relembrada aqui por afetar o catálogo de venda da secção 3) | Não bloqueia Fases 1-6; recomenda-se antes da Fase 7 | já registada — só responder | Decisão |
| 5 | 💶 1ª fatura via Recibos Verdes (checkpoint #3) | No gate A7b (primeiro cliente externo) | 10 min | Ação única |
| | **Subtotal pontual (ações novas deste plano)** | | **~30 min** | |
| 6 | Esforço comercial do Canal 1 (rede de contactos — primeiros 5 clientes) | Meses 1-3, conforme [[04 - Monetização]] | Variável — esforço de negócio do Rui, **não contabilizado em "noites AG-07"** porque não é trabalho de Claude | Rotina (negócio) |
| 7 | Revisão do Check-in Semanal já existente ([[../../Templates/Check-in Semanal|Templates/Check-in Semanal]]) | Semanal, a partir da Fase 1 | ~15 min/semana | Rotina (já existente, não criada por este plano) |
| | **Subtotal rotina (já existente, apenas referenciado)** | | **~15 min/semana** | |

> Nota: o "Subtotal pontual" reflete apenas as ações **administrativas/fiscais novas** que este
> plano introduz (~30 min). A ação #6 (esforço comercial do Canal 1) é trabalho de negócio do Rui
> já previsto em [[04 - Monetização]] — incluída aqui por completude, mas sem estimativa de
> tempo porque não é executável por Claude nem substituível por automação.

---

## 9. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Chegar ao gate A7a (Stripe + 1ª subscrição) sem a atividade independente aberta nas Finanças, bloqueando a emissão da 1ª fatura ao primeiro cliente | Checkpoint 💶 #1 (secção 7) recomendado em paralelo com a Fase 1, muito antes de ser necessário — gratuito e demora 15 min, sem custo de oportunidade |
| Cenário SaaS multi-tenant implica que dados de clientes diferentes (potencialmente concorrentes entre si — ex. duas empresas de facilities) partilham a mesma base de dados | [[02 - Cronograma]] já especifica RLS (Row Level Security) por `company_id` — este plano não altera essa arquitetura, apenas confirma que é o controlo correto antes de aceitar o 1º cliente pago externo (gate A2 já testa isolamento de dados) |
| Plano Enterprise (199€+) inclui "formação" e "suporte dedicado" — única oferta com componente presencial/serviço do Rui; risco de sobrecarregar o Rui se houver vários clientes Enterprise simultâneos antes de haver capacidade | Não vender Enterprise ativamente até existirem ≥2-3 clientes Pro/Business estáveis e validados (sequência natural do funil, secção 4) — Enterprise é "upsell" pós-validação, não foco do lançamento inicial |
| Cenário otimista de [[04 - Monetização]] (4.720€/mês aos 18 meses) ultrapassaria o limiar de isenção de IVA (€15.000/ano) durante o Ano 2 | Checkpoint financeiro #7-8 (secção 5.1) já identifica este marco como "vigilância a partir do cenário médio" — ação só necessária se a receita real se aproximar desse cenário, sem custo antecipado |
| Concorrência (Limble, UpKeep, Fracttal) com produtos maduros — risco de feature gap percebido | Já mitigado pela proposta de valor de [[04 - Monetização]] (preço 5x mais baixo + PT + suporte local); este plano não altera essa estratégia, apenas garante que a parte de cobrança/legal não é o gargalo quando a proposta de valor já está pronta |

---

## 10. Projeções de Receita

As projeções de receita (cenários Conservador/Médio/Otimista, tabela completa com clientes
Pro/Business/Enterprise por prazo) já estão definidas em [[04 - Monetização]] ("Projeções de
Receita") e **não são repetidas nem alteradas aqui** — este plano não introduz novos números, só
confirma a sua viabilidade fiscal:

| Cenário ([[04 - Monetização]]) | Receita/mês | Implicação fiscal (Estudo Financeiro) |
|---|---|---|
| Conservador (6 meses) | ~450€/mês (~5.400€/ano) | Dentro da isenção de IVA (€15.000/ano) — regime simplificado IRS com redução de 50% no Ano 1 aplica-se integralmente |
| Médio (12 meses) | ~1.900€/mês (~22.800€/ano) | Ultrapassa €15.000/ano — gatilho para checkpoint #7/8 (regime normal de IVA + possível OSS), a confirmar com TOC quando este cenário se aproximar |
| Otimista (18 meses) | ~4.720€/mês (~56.640€/ano) | Bem acima do limiar de isenção — nesta fase, avaliar com TOC transição para ENI/Lda (Estudo Financeiro secção 6), conforme volume e necessidade de proteção patrimonial |

> Nota de conservadorismo: tal como já assumido em [[04 - Monetização]], o cenário Conservador é
> o que orienta a decisão sobre o checkpoint #1 (abrir atividade) — mesmo nesse cenário, a
> isenção de IVA cobre confortavelmente o Ano 1, pelo que **não há urgência fiscal** em abrir a
> atividade antes do gate A7a, apenas conveniência (evitar bloqueio no momento da 1ª venda).

---

## 11. Próximo Passo

1. O Rui aprova este documento (ação #1 da secção 8).
2. Claude regista a aprovação em [[../Log de Decisões|Log de Decisões]] (nova entrada, tipo
   "Aprovação de plano") e integra os 4 checkpoints financeiros da secção 7 como notas no
   [[02 - Cronograma]] (sem alterar a estrutura de fases/gates já existente).
3. O checkpoint 💶 #1 (abrir atividade independente) pode ser feito pelo Rui em qualquer momento
   a partir de agora, em paralelo com a Fase 1 em curso — sem necessidade de aguardar qualquer
   gate.

---

*v1.0 — 2026-06-12. Primeiro plano de monetização e implementação integrado do RG Maintenance —
traduz o catálogo já definido em [[04 - Monetização]] num roadmap de execução coordenado com
[[02 - Cronograma]] e com o Estudo Financeiro partilhado. Aguarda aprovação.*
