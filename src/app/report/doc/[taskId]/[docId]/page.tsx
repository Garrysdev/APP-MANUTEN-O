import { redirect, notFound } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getTask, listDocuments } from '@/lib/firebase/data'
import { readFrLayout } from '@/lib/fr-layout'
import { frSignature, itSignature, IT_ACKS_KEY } from '@/lib/doc-signatures'
import { formatDate, formatDateTime } from '@/lib/utils'
import FrDocumentPreview from '@/components/ui/FrDocumentPreview'
import { BrandingProvider } from '@/components/providers/BrandingProvider'
import PrintBar from '../../../task/[id]/PrintBar'

export const dynamic = 'force-dynamic'

// Registo de uma FR preenchida / IT confirmada numa OT, tal como foi assinado — página
// para imprimir ou guardar em PDF (Arquivo de FR/IT, auditorias).

const CSS = `
.print-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1B4F72; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; z-index: 999; }
.print-btn { background: white; color: #1B4F72; font-weight: 700; font-size: 10pt; border: none; border-radius: 6px; padding: 8px 20px; cursor: pointer; }
.close-btn { background: transparent; color: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.3); font-size: 9pt; border-radius: 6px; padding: 7px 14px; cursor: pointer; }
@media print { .no-print { display: none !important; } @page { size: A4; margin: 8mm; } body { background: white !important; } }
`

export default async function DocRecordPage({ params }: { params: Promise<{ taskId: string; docId: string }> }) {
  const { taskId, docId: rawDocId } = await params
  const docId = decodeURIComponent(rawDocId)
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [task, docs] = await Promise.all([getTask(profile.companyId, taskId), listDocuments(profile.companyId)])
  if (!task || docId === IT_ACKS_KEY) notFound()

  const doc = docs.find((d) => d.id === docId) || null
  const isIT = doc ? doc.type === 'IT' : (task.acknowledgedITs || []).includes(docId)
  const entry = (task.completedFRs?.[docId] || null) as Record<string, unknown> | null
  if (!isIT && !entry) notFound()
  if (isIT && !(task.acknowledgedITs || []).includes(docId)) notFound()

  const layout = readFrLayout(doc?.layoutJson)
  const values = Object.fromEntries(
    Object.entries(entry || {}).filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined).map(([k, v]) => [k, String(v)])
  )
  const itAck = isIT ? itSignature(task.completedFRs, docId) : null
  const signature = isIT
    ? (itAck ? { name: itAck.byName, at: itAck.at } : null)
    : frSignature(entry)
  const docTitle = doc ? (doc.code ? `${doc.code} · ${doc.title}` : doc.title) : docId
  const labels = doc?.fieldLabels || []
  const labelOf = (key: string) => {
    const m = key.match(/^f(\d+)$/)
    return m && labels[Number(m[1])] ? labels[Number(m[1])] : key
  }

  return (
    <BrandingProvider value={{ companyName: profile.company?.name ?? null, logoUrl: profile.company?.logoUrl ?? null, userName: null }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PrintBar title={`${docTitle} · OT ${task.otNumber ?? task.id}`} />
      <div className="min-h-screen bg-slate-200 print:bg-white py-6 pb-24 px-3 print:p-0">
        {/* Identificação do registo: a que OT/Área/TAG pertence */}
        <div className="max-w-[794px] mx-auto mb-3 bg-white border border-slate-300 rounded-md px-4 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-black">
          <div><span className="block text-[9px] uppercase text-slate-500">OT</span><strong>{task.otNumber ?? task.id}</strong></div>
          <div><span className="block text-[9px] uppercase text-slate-500">Área</span><strong>{task.area || '—'}</strong></div>
          <div><span className="block text-[9px] uppercase text-slate-500">TAG</span><strong>{task.tag || '—'}</strong></div>
          <div><span className="block text-[9px] uppercase text-slate-500">Data da OT</span><strong>{formatDate(task.completedAt || task.createdAt)}</strong></div>
          <div className="col-span-2 sm:col-span-4"><span className="block text-[9px] uppercase text-slate-500">Descrição</span>{task.title}</div>
        </div>

        {layout ? (
          <FrDocumentPreview layout={layout} fallbackCode={doc?.code} values={values} signature={signature} />
        ) : (
          <div className="max-w-[794px] mx-auto bg-white text-black border border-slate-300 px-8 py-8">
            <h1 className="text-lg font-bold mb-4">{docTitle}</h1>
            {isIT ? (
              <p className="text-[12px] whitespace-pre-wrap leading-relaxed">{doc?.content || '—'}</p>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <tbody>
                  {Object.entries(values).map(([k, v]) => (
                    <tr key={k}>
                      <th className="border border-black px-2 py-1 text-left font-semibold w-1/2">{labelOf(k)}</th>
                      <td className="border border-black px-2 py-1">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-8 flex justify-end text-[12px]">
              <div className="border-t border-black pt-1 min-w-[260px] text-center">
                {signature ? (
                  <>
                    <p className="font-bold">{signature.name}</p>
                    <p className="text-[10px] text-slate-600">
                      {isIT ? 'Tomou conhecimento' : 'Assinado eletronicamente'} em {formatDateTime(signature.at)}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 italic">Registo anterior à assinatura eletrónica</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </BrandingProvider>
  )
}
