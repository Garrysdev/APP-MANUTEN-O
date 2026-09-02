import type { Periodicidade, MaintenancePlan } from '@/types/models'

/**
 * Motor do Gerador Anual de PMs (Planos de Manutenção Preventiva e Ocorrências de Calendário).
 * Regras de calendário padronizadas:
 * - Semanal: Todas as semanas (segundas-feiras ao longo do ano)
 * - Mensal: Todos os meses (dia 15 de cada mês, 12 ocorrências)
 * - Trimestral: Março, Junho, Setembro, Dezembro (dia 15, 4 ocorrências)
 * - Semestral / Bianual / Bianual-STP: Agosto e Dezembro (08 de Agosto e 21 de Dezembro)
 * - Anual / Anual-STP / Bienal / Trianual / 5 Anos: Agosto (08 de Agosto)
 * - Horas / Pontual: NextDueDate ou CalendarStartDate quando existente
 */
export function calculatePlanAnnualDates(
  plan: {
    periodicidade?: Periodicidade | string | null
    periodicidadeLabel?: string | null
    title?: string | null
    description?: string | null
    calendarDates?: string[] | null
    calendarStartDate?: string | null
    nextDueDate?: string | null
  },
  targetYear = 2026
): string[] {
  // Se o plano já tiver calendarDates manuais definidos, respeitá-los
  if (plan.calendarDates && Array.isArray(plan.calendarDates) && plan.calendarDates.length > 0) {
    return plan.calendarDates
  }

  const pLow = String(plan.periodicidade || '').toLowerCase().trim()
  const pLabelLow = String(plan.periodicidadeLabel || '').toLowerCase().trim()
  const titleLow = String(plan.title || '').toLowerCase().trim()
  const descLow = String(plan.description || '').toLowerCase().trim()
  const combo = `${pLow} ${pLabelLow} ${titleLow} ${descLow}`

  const y = targetYear

  // 1. Semanal - Todas as semanas (Segundas-feiras)
  if (pLow === 'semanal' || combo.includes('semanal') || combo.includes('1x/sem') || combo.includes('1x sem')) {
    const dates: string[] = []
    const d = new Date(Date.UTC(y, 0, 1))
    while (d.getUTCDay() !== 1) {
      d.setUTCDate(d.getUTCDate() + 1)
    }
    while (d.getUTCFullYear() === y) {
      dates.push(d.toISOString().slice(0, 10))
      d.setUTCDate(d.getUTCDate() + 7)
    }
    return dates
  }

  // 2. Mensal - Todos os meses (dia 15 de cada mês)
  if (pLow === 'mensal' || combo.includes('mensal') || combo.includes('1x/mes') || combo.includes('1x mes') || combo.includes('1x/mês')) {
    const dates: string[] = []
    for (let m = 0; m < 12; m++) {
      const monthStr = String(m + 1).padStart(2, '0')
      dates.push(`${y}-${monthStr}-15`)
    }
    return dates
  }

  // 3. Trimestral - Março, Junho, Setembro, Dezembro (dia 15)
  if (pLow === 'trimestral' || combo.includes('trimestral') || combo.includes('3 meses') || combo.includes('4x/ano')) {
    return [
      `${y}-03-15`,
      `${y}-06-15`,
      `${y}-09-15`,
      `${y}-12-15`,
    ]
  }

  // 4. Semestral / Bianual - Agosto e Dezembro (Paragens STP)
  if (
    pLow === 'bianual' ||
    combo.includes('bianual') ||
    combo.includes('semestral') ||
    combo.includes('2x/ano') ||
    combo.includes('2x ano') ||
    combo.includes('bianual-stp')
  ) {
    return [`${y}-08-08`, `${y}-12-21`]
  }

  // 5. Anual / Anual-STP / Bienal / Trianual / 5 Anos - Agosto (Paragem de Verão)
  if (
    pLow === 'anual' ||
    pLow === 'bienal' ||
    pLow === 'trianual' ||
    combo.includes('anual') ||
    combo.includes('1x/ano') ||
    combo.includes('1x ano') ||
    combo.includes('anual-stp') ||
    combo.includes('bienal') ||
    combo.includes('trianual') ||
    combo.includes('5 anos')
  ) {
    return [`${y}-08-08`]
  }

  // 6. Horas / Pontual / Outro - Se tiver nextDueDate ou calendarStartDate
  if (plan.nextDueDate) return [plan.nextDueDate.slice(0, 10)]
  if (plan.calendarStartDate) return [plan.calendarStartDate.slice(0, 10)]

  return []
}
