import { rankDocuments, docSnippet } from './doc-search'
import type { DocumentoObrigatorio } from '@/types/models'

const doc = (id: string, extra: Partial<DocumentoObrigatorio>) =>
  ({ id, companyId: 'c', type: 'IT', code: id, title: '', active: true, createdAt: '', ...extra }) as DocumentoObrigatorio

describe('doc-search', () => {
  const docs = [
    doc('IT-MAN-01', { title: 'Consignação LOTO', content: 'Desligar o interruptor geral e aplicar o cadeado de bloqueio.' }),
    doc('FR-MAN-16', { type: 'FR', title: 'Controlo UPS', fieldLabels: ['Tensão de saída', 'Autonomia da bateria'] }),
    doc('MAN-01', { type: 'MANUAL', title: 'Manual do compressor Atlas', fileName: 'atlas_ga30.pdf' }),
    doc('IT-MAN-09', { title: 'Inativa bloqueio', content: 'bloqueio', active: false }),
  ]

  it('ordena pelos termos da pergunta (sem acentos), só documentos ativos', () => {
    expect(rankDocuments(docs, 'Como faço o bloqueio (consignacao)?').map((d) => d.id)).toEqual(['IT-MAN-01'])
    expect(rankDocuments(docs, 'autonomia da bateria da UPS').map((d) => d.id)).toEqual(['FR-MAN-16'])
    expect(rankDocuments(docs, 'compressor').map((d) => d.id)).toEqual(['MAN-01'])
    expect(rankDocuments(docs, 'xyz')).toEqual([])
  })

  it('excerto à volta do termo encontrado', () => {
    expect(docSnippet(docs[0], 'cadeado')).toContain('cadeado de bloqueio')
  })
})
