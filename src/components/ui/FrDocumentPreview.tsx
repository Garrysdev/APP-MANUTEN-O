'use client'

import type { FrBlock, FrLayout } from '@/lib/fr-layout'
import { useBranding } from '@/components/providers/BrandingProvider'

// Cópia fiel de uma Folha de Registo / Instrução de Trabalho importada de Word/Excel: uma
// folha A4 por página do original, com o cabeçalho (logótipo da empresa, "FICHA DE
// REGISTO", código), título, instruções, tabelas com as mesmas colunas e o mesmo nº de
// linhas, notas e rodapé com a revisão.
//
// Com `onChange`, é também o formulário de preenchimento: as células vazias das tabelas e
// as notas que terminam em ":" (ex. "MODELO:") passam a caixas de texto. Os valores ficam
// em `values` com chaves estáveis por posição (cellKey/noteKey) — guardados na OT em
// completedFRs[frId].

export function cellKey(page: number, block: number, row: number, col: number): string {
  return `p${page}_b${block}_r${row}_c${col}`
}

export function noteKey(page: number, block: number): string {
  return `p${page}_b${block}`
}

export function isFillableNote(block: FrBlock): boolean {
  return (block.kind === 'note' || block.kind === 'text') && /:\s*$/.test(block.text)
}

type Signature = { name: string; at: string } | null

type Props = {
  layout: FrLayout
  fallbackCode?: string
  values?: Record<string, string>
  onChange?: (key: string, value: string) => void
  /** Assinatura gravada (quem preencheu e quando). */
  signature?: Signature
  /** Sem assinatura gravada: nome de quem vai assinar ao guardar (utilizador da sessão). */
  pendingSignerName?: string | null
}

const CELL_INPUT = 'w-full h-full min-h-[28px] bg-amber-50/60 focus:bg-amber-100/70 outline-none px-1 text-[11px] text-black'

function NoteText({ text }: { text: string }) {
  // "MODELO: SLC-10 | SN: 0000454126" → rótulos a negrito, como no original.
  const parts = text.split(/([A-ZÀ-Ú][A-ZÀ-Ú ./-]*:)/)
  return (
    <>
      {parts.map((p, i) => (/:$/.test(p) ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}
    </>
  )
}

function Block({ block, page, index, values, onChange }: {
  block: FrBlock
  page: number
  index: number
  values: Record<string, string>
  onChange?: Props['onChange']
}) {
  const editable = Boolean(onChange)
  const fillNote = editable || values[noteKey(page, index)]
  if ((block.kind === 'note' || block.kind === 'text') && isFillableNote(block) && fillNote) {
    const key = noteKey(page, index)
    return (
      <p className={`${block.kind === 'note' ? 'text-right' : ''} text-[13px] mt-1 flex items-center gap-1 ${block.kind === 'note' ? 'justify-end' : ''}`}>
        <NoteText text={block.text} />
        {editable ? (
          <input value={values[key] || ''} onChange={(e) => onChange!(key, e.target.value)} className="border-b border-black bg-amber-50/60 outline-none px-1 text-[13px] w-56 max-w-full" />
        ) : (
          <span className="px-1">{values[key]}</span>
        )}
      </p>
    )
  }

  switch (block.kind) {
    case 'title':
      return <p className="text-center text-[15px] my-4">{block.text}</p>
    case 'text':
      return <p className="text-[13px] leading-6">{block.text}</p>
    case 'caption':
      return <p className="text-right text-[12px] mt-2 font-[Arial,sans-serif]">{block.text}</p>
    case 'note':
      return <p className="text-right text-[13px] mt-1"><NoteText text={block.text} /></p>
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-black text-[11px] font-[Arial,sans-serif]">
            <thead>
              <tr>
                {block.columns.map((col, i) => (
                  <th key={i} className={`border border-black px-1 py-0.5 font-normal text-center ${i === 0 ? 'w-[18%]' : ''}`}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="h-8">
                  {row.map((cell, c) => {
                    const key = cellKey(page, index, r, c)
                    return (
                      <td key={c} className="border border-black p-0 align-middle">
                        {cell ? (
                          <span className="px-1">{cell}</span>
                        ) : editable ? (
                          <input value={values[key] || ''} onChange={(e) => onChange!(key, e.target.value)} className={CELL_INPUT} />
                        ) : (
                          <span className="px-1">{values[key]}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function formatSignedAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
}

export default function FrDocumentPreview({ layout, fallbackCode, values = {}, onChange, signature, pendingSignerName }: Props) {
  const { logoUrl, companyName } = useBranding()
  const total = layout.pages.length
  const showSignature = Boolean(signature || pendingSignerName)

  return (
    <div className="space-y-6">
      {layout.pages.map((page, idx) => (
        <div
          key={idx}
          className="bg-white text-black shadow-md border border-slate-200 mx-auto w-full max-w-[794px] px-4 sm:px-12 py-8 flex flex-col font-[Calibri,Carlito,sans-serif] print:shadow-none print:border-0 print:break-after-page"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-end border-b border-black pb-1 mb-2">
            <div>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={companyName ?? ''} className="h-12 w-auto object-contain" />
              ) : (
                <span className="text-xs font-bold">{companyName}</span>
              )}
            </div>
            <span className="text-[15px] font-serif tracking-wide">{layout.heading || 'FICHA DE REGISTO'}</span>
            <span className="text-right text-[11px] font-[Arial,sans-serif]">{layout.code || fallbackCode}</span>
          </div>

          <div className="flex-1">
            {page.map((block, i) => (
              <Block key={i} block={block} page={idx} index={i} values={values} onChange={onChange} />
            ))}
          </div>

          {showSignature && idx === total - 1 && (
            <div className="mt-6 flex justify-end text-[12px] font-[Arial,sans-serif]">
              <div className="border-t border-black pt-1 min-w-[260px] text-center">
                {signature ? (
                  <>
                    <p className="font-bold">{signature.name}</p>
                    <p className="text-[10px] text-slate-600">Assinado eletronicamente em {formatSignedAt(signature.at)}</p>
                  </>
                ) : (
                  <p className="text-slate-500">Será assinado por <strong className="text-black">{pendingSignerName}</strong> ao guardar</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-black pt-1 flex items-center justify-between text-[11px] font-[Arial,sans-serif]">
            <span>{layout.revision}</span>
            <span className="border border-slate-400 px-2">{idx + 1}{total > 1 ? ` / ${total}` : ''}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
