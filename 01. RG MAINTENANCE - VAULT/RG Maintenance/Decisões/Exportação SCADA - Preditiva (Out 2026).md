# Exportação SCADA para a Manutenção Preditiva — o que acrescentar

Equipamento: **MOTOREDUTOR AGITADOR R3** (TAG 120B R3 M1). O ficheiro continua a ser o
mesmo .csv (ou .zip com .csv) exportado do trend do SCADA, importado na
página Manutenção Preditiva (`/dashboard/predictive`).

## 1. Temperatura no VIB2 e no VIB3

Hoje só vem a do VIB1. Acrescentar ao trend as duas séries, com o mesmo padrão de nome:

- `SGM_SGM_R3_VIB2_Temperatura_Valor`
- `SGM_SGM_R3_VIB3_Temperatura_Valor`

(A app lê qualquer `…_VIBn_Temperatura…` — o importante é o `VIBn_Temperatura`.)

## 2. Corrente e rpm do agitador

Acrescentar ao trend as variáveis do variador/motor do R3. O nome tem de ter **R3** ou
**Agitador** (senão a app assume que é de outra máquina e ignora) e uma destas palavras:

- corrente: `Corrente`, `Current` ou `I_L1`… (ex.: `SGM_SGM_R3_Agitador_I_Corrente`)
- velocidade: `RPM`, `Rotacao` ou `Speed` (ex.: `SGM_SGM_R3_Agitador_RPM`)

Também reconhece potência (`kW`/`Potencia`) e frequência (`Hz`/`Freq`), se existirem.

## 3. Mais casas decimais na aceleração

`aRMS` (Fricção) e `aPeak` (Choque) vêm em **g com 1 casa decimal** → a Fricção aparece
plana (~0,98 m/s²). Pedir **3 casas decimais** (ex.: 0,103 g). A app converte para m/s²
sozinha; não é preciso mudar unidades.

## Do lado da app

Nada a fazer: já reconhece tudo acima (testado em `src/lib/vibration.test.ts`, 28/10/2026).
Depois da primeira importação com as séries novas, confirmar em "Sensores e limites" que
aparecem a Temperatura do VIB2/VIB3, a Corrente e a Velocidade.
