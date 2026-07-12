import { calculateTotalCost } from '../src/lib/finance'
import type { Intervention, Material } from '../src/types/models'

describe('Finance Logic - calculateTotalCost', () => {
  it('deve retornar 0 se não houver intervenções ou materiais', () => {
    const cost = calculateTotalCost([], [], {})
    expect(cost).toBe(0)
  })

  it('deve calcular corretamente o custo das horas trabalhadas', () => {
    const interventions: Partial<Intervention>[] = [
      {
        technicianId: 'user1',
        startedAt: '2023-10-01T10:00:00.000Z',
        endedAt: '2023-10-01T12:00:00.000Z', // 2 horas
      },
    ]
    const userRates = { user1: 15 } // 15 euros por hora

    const cost = calculateTotalCost(interventions as any, [], userRates)
    expect(cost).toBe(30) // 2h * 15
  })

  it('deve calcular corretamente o custo dos materiais', () => {
    const materials: Partial<Material>[] = [
      { quantity: 2, unitCost: 10 },
      { quantity: 5, unitCost: 1.5 },
    ]

    const cost = calculateTotalCost([], materials as any, {})
    expect(cost).toBe(27.5) // 2*10 + 5*1.5
  })

  it('deve somar horas trabalhadas e materiais combinados', () => {
    const interventions: Partial<Intervention>[] = [
      {
        technicianId: 'user1',
        startedAt: '2023-10-01T10:00:00.000Z',
        endedAt: '2023-10-01T11:30:00.000Z', // 1.5 horas
      },
      {
        technicianId: 'user2',
        startedAt: '2023-10-01T14:00:00.000Z',
        endedAt: '2023-10-01T15:00:00.000Z', // 1 hora
      },
    ]
    const materials: Partial<Material>[] = [
      { quantity: 1, unitCost: 50 },
    ]
    const userRates = { user1: 20, user2: 10 } 
    // user1: 1.5h * 20 = 30
    // user2: 1h * 10 = 10
    // mat: 50
    // total = 90

    const cost = calculateTotalCost(interventions as any, materials as any, userRates)
    expect(cost).toBe(90)
  })

  it('deve ignorar horas negativas ou nulas e ignorar intervenções sem técnico', () => {
    const interventions: Partial<Intervention>[] = [
      {
        technicianId: 'user1',
        startedAt: '2023-10-01T12:00:00.000Z',
        endedAt: '2023-10-01T10:00:00.000Z', // -2 horas (inválido)
      },
      {
        technicianId: 'user1',
        startedAt: '2023-10-01T10:00:00.000Z',
        endedAt: '2023-10-01T10:00:00.000Z', // 0 horas
      },
      {
        // Sem tecnico
        startedAt: '2023-10-01T10:00:00.000Z',
        endedAt: '2023-10-01T12:00:00.000Z',
      }
    ]
    const userRates = { user1: 20 }

    const cost = calculateTotalCost(interventions as any, [], userRates)
    expect(cost).toBe(0)
  })
})
