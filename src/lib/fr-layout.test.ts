import { parseFrText, fieldLabelsFromLayout, titleFromLayout, readFrLayout, rowsToText } from './fr-layout'

// Texto real devolvido por word-extractor para FR-MAN-18 CONTROLO UPS (encurtado: 3 linhas
// vazias por tabela em vez de 28).
const empty = '\t\t\n\t\t\n\t\t\n'
const body =
  'CONTROLO UPS\nRegistar os parâmetros de operação.\nAs anomalias detectadas devem ser comunicadas.\nControlo mensal.\n' +
  'UPS ED20 - 1\nDIA\tOutput V / % / kW / Hz / B+ / B- / cap. % / ºC / alarms / Teste\t\n' + empty + 'MODELO:\n' +
  'CONTROLO UPS\nRegistar os parâmetros de operação.\nAs anomalias detectadas devem ser comunicadas.\nControlo mensal.\n' +
  'UPS ED110 - 1\nDIA\tI (Saída) / V(Inversor) / Alarmes \t\n' + empty + 'MODELO: SLC-10-CUBE3+ L | SN: 0000454126\n'
const headers = '\tFICHA DE REGISTO\tFR/MAN/18\n\n\n'
const footers = 'Rev.-02/01/2025\n\n\n'

describe('parseFrText', () => {
  const layout = parseFrText(body, headers, footers)

  it('lê cabeçalho, código e revisão', () => {
    expect(layout.heading).toBe('FICHA DE REGISTO')
    expect(layout.code).toBe('FR/MAN/18')
    expect(layout.revision).toBe('Rev.-02/01/2025')
  })

  it('separa uma página por cada repetição do título', () => {
    expect(layout.pages).toHaveLength(2)
    expect(titleFromLayout(layout)).toBe('CONTROLO UPS')
  })

  it('reconhece instruções, legenda da tabela, tabela e nota', () => {
    const kinds = layout.pages[0].map((b) => b.kind)
    expect(kinds).toEqual(['title', 'text', 'text', 'text', 'caption', 'table', 'note'])
    const table = layout.pages[0][5]
    expect(table.kind === 'table' && table.columns).toEqual(['DIA', 'Output V / % / kW / Hz / B+ / B- / cap. % / ºC / alarms / Teste'])
    expect(table.kind === 'table' && table.rows).toHaveLength(3)
    expect(layout.pages[1][6]).toEqual({ kind: 'note', text: 'MODELO: SLC-10-CUBE3+ L | SN: 0000454126' })
  })

  it('deriva um campo por coluna (sem a coluna DIA), com a legenda da tabela', () => {
    expect(fieldLabelsFromLayout(layout)).toEqual([
      'UPS ED20 - 1 — Output V / % / kW / Hz / B+ / B- / cap. % / ºC / alarms / Teste',
      'UPS ED110 - 1 — I (Saída) / V(Inversor) / Alarmes',
    ])
  })
})

describe('rowsToText (Excel)', () => {
  it('título, frase de instrução e tabela com linhas vazias a preencher', () => {
    const rows = [['LEITURAS COMPRESSOR'], ['Registar diariamente.'], [], ['DATA', 'Pressão (bar)'], ['', ''], ['', '']]
    const layout = parseFrText(rowsToText(rows))
    expect(layout.pages[0].map((b) => b.kind)).toEqual(['title', 'text', 'table'])
    const table = layout.pages[0][2]
    expect(table.kind === 'table' && table.rows).toHaveLength(2)
    expect(fieldLabelsFromLayout(layout)).toEqual(['Pressão (bar)'])
  })
})

describe('readFrLayout', () => {
  it('devolve null para vazio ou JSON inválido', () => {
    expect(readFrLayout(null)).toBeNull()
    expect(readFrLayout('{oops')).toBeNull()
    expect(readFrLayout('{"pages":[]}')).toEqual({ pages: [] })
  })
})
