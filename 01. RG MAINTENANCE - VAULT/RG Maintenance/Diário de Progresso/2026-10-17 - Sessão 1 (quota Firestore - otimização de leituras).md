---
data: 2026-10-17
projeto: RG Maintenance (CMMS)
tags: [diario, rg-maintenance, firestore, quota, performance, backup]
sessao: diurna
---

# 2026-10-17 — Quota do Firestore: análise de custos e otimização de leituras

## Contexto

A quota grátis do Firestore (Spark, 50 mil leituras/dia) esgotava com frequência. A
consola mostrou, de 10 a 17 de outubro: 197 mil leituras (média de ~28 mil por dia,
picos de 53 mil e 70 mil) e apenas **80 gravações**. O problema são só as leituras.

## Decisões / pareceres

- **Versão on-premise** (BD no PC ou servidor do cliente): é viável. Os dados já estão
  concentrados em `src/lib/firebase/data.ts` e o Firestore só é usado no servidor. O
  caminho seria Postgres + auth próprio + Docker + Cloudflare Tunnel, com estimativa
  de 2 a 3 semanas. Fica adiado: primeiro otimizar.
- **Custo no Blaze** (com o consumo medido): ~0,50 a 1,20 € por mês só com a UR.
  Com 100 empresas iguais à UR, ~46 a 232 € por mês, conforme o uso.
- **Um Firebase por cliente**: ver a resposta desta sessão. Fica como opção para um
  plano Enterprise ("BD dedicada"), não para todos os clientes.

## Causas encontradas

1. `revalidateTag('tasks')` era global: uma edição numa OT invalidava a cache de todas
   as empresas, incluindo o histórico de anos passados (~6700 OTs por cada ida ao
   Dashboard).
2. O sino fazia polling a cada 2 minutos com uma cache de 60 s: ~12 mil leituras por
   dia por utilizador.
3. A lista de Concluídas não tinha cache: ~6000 leituras por cada filtro.
4. O backup diário completo: ~12 mil leituras por dia.
5. Gravar o perfil com o nome relia todas as OTs, mesmo sem alterar o nome.
6. O perfil custava 2 leituras por pedido.

## Feito (commit `06467a9`)

- Etiquetas de cache por empresa: `tasks:<id>`, `tasks-history:<id>` (7 dias) e
  `tasks-completed:<id>`.
- Cache de 1 h no sino, invalidada por empresa. A query passa a ser ordenada, com
  `limit(15)` e um índice composto novo em `firestore.indexes.json`.
- Perfil em cache (etiquetas `users` e `companies`).
- Backup completo ao domingo e incremental nos outros dias (`.incremental.json`).
- Medição: `[fs-reads]` nos logs da Vercel para queries com 100 ou mais documentos.
- Revisto por um agente code-reviewer. As correções aplicadas: os resultados de
  reserva nunca ficam em cache, e `users`/`companies`/configs pequenas são sempre
  copiados por inteiro no backup.

## Pendentes

- Deploy em produção e publicação do índice de notificações (`firebase deploy --only
  firestore:indexes`, precisa de `firebase login`).
- Medir uma semana com `[fs-reads]` e com a consola.
## 2026-10-18 — Isolamento entre empresas (commit `7bd20be`, ainda sem deploy)

Objetivo do Rui: os dados dos clientes nunca se misturam e os acessos ficam otimizados.

- `updateUserProfile` deixou de gravar `companyId = Empresa UR` quando o campo não é passado.
- O perfil de reserva da UR passa a servir só às contas da UR (identificadas por uid ou
  por email verificado). As outras contas usam o último perfil bom em memória ou voltam
  ao login.
- Novo `assertUserInCompany`. Antes, um gestor podia repor a password ou desativar,
  editar ou eliminar um utilizador de outra empresa sabendo só o uid.
- As eliminações registadas (de utilizadores e de mensagens) passam a ser lidas só da
  própria empresa.
- O feed de mensagens passa a ser um documento por empresa
  (`system_sync/internal_messages_feed_<companyId>`), com migração automática a partir
  do feed global antigo.
- Limpar todas as mensagens apagava mensagens de todas as empresas. Agora é por
  empresa.
- Apagar, mudar o estado, responder e marcar como lida confirmam primeiro a empresa da
  mensagem.
- A sincronização vinda do browser só aceita mensagens da própria empresa.
- Revisto por um agente security-reviewer, e as correções HIGH e MEDIUM foram aplicadas.
- Decisão sobre um Firebase por cliente: avançar em 2 fases.

## 2026-10-19 — Deploy e Fase 1 do Firebase por cliente

- **Deploy em produção** dos commits `06467a9`, `7bd20be` e `8faf08d` (este último
  feito por outra sessão: o perfil e a empresa deixam de cair para a UR).
- **Fase 1** (commit `5dfa885`, **ainda sem deploy**): novo `src/lib/firebase/tenant-db.ts`
  com `adminDbFor(companyId)`. Os dados de negócio são encaminhados pela empresa e as
  coleções centrais (`companies`, `users`, `invites`, `deleted_users`) ficam no projeto
  principal. Sem a variável `TENANT_DATABASES`, tudo fica na base partilhada e nada
  muda. Inclui 6 testes novos.
## 2026-10-19/20 — OT importadas, isolamento, Gestão Documental (commit `29ef0f5`, publicado)

- **OT importadas que voltavam a Pendente:**
  - **Causa:** só existem na reserva (`tasks.json`). Fechar uma grava um documento
    "Concluída", mas a lista de ativas não o lia.
  - **Correção:** a lista de ativas lê agora também o documento destas OT (cerca de 100) e
    esconde as fechadas.
- **Auditoria de isolamento:** corrigidos 11 dos 12 pontos.
  - Login por email de técnico externo.
  - Técnicos externos, armazéns e empresas externas.
  - OT de outras empresas na reserva da UR.
  - Feed iCal com o token `demo`.
  - Planos alterados pelo calendário.
  - Custo das OT.
  - Notificações.
  - `resolve-email`.
  - Falta: a base offline (RxDB) partilhada num telemóvel usado por várias pessoas.
- **Gestão Documental:**
  - Botão "Importar ficheiros", que cria um documento por ficheiro.
  - FR e IT podem ter o ficheiro original anexado.
  - Uma FR sem campos definidos pede "Registo / Observações".
  - As IT têm o botão "Tomei conhecimento".
  - O servidor recusa concluir uma OT com FR ou IT por fazer.
- **`adminDbFor` passou a assíncrono:** prepara uma base com nome por empresa, mas fica
  desligado até à variável `TENANT_NAMED_DATABASES=1`.

## 2026-10-21 — Teste manual do Rui com 2 empresas (commit `ae4efeb`, publicado)

- **Causa da maior parte do que o Rui viu: a quota esgotou-se a 20/10.** Houve um pico de
  38 mil leituras numa hora, ao fechar OT antigas, porque cada uma invalidava o histórico
  inteiro. Corrigido: agora só o ano dessa OT é invalidado.
- **Fugas reais corrigidas:**
  - Mensagens guardadas no browser numa chave única: apareciam mensagens da conta anterior.
  - A página de equipamento inventava um equipamento a partir do endereço.
  - As listas guardavam a reserva em cache durante 1 hora.
- **Número de OT sequencial (`otNumber`):** o cron noturno numera as OT antigas.
- **"Acesso não autorizado"** em links para registos de outra empresa e em endereços
  inexistentes.
- **PRAZO:** fundo amarelo, texto preto.

## 2026-10-21 (tarde) — Listas materializadas (Opção A, aprovada pelo Rui)

- O Rui recusou a ideia de "deitar fora a cache e reler tudo": tem de se ler só o que mudou.
- **Novo `src/lib/firebase/materialized.ts`:**
  - OTs, equipamentos e planos de cada empresa ficam copiados em poucos documentos
    ("fatias", coleção `materialized`).
  - Ler a lista custa 1 leitura (o índice) mais só as fatias que mudaram.
  - Cada escrita atualiza só o seu item.
  - A cópia é reconstruída só se faltar, se estiver marcada como desatualizada ou se
    tiver mais de 7 dias.
- **Medido nos testes:**
  - Lista sem alterações: 1 leitura.
  - Depois de editar uma OT: até 2 leituras (antes ~2000-3000).
  - Num servidor "frio": 1 mais o número de fatias.
- Passam também a ler da cópia:
  - OT ativas, concluídas, por ano e por equipamento;
  - planos no modal de OT (antes ~600 leituras por abertura);
  - numeração noturna das OT (antes ~6700 por noite);
  - mudança de nome de técnico.
- As etiquetas de cache de equipamentos e planos passam a ser por empresa.
- **Service worker:** as páginas e respostas da API estavam guardadas por endereço,
  partilhadas entre contas no mesmo browser. Agora são apagadas ao trocar de conta e no
  logout.
- **Teste das 2 empresas:** com a UR e a A no mesmo Chrome normal, partilham o cookie da
  sessão. O último login manda nas duas janelas, por isso a janela "UR" mostrava dados da
  A. Não houve fuga no servidor. Para testar, usar um perfil, uma janela anónima ou um
  browser diferente por empresa.

- **Fase 2 (por fazer):**
  - Criar o projeto Firebase da UR e gerar a chave.
  - Publicar as regras e os índices nesse projeto.
  - Script de migração dos dados da UR.
  - Pôr o backup a percorrer também as bases dedicadas.
  - Corrigir os documentos de teste já corrompidos (`starter2@teste.rg` ligado à UR).
