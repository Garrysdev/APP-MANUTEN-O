# 30/10/2026 — Sessão 1

## Feito
- **Manutenção Preditiva**:
  - período livre (De/Até e atalhos 48 h, 7 dias, 30 dias, 90 dias, Tudo);
  - zoom por arrasto, igual em todos os gráficos, com Recuar/Avançar, Reduzir e Repor zoom;
  - clicar na legenda esconde uma série; opção "Mostrar máximos";
  - "Exportar janela (.csv)";
  - "Estatísticas da janela" (mín, média, máx, desvio-padrão, variação);
  - tabela no fim com filtro por coluna, ordenação, resolução 10 min/1 h/1 dia e exportação das linhas filtradas.
- **Temperaturas importadas que "não apareciam"**: os dados vão de 02/05 a 26/10, mas a página só lia os últimos 7 dias (máx. 90). Com "Tudo", aparecem de maio a outubro. Depois de importar, o período passa a incluir os dias importados.
- **PM**: filtro de datas na coluna PRÓXIMA.
- **Eliminar planos de PM**: os planos voltavam pela reserva JSON (os 507 gravados a 29/10). Passou a gravar-se sempre um marcador de eliminado, e a lista refresca ao eliminar.
- "Calendário PM" passou a "Calendário".

## Por verificar
- Eliminar um plano em produção (não testado, para não apagar dados reais).
- "Tudo" (6 meses) demora ~18 s a carregar da primeira vez.

## Segunda ronda (30/10, tarde)
- **Preditiva**: botão "Resumo" em cada gráfico (liga/desliga a caixa das leituras), cursor de lupa no zoom, caixa de Alertas por cima dos gráficos com os máximos de temperatura e corrente do agitador; novo limite opcional "Corrente do motor (A)" em Sensores e limites.
- **PM**: o filtro de datas da PRÓXIMA abre por cima da tabela (estava cortado); saiu o filtro "No/Fora do Calendário"; clicar numa linha abre a ficha do plano (histórico de todas as OT de PM, editar/eliminar o plano e cada OT).
- **Eliminar OT de PM na lista de OT**: mesma causa dos planos (a OT voltava pela reserva) — `deleteTask` grava sempre o marcador.
- **% do PM no Dashboard**: não contava as execuções "concluídas em bloco". Nova fórmula única (`pm-compliance.ts`) = KPI do PL-MAN-01: planos sem execuções em atraso ÷ planos com execuções previstas.
- **KPI dos anos anteriores**: a % do PM dividia pelos 601 planos de hoje (~1%). Os KPI oficiais estão nos PL-MAN-01 de cada ano (colunas devidas/realizadas): 2017 50,1% · 2018 99,2% · 2019 97,3% · 2020 98,3% · 2021 93,7% · 2022 94,6% · 2023 94,6% · 2024 94,1% · 2025 93,8%. Importação nova em Estatísticas → "KPI do PM dos anos anteriores".
- **PI por ano**: os valores da app (das OT importadas) estão próximos das folhas KPIs do FR-MAN-09 (ex. 2019: 187 vs 184). Falta o FR-MAN-09 de 2022 (só ~20 OT de 2022 nos ficheiros). As folhas KPIs foram preenchidas à mão (a do ficheiro de 2026 repete os valores de 2024).
- **Estatísticas**: gráficos anuais (PM e PI por ano) passaram a caber na caixa.

## Terceira ronda (30/10, fim do dia)
- **% do PM (definição do Rui)**: OT de PM concluídas até hoje ÷ OT de PM devidas até ao fim do ano. 2026 = 84,1% (3217 de 3825). A conclusão em bloco até 31/10 foi só da implementação; daqui em diante concluem-se uma a uma.
- **Anos anteriores** (PL-MAN-01, realizadas ÷ devidas, sem contar as feitas a mais): 2017 71,0% · 2018 99,8% · 2019 99,0% · 2020 97,9% · 2021 98,4% · 2022 98,6% · 2023 99,0% · 2024 99,2% · 2025 99,0%.
- **FR-MAN-09 de 2022** importado: 999 OT (PI 127, igual à folha KPIs). Nova importação em Estatísticas → "Importar histórico de OT de um ano".
- **Preditiva**: sem alertas de corrente; cada alerta mostra a hora do pico e a temperatura do sensor e a corrente do agitador nesse momento (clicar na hora amplia os gráficos à volta).

## Correção final da % do PM
- Regra do Rui: cada plano é uma OT de PM do ano → % = OT de PM concluídas no ano ÷ nº de planos. 2026 = **586 de 601 = 97,5%**.
- O "3217 de 3825" anterior somava execuções (as semanais/mensais contavam várias vezes) — errado.
- Anos anteriores pelo KPI das folhas PL-MAN-01 (planos cumpridos ÷ planos): 2017 50,1% · 2018 99,2% · 2019 97,3% · 2020 98,3% · 2021 93,7% · 2022 94,6% · 2023 94,6% · 2024 94,1% · 2025 93,8%.

## Dashboard, PM, Calendário, ficha do equipamento e Gestão Documental (fim do dia)

- Dashboard: cartões por ordem Em curso → Pendentes → Concluídas → Total. "Equipamentos Mais Críticos" passou a ordenar pelo nº de OT (antes pela Classe A, escondia os floculadores com 200 OT).
- PM: filtro "Só HACCP"; tabela não desaparece quando um filtro não dá resultados; data da Próxima execução na ficha igual à da Última.
- Bianuais nas paragens (8/ago, 21/dez): 228 planos passaram de fev/2027 para 21/12/2026.
- Calendário: botão Eliminar nas OT (OT de PM → elimina o plano); OT STP aparecem na data da paragem escolhida ao abrir a OT.
- Ficha do equipamento: 2.ª fila com OT por tipo; filtros e 20/50/100 linhas nas tabelas PM e Histórico.
- Setas de voltar (equipamento, OT, stock) voltam à página anterior.
- Página Documentação retirada; "Perguntar à IA" na Gestão Documental sobre os documentos reais (sem chave de IA em produção → responde com os documentos encontrados).
