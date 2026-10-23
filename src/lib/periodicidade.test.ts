import { periodicidadeToRecurrence, type Periodicidade } from '@/types/models'
// Valores das listas PERIODICIDADE_OPTIONS / PERIODICIDADE_PM_OPTIONS do formulário da OT.
const FORM_VALUES = ['anual', 'bimensal', 'mensal', 'pontual', 'quadrimestral', 'quinzenal', 'semanal', 'semestral', 'trimestral']

describe('periodicidadeToRecurrence', () => {
  it('todas as opções do formulário da OT têm recorrência (antes: quinzenal rebentava ao incluir no PM)', () => {
    for (const v of FORM_VALUES) {
      expect(periodicidadeToRecurrence(v as Periodicidade)).toBeDefined()
    }
    expect(periodicidadeToRecurrence('quinzenal')).toEqual({ recurrence: 'weekly', recurrenceValue: 2 })
    expect(periodicidadeToRecurrence('xpto' as Periodicidade)).toEqual({ recurrence: 'monthly', recurrenceValue: 1 })
  })
})
