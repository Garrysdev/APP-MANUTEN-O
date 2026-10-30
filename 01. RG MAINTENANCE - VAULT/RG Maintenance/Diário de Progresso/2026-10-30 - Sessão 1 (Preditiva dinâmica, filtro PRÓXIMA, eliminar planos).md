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
