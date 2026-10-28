# 2026-10-28 — Sessão 1

## Correções (commit 82f2afc, em produção)

- **Não se conseguia eliminar equipamentos.**
  - **Causa:** o botão desapareceu com a coluna Ações (commit 5af4560). Só restava o "Apagar" em massa, que escondia os erros.
  - **Correção:** botão "Eliminar" na janela de edição do equipamento, e os erros passam a aparecer. Um equipamento da reserva com `companyId` corrompido também já se elimina.
  - **Verificação:** em produção vi o botão; não eliminei nenhum equipamento real.
- **PM — o estado mudava mas a tabela não.**
  - **Causa 1:** o servidor escolhia a OT a alterar por `updatedAt`, em qualquer ano e só no Firestore. A tabela mostra outra (`findPlanLinkedTask`), e quando essa só existia na reserva criava-se uma OT nova.
  - **Causa 2:** a página só recebia as 2000 OT mais recentes.
  - **Correção:** a ação recebe o id da OT que a linha mostra. A página recebe todas as OT ligadas a planos (por id do plano ou por TAG).
- **OT — a data de lançamento não ficava gravada.**
  - Nas OT ativas funcionava (testado em produção na 6744 e reposto).
  - **Causa:** no Histórico/Todas, as concluídas são carregadas à parte (`extraCompletedTasks`), sobrepunham-se às frescas e nunca recarregavam depois de gravar.
  - **Correção:** passam a recarregar depois de cada gravação e as do servidor prevalecem.
  - No telemóvel o cartão mostrava a Data Planeada antes da de lançamento — passou a mostrar a de lançamento, como a tabela.
- **Os filtros de data das OT não funcionavam.**
  - **Causa 1:** a lista do `<Select>` abre em `document.body`. O "clicar fora" do `ExcelDateFilter` fechava o filtro antes de a escolha contar. Correção: marcador `data-select-list`.
  - **Causa 2:** o Histórico só tinha as 250 concluídas mais recentes. Correção: agora carrega tudo em blocos de 1000.
  - **Causa 3:** uma OT sem data passava sempre por um filtro ativo.
  - **Verificação:** em produção, Histórico com ano 2025 → 542 OT.

## Decisões do Rui aplicadas

- **Formulário de Projeto com textos próprios** (commit 7bc3685):
  - Novo/Editar Projeto, Nome do Projeto, Âmbito/Objetivos;
  - Início/Fim do Projeto, Criar/Eliminar Projeto.
  - A Data Limite fica nos Projetos.
- **Técnicos sem acesso à app contam para o limite:** já era assim (`countActiveUsers` conta todos os ativos). Nada mudou.
- **Ordem alfabética:** os dropdowns já o eram (dc5d851). Tabelas (aprovado pelo Rui): Equipamentos por Área e depois TAG; Regras de Segurança por nome. Equipa, Armazéns e Inventário já estavam por nome (o Inventário mantém no topo os materiais atribuídos a TAG). OT, Histórico e Projetos ficam por data.

## Técnico

- **Next.js 15.5.19 → 15.5.28 e `npm audit fix`** (commit c5e2f00): 0 críticas.
  - Ficam 11 "high", que exigem saltos de versão grandes (firebase, xlsx, @vercel/blob).
- A base offline por utilizador já estava feita (cf6c2a9).
- **Exportação SCADA:** especificação em `Decisões/Exportação SCADA - Preditiva (Out 2026).md`. Do lado da app nada a fazer (testado).
- **Git:**
  - entram no git os registos do diário por versionar;
  - os 2 Excel da raiz foram para `UR EXCEL/` (idênticos), que fica no `.gitignore`.

## Livro Hotmart

- **Geradas no Google Flow as 6 fotos dos capítulos 4–9**: KPIs, Segurança, Stocks, Gantt, Financeiro, Documentos. Ficam no projeto do Flow "out. 28 - 12:25".
- **As 6 estão descarregadas** em `Monetização Hotmart/Imagens livro (Google Flow)/` (Cap04 a Cap09), depois de o Rui permitir vários downloads no Chrome.
- Prompts em `Monetização Hotmart/Imagens livro (Google Flow)/`.
- O ficheiro-fonte do livro não está neste computador (foi feito noutra sessão/máquina).

## Pendentes

- Índice das notificações: já existe e está Ativado na consola do Firebase (verificado 28/10). Não é preciso `firebase login`.
- Inserir as fotos no livro (o ficheiro-fonte está noutra máquina).
- Medir uma semana de leituras do Firestore.
