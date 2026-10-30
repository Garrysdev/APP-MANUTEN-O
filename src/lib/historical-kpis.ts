// KPI de PM dos anos antes da app, lidos das folhas PL-MAN-01 (Plano de Manutenção) do
// Excel. Cada linha do plano tem, no fim, as intervenções devidas e realizadas no ano;
// o KPI da folha é "planos que fizeram todas as devidas ÷ planos com devidas".
//
// Dois formatos:
// - 2017/2018: colunas com títulos "INTERVENÇÕES DEVIDAS" / "INTERVENÇÕES REALIZADAS"
//   (plano cumprido = realizadas ≥ devidas);
// - 2019+: um bloco de 4 colunas a seguir ao rótulo "JAN" da 1.ª linha —
//   devidas, realizadas, plano cumprido (0/1), plano com devidas (0/1).
import type { HistoricalPmKpi } from './pm-compliance'

export type SheetRows = unknown[][]

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const text = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

/** Ano no nome do ficheiro ("PL-MAN-01 PLANO MANUTENÇÃO_31_12_2019_3.xlsx" → 2019). */
export function yearFromFileName(name: string): number | null {
  const all = [...name.matchAll(/(?:^|[^0-9])(20\d{2})(?![0-9])/g)].map((m) => Number(m[1]))
  return all.length ? all[all.length - 1] : null
}

export function parsePlanSheet(rows: SheetRows, year: number, file?: string): HistoricalPmKpi | null {
  let dueCol = -1, doneCol = -1, okCol = -1, plansCol = -1
  // 2019+: o bloco do "JAN" (tem também as colunas de plano cumprido / com devidas, com o
  // total na 2.ª linha). Em 2018 o bloco só tem devidas/realizadas/a mais.
  let jan = -1
  ;(rows[0] || []).forEach((v, i) => { if (text(v) === 'JAN') jan = i })
  if (jan >= 0 && num(rows[1]?.[jan + 4]) !== null) {
    ;[dueCol, doneCol, okCol, plansCol] = [jan + 1, jan + 2, jan + 3, jan + 4]
  } else {
    for (const r of rows.slice(0, 6)) {
      (r || []).forEach((v, i) => {
        const t = text(v)
        if (/INTERVENC.*DEVIDAS/.test(t)) dueCol = i
        else if (/INTERVENC.*REALIZADAS$/.test(t)) doneCol = i
      })
    }
    if (dueCol < 0 || doneCol < 0) return null
  }
  let due = 0, done = 0, plans = 0, plansOk = 0
  // Cada coluna soma-se à parte, como os totais do cabeçalho da folha (há linhas com o
  // plano marcado mas sem número nas devidas/realizadas, e vice-versa).
  for (const r of rows.slice(3)) {
    const d = num(r?.[dueCol])
    const x = num(r?.[doneCol])
    due += d ?? 0
    done += x ?? 0
    if (plansCol >= 0) {
      plans += num(r?.[plansCol]) ?? 0
      plansOk += num(r?.[okCol]) ?? 0
    } else if (d !== null && d > 0) {
      plans++
      if ((x ?? 0) >= d) plansOk++
    }
  }
  if (due === 0 && plans === 0) return null
  return { year, due, done, plans, plansOk, file }
}
