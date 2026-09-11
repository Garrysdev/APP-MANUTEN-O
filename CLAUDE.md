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
- **Gantt**: existe uma vista de Gantt própria e completa só na página
  de Projetos (`ProjectsClient.tsx` / `GanttChartView`) — é para manter.
  Não voltar a adicionar checkboxes "Gantt" por linha nem filtros
  "Gantt" soltos noutras páginas (Plano de Manutenção, OTs, etc.).
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

## Workflow de deploy usado nesta sessão

1. Commitar em `main`.
2. `git checkout master && git merge main --ff-only && git push origin master && git checkout main`
   (mantém `master` e `main` sincronizados — o Vercel segue `master`
   pela integração git, mas o deploy real é feito manualmente).
3. `npx vercel --prod --yes` a partir da raiz do projeto.
4. Correr `npx tsc --noEmit -p tsconfig.json` antes de cada commit
   grande — o build local no Windows é instável, mas o type-check é
   rápido e fiável.

## Bugs conhecidos / contexto histórico

Ver `.claude` memory deste projeto (sessões anteriores) para o
histórico completo de bugs encontrados e corrigidos: esgotamento de
quota do Firestore, sino de notificações sem índice composto,
planos de manutenção a desaparecer, conta de técnico escondida, etc.
