import type { Intervention, Material } from '@/types/models'

/**
 * Função pura para calcular o custo total de uma Tarefa (OT).
 * Extrato da lógica original em `data.ts` para permitir Test Driven Development (TDD).
 * 
 * Fórmula: Custo Total = Sum(Horas Trabalhadas * Custo/Hora do Técnico) + Sum(Quantidade * Custo Unitário do Material)
 */
export function calculateTotalCost(
  interventions: Pick<Intervention, 'startedAt' | 'endedAt' | 'technicianId'>[],
  materials: Pick<Material, 'unitCost' | 'quantity'>[],
  userRates: Record<string, number> // Mapa de technicianId -> hourlyRate
): number {
  let totalCost = 0

  // 1. Custo da Mão de Obra
  for (const inv of interventions) {
    if (inv.startedAt && inv.endedAt && inv.technicianId) {
      const rate = userRates[inv.technicianId] || 0
      const start = new Date(inv.startedAt).getTime()
      const end = new Date(inv.endedAt).getTime()
      
      const hours = (end - start) / (1000 * 60 * 60)
      if (hours > 0 && rate > 0) {
        totalCost += hours * rate
      }
    }
  }

  // 2. Custo dos Materiais
  for (const mat of materials) {
    if (mat.unitCost && mat.quantity && mat.quantity > 0) {
      totalCost += mat.unitCost * mat.quantity
    }
  }

  return totalCost
}
