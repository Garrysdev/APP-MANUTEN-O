# RG Maintenance — Regras do Projeto

Instruções específicas deste projeto. Lê antes de alterar UI ou lógica de
utilizadores/técnicos. Objetivo: não repetir correções a alterações não
pedidas.

## Regra de ouro

Só altera o que foi pedido. Uma correção a X não é licença para também
renomear/mover/"melhorar" Y ao lado, mesmo que pareça inconsistente. Se
achares que Y também devia mudar, diz e pergunta — não mudes.

## Convenções de UI já validadas (não reverter sem pedido explícito)

- **Linha de filtro por coluna**: em TODAS as tabelas principais (OTs,
  Plano de Manutenção, Inventário, Equipamentos) a linha de filtros
  fica **sempre visível** por baixo dos cabeçalhos — nunca escondida
  atrás de um botão "Filtros" que é preciso abrir primeiro.
- **Nome da coluna de pessoa responsável**: "TÉCNICO", nunca "EXECUTOR".
- **Projetos vs. Gráficos Gantt (Out/2026)**: duas páginas separadas,
  não uma só com toggle. `/dashboard/projects` (`ProjectsListClient.tsx`)
  é uma lista no mesmo padrão visual das OTs (chips de estado, filtros,
  cartões mobile, tabela+paginação); `/dashboard/gantt`
  (`GanttClient.tsx`, antigo `ProjectsClient.tsx` deslocado) é só o
  Gantt. Ligadas uma à outra por um link no cabeçalho de cada. O Gantt
  mostra **só Projetos** — nunca OTs normais nem barras sintéticas de
  Plano de Manutenção (essas ficam só no Calendário). Não voltar a
  juntar as duas numa só página nem a meter PM no Gantt sem pedido
  explícito.
- **Formulário de Projeto é diferente do de OT** (`CreateTaskModal`
  com `isProjectForm={true}`): sem Tipo de OT, Criticidade, Legal,
  seletor de FR/IT obrigatórias nem secção "Incluir no PM"; Equipamento
  não é obrigatório. `tipo` fica sempre fixo `'projeto'`
  (`parseProjectTask`, nunca lido do formulário). Não reintroduzir
  esses campos no form de Projetos sem pedido explícito.
- **`isProjectTask()`** (`src/lib/task-assignment.ts`) é a ÚNICA fonte
  de verdade sobre "isto é um Projeto" (usada por Projetos, Gantt, e o
  limite de plano de "Projetos abertos"). Usa só sinais estruturados
  (`source==='folha_projetos'`, `isProject===true`,
  `tipo in ('projeto','projecto','pr')`) — **nunca** voltar a adicionar
  correspondência por texto livre na descrição (`description.includes('projeto')`),
  já causou OTs normais a serem arrastadas para a lista de Projetos só
  por mencionarem a palavra no texto.
- **Datas da OT**: só dois campos de data pedidos no formulário —
  "Data Limite" (`dueDate`, opcional, sem relação com o Estado) e, só
  para o gestor, "Início da OT"/"Fim da OT" (`startedAt`/`completedAt`,
  editáveis à mão, não só carimbo). "Data Planeada" (`plannedStartDate`)
  deixou de ter campo no formulário — `parseTask`/`parseProjectTask` só
  gravam este campo quando vem preenchido por outra via (ex. arrastar
  uma barra no Gantt), nunca o apagam a null num guardar normal. **O
  Estado "Concluída" é derivado de `completedAt` estar preenchido**
  (não do Prazo/`dueDate`, que já causou um bug em que o Estado
  revertia sozinho para Pendente) — preencher/limpar "Fim da OT" muda
  o Estado automaticamente, nos dois sentidos, no cliente e no
  servidor.
- **"Concluir PM"**: fecha uma OT de PM **individualmente** (a que foi
  clicada). Nunca deve afetar/ocultar outras linhas — se isso
  acontecer é bug (ver secção de bugs conhecidos abaixo).

## Contas de teste — não confundir nem reatribuir

- **Gestor real**: Rui Garrido, `garrido.rui@gmail.com`,
  uid `nLqzaMwMu1OR4CKZzatjTlNBWt82`, abreviatura `RG`. É a ÚNICA conta
  que deve ser excluída das listas de atribuição de técnico.
- **Técnico de teste para telemóvel**: "RuiG", `tecnico@teste.rg`,
  uid `mWSsTRtgq5QcOHusTdVYgDVrwHt2`, abreviatura `RU`, ligado à
  Empresa UR (`companyId rjHNaSUbLm4qTMyKP0oX`). É a conta usada para
  testar notificações/push no telemóvel — tem de aparecer nas listas
  de técnicos internos e continuar ligada à Empresa UR.
- Existiam 10 registos "fantasma" duplicados `tech_RuiG_<companyId>` na
  coleção `users` (criados em lote a 13/08/2026, um por empresa de
  demo), todos com abreviatura errada "RG" e o da Empresa UR estava
  inativo — sobrepunham-se ao registo real na função `listUsers()`
  (mesmo email, ID diferente) e faziam a RuiG desaparecer das listas
  mesmo com o registo certo correto. Já apagados (11/09/2026). Se
  voltar a aparecer um utilizador "fantasma"/duplicado, verificar
  primeiro se há mais que um documento com o mesmo email em `users`
  antes de mexer no código de filtragem.
- **Nunca identificar "é o gestor real" por abreviatura sozinha**
  (ex.: `abbreviation === 'RG'`). Uma conta de técnico pode
  legitimamente ter essa sigla por engano e fica escondida das listas
  sem se perceber porquê (já aconteceu com a RuiG). Identificar sempre
  por nome (`includes('garrido')`), email (`garrido.rui@`) ou pelo uid
  exato acima.
- Correr `seed-test.js` (contas Free/Starter/Pro/Business/Enterprise)
  pode reatribuir a técnica RuiG para a empresa de demo "Pro" como
  efeito secundário — se isso acontecer, repor `companyId` para
  `rjHNaSUbLm4qTMyKP0oX`.
- A mesma seed criou uma conta de gestor "Enterprise" (uid
  `ue15A4DcVMRbstIEhrkny5Be42G3`, email `enterprise@teste.rg`, criada
  11/07/2026, inativa) com `companyId` da Empresa UR por engano em vez
  do seu próprio companyId de demo — o campo `name` está gravado como
  "Rui Garrido", fazendo a contagem de Gestores mostrar 2 em vez de 1.
  Excluída em `isCorruptOrMock` (`src/lib/firebase/data.ts`,
  18/09/2026) — não apagar o documento, só está oculta do `listUsers()`.
  Se aparecer uma 3ª conta "fantasma" de gestor, procurar outros
  registos `*@teste.rg` com `companyId: rjHNaSUbLm4qTMyKP0oX`.

## Padrões de dados a respeitar

- As coleções `tasks`, `maintenance_plans` e `internal_messages` têm
  uma camada de reserva em ficheiro JSON (`scripts/import/*.json`)
  além do Firestore. Qualquer função `listX(companyId)` **tem de
  fazer merge** Firestore + reserva — nunca tratar "o Firestore tem
  pelo mensó um documento" como "ignorar a reserva por completo". Isso
  já causou uma lista de 605 planos a cair para 1 assim que se editava
  um único registo.
- Ao iterar sobre `users` para procurar por nome (`.find(u =>
  u.name.toLowerCase()...)`), protege sempre com `(u.name || '')` —
  existem registos reais na coleção `users` sem campo `name` (ex.:
  `tech_LI`, inativo) e isto já causou o crash total da página de OTs.
- Nunca embutir passwords reais em código-fonte (bloqueado por um
  classificador de segurança do Claude Code, mas é regra do projeto
  de qualquer forma). Os botões de acesso rápido no login só
  pré-preenchem o email; a password escreve-se à mão.
- **Padrão de auto-reparação de `companyId` corrompido**: já aplicado
  em `updateMaintenancePlan` e, desde Out/2026, também em `updateTask`
  (`src/lib/firebase/data.ts`) — ao atualizar um documento cujo
  `companyId` gravado não bate com a empresa atual, só bloqueia se o
  documento não for um dos da camada de reserva *dessa própria
  empresa*; caso contrário repara o `companyId` na própria escrita
  (`ref.update({ ...data, companyId, ... })` — nunca omitir `companyId`
  do update). Sem isto, editar uma OT/plano importado com companyId
  corrompido "funcionava" sem erro mas a alteração desaparecia na
  leitura seguinte (filtrada por `where('companyId','==',...)`) —
  pareceu, para o utilizador, que a OT "revertia sozinha". Se
  aparecer um bug parecido noutra coleção com camada de reserva
  (`safety_rules`, `documents`, `stock_items`...), é provavelmente a
  mesma causa.
- **Cross-tenant**: ao fazer merge Firestore+reserva/fallback por
  `companyId`, nunca uses uma condição tipo `isDemoCompany(x.companyId)`
  sozinha (sem também exigir `x.companyId === companyId`) — já causou
  duas fugas reais (mensagens internas e utilizadores legados visíveis
  a QUALQUER empresa nova, não só à Empresa UR). Auditoria completa a
  todas as `listX()` feita em Out/2026 (ver histórico de commits), mas
  vale a pena revalidar sempre que se mexe num merge destes.

## Workflow de deploy usado nesta sessão

1. Commitar em `main`.
2. `git checkout master && git merge main --ff-only && git push origin master && git checkout main`
   (mantém `master` e `main` sincronizados — o Vercel segue `master`
   pela integração git, mas o deploy real é feito manualmente).
3. `npx vercel --prod --yes` a partir da raiz do projeto.
4. Correr `npx tsc --noEmit -p tsconfig.json` antes de cada commit
   grande — o build local no Windows é instável, mas o type-check é
   rápido e fiável.

## Variáveis de ambiente "Sensitive" no Vercel — não repetir este beco sem saída

As credenciais Firebase Admin (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY`) e as do Stripe (`STRIPE_SECRET_KEY`,
`STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, etc.) em produção no Vercel
estão marcadas **"Sensitive"** (ícone de cadeado no Dashboard, sem botão
de revelar). Isto significa: **`vercel env pull` e `vercel env ls` nunca
devolvem o valor real** (vem como string vazia `""`) — para ninguém,
nem para o dono do projeto, nem por CLI nem por UI. Já tentei várias
vezes nesta sessão (parsing manual, `node --env-file`, etc.) — não é
bug de parsing, é o valor mesmo vazio do lado do Vercel. **Não voltar a
tentar `vercel env pull` para obter estas chaves.**

Isto significa que a app FUNCIONA em produção com estas chaves (óbvio,
senão nada funcionava), mas **não há forma de as recuperar** a partir
daqui para correr scripts administrativos locais (seeds, migrações,
diagnóstico direto à BD). A única forma de voltar a ter a chave privada
do Firebase Admin é o Rui gerar uma **nova** no Firebase Console
(Definições do Projeto → Contas de Serviço → Gerar nova chave privada)
— gerar uma nova não invalida a antiga que já está em produção.

## Sistema de Planos & Limites (Out/2026)

Planos deixaram de ser só booleano (✅/❌ por funcionalidade,
`GATES` em `src/lib/plans.ts`) — agora também têm **limites numéricos
por recurso** (`LIMITS`, mesmo ficheiro): equipamentos, stocks,
armazéns, regras de segurança, mensagens/mês, planos de manutenção,
projetos abertos, Folhas de Registo (FR) e Instruções de Trabalho (IT).
Aplicados nas Server Actions de criação de cada recurso (mesmo padrão
em todas: contar os itens atuais da empresa, comparar com
`LIMITS[plan]`, bloquear com mensagem de upgrade se excedido — ver
`users/actions.ts` para o exemplo original, `maxUsers`). Itens
pré-definidos de fábrica (`DEFAULT_WAREHOUSE_IDS`,
`DEFAULT_SAFETY_RULE_IDS` em `data.ts`) não contam para o limite, só os
criados pela própria empresa. `reportsPerMonth` existe na config mas
**não está aplicado** — a página de Relatórios é um dashboard de
visualização, não um "criar N relatórios"; falta definir o que conta
como "1 relatório" antes de aplicar.

**Gestão Documental** (`/dashboard/documents`, Out/2026): Folhas de
Registo (FR) e Instruções de Trabalho (IT) passaram de 3+3 modelos
fixos no código (`AVAILABLE_FRS`/`AVAILABLE_ITS` em
`src/components/ui/TaskDocRequirements.tsx`) para documentos reais por
empresa (coleção `documents`, CRUD próprio). Os 3+3 antigos continuam
disponíveis como fallback (mesclados com os reais) até serem migrados
para documentos reais da Empresa UR com os mesmos IDs — **falta correr
esse script de seed/migração** (bloqueado pela questão das
credenciais "Sensitive" acima; usar a chave nova do Firebase quando o
Rui a gerar).

**Pendente**: preço Starter no Stripe (`STRIPE_PRICE_STARTER`) — o Rui
cria no Dashboard Stripe (modo Live, não a conta/área errada) e dá o
`price_...`; sem isso o botão "Subscrever Starter" na página de
billing devolve "Plano inválido" de forma controlada (não rebenta).

## Bugs conhecidos / contexto histórico

Ver `.claude` memory deste projeto (sessões anteriores) para o
histórico completo de bugs encontrados e corrigidos: esgotamento de
quota do Firestore, sino de notificações sem índice composto,
planos de manutenção a desaparecer, conta de técnico escondida, etc.
