# 2026-10-29 — Sessão 1

## Pedidos do Rui e o que ficou feito (commit 92f4697, em produção)

- **Fechar uma OT com FR dava erro ("FR por preencher").**
  - Na edição da OT, cada FR escolhida tem agora uma caixa de visto ("Preenchida em papel"). Cada IT tem "Tomei conhecimento", igual à janela de resumo da OT.
  - O visto grava logo e fica assinado (quem e quando).
- **No telemóvel não se conseguia abrir a FR/IT original para imprimir.**
  - Os originais são Word (.doc), que abriam pelo visualizador online da Microsoft.
  - Novo link "Descarregar (para imprimir no telemóvel)": o ficheiro abre no Word/Docs do telemóvel, que imprime.
- **PM — novo modelo: uma OT atual por plano** (`src/lib/pm-schedule.ts`):
  - **ESTADO:** o estado dessa OT, com as cores das OT, e filtro por estado (Pendente, Em curso, Concluída, Em atraso).
  - **PRÓXIMA** (antiga coluna Tarefas): a data da OT atual. É editável e fica vermelha quando está em atraso.
  - **Concluir uma OT de PM em qualquer sítio:** o plano passa logo para a data seguinte, segundo a periodicidade.
  - **Calendário:** mostra só a OT atual de cada plano; as em atraso ficam a vermelho. Arrastar muda a mesma data do PM.
  - **Ativo/Inativo → "Operacionalidade"**, só na ficha do plano. Antes, gravar a ficha voltava sempre a pôr o plano Ativo.
  - **Histórico de execuções na ficha do plano:** data prevista, dia em que foi concluída e OT.
- **"Dar como concluídas as OT de PM até ao fim do mês":**
  - Botão "Concluir PM até…": primeiro conta, depois confirma.
  - Executado a 29/10 até 31/10/2026: 507 planos passaram para a próxima data e 7 OT de PM abertas ficaram Concluídas.
  - Não foram criadas OTs; no histórico do plano aparecem como "Concluída em bloco".
  - Contagem repetida depois: 0. Outubro ficou vazio no Calendário e novembro só mostra as OT seguintes.

## Pendentes
- Rever no telemóvel o link "Descarregar" de uma FR.
- "Gerador Anual PMs" retirado a pedido do Rui (botão, janela e a ação no servidor, que também apagava as OTs do plano). Commit 654d36d, em produção.
