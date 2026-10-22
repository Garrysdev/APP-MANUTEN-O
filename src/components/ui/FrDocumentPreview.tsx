'use client'

import type { FrBlock, FrLayout } from '@/lib/fr-layout'
import { useBranding } from '@/components/providers/BrandingProvider'

// Cópia fiel de uma Folha de Registo importada de Word: uma folha A4 por página do original,
// com o cabeçalho (logótipo da empresa, "FICHA DE REGISTO", código), título, instruções,
// tabelas com as mesmas colunas e o mesmo nº de linhas, notas e rodapé com a revisão.

function NoteText({ text }: { text: string }) {
  // "MODELO: SLC-10 | SN: 0000454126" → rótulos a negrito, como no original.
  const parts = text.split(/([A-ZÀ-Ú][A-ZÀ-Ú ./-]*:)/)
  return (
    <>
      {parts.map((p, i) => (/:$/.test(p) ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}
    </>
  )
}

function Block({ block }: { block: FrBlock }) {
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
                {row.map((cell, c) => (
                  <td key={c} className="border border-black px-1">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
  }
}

export default function FrDocumentPreview({ layout, fallbackCode }: { layout: FrLayout; fallbackCode?: string }) {
  const { logoUrl, companyName } = useBranding()
  const total = layout.pages.length

  return (
    <div className="space-y-6">
      {layout.pages.map((page, idx) => (
        <div
          key={idx}
          className="bg-white text-black shadow-md border border-slate-200 mx-auto w-full max-w-[794px] px-6 sm:px-12 py-8 flex flex-col font-[Calibri,Carlito,sans-serif]"
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
              <Block key={i} block={block} />
            ))}
          </div>

          <div className="mt-8 border-t border-black pt-1 flex items-center justify-between text-[11px] font-[Arial,sans-serif]">
            <span>{layout.revision}</span>
            <span className="border border-slate-400 px-2">{idx + 1}{total > 1 ? ` / ${total}` : ''}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
