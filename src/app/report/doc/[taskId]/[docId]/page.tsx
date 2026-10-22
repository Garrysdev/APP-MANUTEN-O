import { redirect, notFound } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getTask, listDocuments } from '@/lib/firebase/data'
import { frSignature, itSignature, IT_ACKS_KEY } from '@/lib/doc-signatures'
import { formatDate, formatDateTime } from '@/lib/utils'
import PrintBar from '../../../task/[id]/PrintBar'

export const dynamic = 'force-dynamic'

// Comprovativo de um registo do Arquivo de FR/IT (auditorias): que FR foi preenchida em
// papel / que IT foi lida, em que OT/Área/TAG, por quem e quando — para imprimir ou PDF.

const CSS = `
.print-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1B4F72; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; z-index: 999; }
.print-btn { background: white; color: #1B4F72; font-weight: 700; font-size: 10pt; border: none; border-radius: 6px; padding: 8px 20px; cursor: pointer; }
.close-btn { background: transparent; color: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.3); font-size: 9pt; border-radius: 6px; padding: 7px 14px; cursor: pointer; }
@media print { .no-print { display: none !important; } @page { size: A4; margin: 12mm; } body { background: white !important; } }
`

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="border border-slate-400 bg-slate-50 px-3 py-2 text-left font-semibold w-1/3 align-top">{label}</th>
      <td className="border border-slate-400 px-3 py-2">{children}</td>
    </tr>
  )
}

export default async function DocRecordPage({ params }: { params: Promise<{ taskId: string; docId: string }> }) {
  const { taskId, docId: rawDocId } = await params
  const docId = decodeURIComponent(rawDocId)
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [task, docs] = await Promise.all([getTask(profile.companyId, taskId), listDocuments(profile.companyId)])
  if (!task || docId === IT_ACKS_KEY) notFound()

  const doc = docs.find((d) => d.id === docId) || null
  const isIT = (task.acknowledgedITs || []).includes(docId) && !task.completedFRs?.[docId]
  const entry = task.completedFRs?.[docId] as Record<string, unknown> | undefined
  if (!isIT && !entry) notFound()

  const itAck = isIT ? itSignature(task.completedFRs, docId) : null
  const signature = isIT ? (itAck ? { name: itAck.byName, at: itAck.at } : null) : frSignature(entry)
  const docTitle = doc ? (doc.code ? `${doc.code} · ${doc.title}` : doc.title) : docId
  const companyName = profile.company?.name ?? ''
  const logoUrl = profile.company?.logoUrl ?? null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PrintBar title={`${docTitle} · OT ${task.otNumber ?? task.id}`} />
      <div className="min-h-screen bg-slate-200 print:bg-white py-6 pb-24 px-3 print:p-0">
        <div className="max-w-[794px] mx-auto bg-white text-black border border-slate-300 print:border-0 px-8 py-8 text-[12px]">
          <div className="flex items-end justify-between border-b-2 border-[#1B4F72] pb-2 mb-6">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} className="h-12 w-auto object-contain" />
            ) : (
              <strong className="text-base">{companyName}</strong>
            )}
            <div className="text-right">
              <p className="font-bold text-sm">{isIT ? 'Registo de Instrução de Trabalho' : 'Registo de Folha de Registo'}</p>
              <p className="text-[10px] text-slate-500">Emitido em {formatDateTime(new Date().toISOString())}</p>
            </div>
          </div>

          <table className="w-full border-collapse mb-6">
            <tbody>
              <Row label={isIT ? 'Instrução de Trabalho' : 'Folha de Registo'}><strong>{docTitle}</strong></Row>
              <Row label="Ordem de Trabalho">{task.otNumber ?? task.id} — {task.title}</Row>
              <Row label="Área">{task.area || '—'}</Row>
              <Row label="TAG">{task.tag || '—'}</Row>
              <Row label="Data da OT">{formatDate(task.completedAt || task.createdAt)}</Row>
              <Row label="Estado">
                {isIT
                  ? 'Lida — tomou conhecimento'
                  : entry?.paper
                    ? 'Preenchida em papel'
                    : 'Preenchida na app (registo anterior)'}
              </Row>
              <Row label={isIT ? 'Confirmado por' : 'Preenchida por'}>
                {signature ? <><strong>{signature.name}</strong> em {formatDateTime(signature.at)}</> : <em className="text-slate-500">Registo anterior à assinatura eletrónica</em>}
              </Row>
            </tbody>
          </table>

          <p className="text-[10px] text-slate-500">
            {isIT
              ? 'Confirmação registada na aplicação com a sessão do utilizador indicado.'
              : 'A folha original em papel é o documento de registo; esta confirmação foi registada na aplicação com a sessão do utilizador indicado.'}
          </p>
        </div>
      </div>
    </>
  )
}
