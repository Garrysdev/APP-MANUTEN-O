# 2026-10-23 — Sessão 2: Manutenção Preditiva (vibrações)

## Pedido
Página no plano Business para importar os .csv de vibração do motor de tração de um agitador (SEW-Eurodrive MC3PVSF08, 90 kW, 1450→41 rpm, i=35,36, 2019) e ver dados, gráficos e análises. São 4 sensores: 1 no motor e 3 na caixa redutora.

## Feito (commit b4e01a9, em produção)
- `/dashboard/predictive`: nova funcionalidade `predictive` (Business e Enterprise), no menu "Módulos Business".
- O importador corre no browser e lê o ficheiro aos bocados:
  - aceita UTF-16 e UTF-8, colunas Time/ValueY e datas US (AM/PM) ou PT;
  - converte o vRMS de m/s para mm/s;
  - agrega as leituras em intervalos de 10 min (mín, média e máx);
  - por defeito importa só as séries VIBx; as correntes ficam por escolher.
- Firestore:
  - `vibration_days/<empresa>_<equipamento>_<dia>`: cerca de 38 KB por dia com as 21 séries; lê-se por id, sem índices;
  - `vibration_config/<empresa>_<equipamento>`: nomes dos sensores, limites e séries conhecidas;
  - reimportar o mesmo período junta os dados em vez de os duplicar.
- Análises:
  - zonas ISO 10816-3 do Grupo 2 (rígida 1,4/2,8/4,5; flexível 2,3/4,5/7,1 mm/s);
  - tendência e projeção até à zona de alerta (só com 5 ou mais dias de dados);
  - variação dos últimos 7 dias face aos 7 anteriores;
  - alertas diários de vibração e de temperatura;
  - gráficos de vRMS, aRMS, aPeak, fator de crista, temperatura e outras grandezas;
  - botão Criar OT.
- Testes: `src/lib/vibration.test.ts`. O ficheiro real "VIBRAÇÕES R3.csv" foi validado: 345.600 linhas, 3 dias, todos os sensores na zona A.

## Em aberto
- Saber que VIBx corresponde a que círculo da foto (o nome é editável em "Sensores e limites").
- Confirmar se a base é rígida ou flexível (por defeito: rígida, mais exigente).
- As correntes B_Agua, B_Descarga e B_Termofluido parecem ser bombas e não este motor.

## Continuação (mesmo dia)
- Commits 5765f26, c0cd887 e o seguinte, todos em produção:
  - **OT → Calendário:** botão "Calendário" na janela de resumo da OT. A data fica em `calendarDate` e o Calendário PM mostra a OT com a cor do estado; arrastá-la muda a data.
  - **Equipamentos:** a Área e a TAG passaram a ser listas, como na OT, com opção "+ Nova…" (`AssetAreaTagFields.tsx`).
  - **Preditiva — nomes do SCADA:** Fadiga = vRMS, Fricção = aRMS, Choque = aPeak; a aceleração vem em g e passa para m/s².
  - **Preditiva — corrente/rpm do motor:** só entram as do mesmo equipamento (com "R3" ou "Agitador" no nome). Mostra-se o gráfico Fadiga × grandeza com dois eixos e a correlação de Pearson. As correntes das bombas ficam de fora.
  - **Preditiva — .zip:** o importador lê o .zip diretamente (`src/lib/zip-entries.ts`).
- **Dados de aprovação:** importados para o MOTOREDUTOR AGITADOR R3 (asset_ur_18), 1–3 jul 2026. Sensores: VIB1 Motor, VIB2 Rolamento 1, VIB3 Rolamento 2, VIB4 Rolamento 3. Todos na zona A.
- **Pendente:**
  - ~~O Rui confirma se a TAG do equipamento passa de "20 P3 M1" para "120B R3 M1".~~ Feito (ver abaixo).
  - Verificar a temperatura no VIB2 e no VIB3: o ficheiro exportado não a traz.
  - Incluir a corrente/rpm do agitador na exportação.

## Continuação 2 (23–24/10)
- **Importação .zip** (commit 8402141): `src/lib/zip-entries.ts` lê o diretório central do .zip e descomprime com `DecompressionStream('deflate-raw')`. Os dados de aprovação foram importados assim, a partir do zip original.
- **TAG do agitador:** o MOTOREDUTOR AGITADOR R3 (asset_ur_18) passou a ter TAG **120B R3 M1** e área **120B**. A alteração foi feita pelo formulário, já com as listas novas, e os dados de vibração continuam ligados.
- **Estado da OT a partir das datas** (commit c940668):
  - A regra está em `src/lib/task-status.ts` (`deriveTaskStatus`), que é igual no formulário (`CreateTaskModal`) e no servidor (`parseTask`).
  - Fim preenchido → Concluída. Só Início preenchido → Em Curso. Sem datas → Pendente. Cancelada nunca muda.
  - Antes, preencher o Início não mudava o estado, e limpar o Fim de uma OT iniciada voltava a Pendente.
  - Verificado em produção: "Agora" no Início muda o estado para Em curso.
  - A OT do empilhador amarelo 1, criada antes da correção, continua Pendente até ser aberta e gravada de novo.
- **Incluir OT no PM** (commit da7f7ab): dava o erro "Cannot destructure property 'recurrence'" com periodicidade quinzenal, bimensal, quadrimestral ou semestral.
  - `periodicidadeToRecurrence` passou a conhecer estas quatro (quinzenal = semanal ×2, bimensal = mensal ×2, quadrimestral = mensal ×4, semestral = mensal ×6). Um valor desconhecido passa a usar mensal.
  - No `pm-generator`, o bimensal deixou de aparecer todos os meses e o quadrimestral e o quinzenal foram corrigidos.
  - Testes: `periodicidade.test.ts` e `task-status.test.ts`.

## Em aberto (para a próxima sessão)
- **SCADA / exportação** (o Rui vai pedir):
  - temperatura no VIB2 e no VIB3;
  - corrente e rpm do agitador;
  - aceleração com mais casas decimais. Hoje vem com 1 casa em g, por isso a Fricção aparece plana (~0,98 m/s²).
- **O Rui importa o resto dos dados de vibração.** A projeção só aparece com 5 ou mais dias.
- **Perguntas antigas ainda sem resposta:**
  - ordenar as listas por ordem alfabética?
  - retirar a Data Limite dos Projetos?
  - os técnicos sem acesso à app contam para o limite de utilizadores do plano?
- **Do lado do Rui:**
  - voltar a gravar como PDF os dois .doc grandes das IT;
  - carregar o logótipo (`logo-united-resins.png` está na raiz do projeto, por versionar).
