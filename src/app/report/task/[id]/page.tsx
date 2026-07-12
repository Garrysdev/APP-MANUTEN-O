import { redirect, notFound } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import {
  getTask,
  listAssets,
  listUsers,
  listInterventionsByTask,
  listMaterialsForInterventions,
} from '@/lib/firebase/data'
import { STATUS_LABELS, CRITICIDADE_LABELS, TIPO_LABELS } from '@/types/models'
import { formatDate, formatDateTime, formatDuration } from '@/lib/utils'
import PrintTrigger from './PrintTrigger'
import PrintBar from './PrintBar'

export const dynamic = 'force-dynamic'

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: white; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #111827; }
.page { max-width: 210mm; margin: 0 auto; padding: 12mm 14mm 80px; }
@media print {
  .no-print { display: none !important; }
  .page { padding: 10mm 12mm; }
  @page { margin: 0; size: A4; }
  .iv-card { page-break-inside: avoid; }
  .summary-grid { page-break-inside: avoid; }
}
/* Print bar */
.print-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1B4F72; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; z-index: 999; }
.print-btn { background: white; color: #1B4F72; font-weight: 700; font-size: 10pt; border: none; border-radius: 6px; padding: 8px 20px; cursor: pointer; }
.close-btn { background: transparent; color: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.3); font-size: 9pt; border-radius: 6px; padding: 7px 14px; cursor: pointer; }
/* Header */
.rh { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 3px solid #1B4F72; padding-bottom: 10px; margin-bottom: 18px; }
.logo { font-size: 22pt; font-weight: 900; color: #1B4F72; letter-spacing: -1px; line-height: 1; }
.logo-sub { font-size: 7.5pt; color: #6b7280; }
.header-meta { text-align: right; font-size: 8pt; color: #6b7280; line-height: 1.5; }
.header-meta strong { display: block; font-size: 10pt; color: #111827; }
/* Task */
.task-title { font-size: 15pt; font-weight: 800; color: #1B4F72; margin-bottom: 4px; }
.task-desc { font-size: 9pt; color: #4b5563; margin-bottom: 14px; line-height: 1.5; }
.meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 14px; }
.meta-cell { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 7px 10px; }
.meta-label { font-size: 7pt; text-transform: uppercase; letter-spacing: .5px; color: #9ca3af; margin-bottom: 2px; }
.meta-value { font-size: 9.5pt; font-weight: 600; color: #111827; }
/* Safety */
.safety { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 9px 12px; margin-bottom: 14px; }
.safety-title { font-size: 8.5pt; font-weight: 700; color: #92400e; margin-bottom: 5px; }
.safety-item { font-size: 8pt; color: #78350f; margin-left: 12px; margin-bottom: 2px; }
/* Section */
.sec-title { font-size: 11pt; font-weight: 700; color: #1B4F72; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 5px; margin: 18px 0 10px; }
/* Intervention */
.iv-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
.iv-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.iv-tech { font-size: 10pt; font-weight: 700; }
.iv-time-info { text-align: right; font-size: 8pt; color: #6b7280; }
.iv-time-dur { font-size: 10pt; font-weight: 700; color: #111827; }
.iv-date { font-size: 7.5pt; color: #6b7280; margin-top: 2px; }
.iv-obs { background: #f9fafb; border-radius: 5px; padding: 6px 9px; font-size: 8.5pt; color: #374151; margin-bottom: 8px; line-height: 1.4; }
/* Checklist */
.cl { margin-bottom: 8px; }
.cl-item { display: flex; align-items: center; gap: 6px; font-size: 8pt; color: #374151; margin-bottom: 3px; }
.cl-box { display: inline-block; width: 9px; height: 9px; border: 1.5px solid #d1d5db; border-radius: 2px; flex-shrink: 0; }
.cl-box.done { background: #16a34a; border-color: #16a34a; }
.cl-done { color: #9ca3af; text-decoration: line-through; }
/* Table */
table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 6px; }
th { background: #f3f4f6; text-align: left; padding: 4px 8px; font-weight: 600; color: #6b7280; font-size: 7pt; text-transform: uppercase; letter-spacing: .4px; }
td { padding: 4px 8px; border-bottom: 1px solid #f3f4f6; }
.tr { text-align: right; }
.fw { font-weight: 700; }
/* Photos */
.photos-note { font-size: 7.5pt; color: #6b7280; margin-bottom: 6px; }
/* Summary */
.sum-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.sum-cell { text-align: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; }
.sum-val { font-size: 18pt; font-weight: 900; color: #1B4F72; line-height: 1; }
.sum-lbl { font-size: 7.5pt; color: #4b5563; margin-top: 4px; }
/* Footer */
.rf { margin-top: 22px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 7pt; color: #9ca3af; display: flex; justify-content: space-between; }
`

export default async function TaskReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const task = await getTask(profile.companyId, id)
  if (!task) notFound()

  const [assets, users, interventions] = await Promise.all([
    listAssets(profile.companyId),
    listUsers(profile.companyId),
    listInterventionsByTask(profile.companyId, id),
  ])

  const allMaterials = await listMaterialsForInterventions(
    profile.companyId,
    interventions.map((i) => i.id)
  )
  const matsByIntervention: Record<string, typeof allMaterials> = {}
  for (const m of allMaterials) {
    if (!matsByIntervention[m.interventionId]) matsByIntervention[m.interventionId] = []
    matsByIntervention[m.interventionId].push(m)
  }

  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a.name]))
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))
  const companyName = profile.company?.name ?? 'Empresa'
  const generatedAt = new Date().toLocaleString('pt-PT')

  const totalCost = allMaterials.reduce((s, m) => s + (m.unitCost ?? 0) * m.quantity, 0)
  const totalMinutes = interventions.reduce((s, iv) => {
    if (!iv.startedAt || !iv.endedAt) return s
    return s + Math.round((new Date(iv.endedAt).getTime() - new Date(iv.startedAt).getTime()) / 60000)
  }, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalDuration = totalMinutes > 0
    ? `${totalHours > 0 ? `${totalHours}h ` : ''}${totalMinutes % 60}min`
    : '—'

  const criticidadeColor = task.criticidade === 'vermelho'
    ? '#dc2626' : task.criticidade === 'amarelo' ? '#d97706' : '#16a34a'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PrintTrigger />

      <PrintBar title={task.title} />

      <div className="page">
        {/* Cabeçalho */}
        <div className="rh">
          <div>
            <div className="logo">RG</div>
            <div className="logo-sub">RG Maintenance</div>
          </div>
          <div className="header-meta">
            <strong>{companyName}</strong>
            Relatório de tarefa · {generatedAt}
          </div>
        </div>

        {/* Dados da tarefa */}
        <div className="task-title">{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}

        <div className="meta-grid">
          {[
            { label: 'Estado', value: STATUS_LABELS[task.status] },
            { label: 'Equipamento', value: assetMap[task.assetId ?? ''] ?? '—' },
            { label: 'Tipo', value: TIPO_LABELS[task.tipo] },
            { label: 'Criticidade', value: CRITICIDADE_LABELS[task.criticidade], color: criticidadeColor },
            { label: 'Responsável', value: userMap[task.assignedTo ?? ''] ?? '—' },
            { label: 'Prazo', value: formatDate(task.dueDate ?? null) },
            { label: 'Criada em', value: formatDate(task.createdAt) },
            { label: 'Nº Intervenções', value: String(interventions.length) },
          ].map(({ label, value, color }) => (
            <div key={label} className="meta-cell">
              <div className="meta-label">{label}</div>
              <div className="meta-value" style={color ? { color } : undefined}>{value}</div>
            </div>
          ))}
        </div>

        {/* Regras de segurança */}
        {task.safetyRules && task.safetyRules.length > 0 && (
          <div className="safety">
            <div className="safety-title">⚠ Regras de segurança</div>
            {task.safetyRules.map((r, i) => (
              <div key={i} className="safety-item">{i + 1}. {r}</div>
            ))}
          </div>
        )}

        {/* Intervenções */}
        {interventions.length > 0 && (
          <>
            <div className="sec-title">
              Intervenções ({interventions.length})
            </div>

            {interventions.map((iv, idx) => {
              const mats = matsByIntervention[iv.id] ?? []
              const matCost = mats.reduce((s, m) => s + (m.unitCost ?? 0) * m.quantity, 0)
              return (
                <div key={iv.id} className="iv-card">
                  <div className="iv-head">
                    <div>
                      <div className="iv-tech">#{idx + 1} · {userMap[iv.technicianId] ?? '—'}</div>
                      <div className="iv-date">
                        {formatDateTime(iv.startedAt ?? null)}
                        {iv.endedAt ? ` → ${formatDateTime(iv.endedAt)}` : ''}
                      </div>
                    </div>
                    {iv.startedAt && iv.endedAt && (
                      <div className="iv-time-info">
                        <div className="iv-time-dur">{formatDuration(iv.startedAt, iv.endedAt)}</div>
                        <div>duração</div>
                      </div>
                    )}
                  </div>

                  {iv.checklist.length > 0 && (
                    <div className="cl">
                      {iv.checklist.map((c, i) => (
                        <div key={i} className="cl-item">
                          <span className={`cl-box${c.done ? ' done' : ''}`} />
                          <span className={c.done ? 'cl-done' : ''}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {iv.observations && (
                    <div className="iv-obs">{iv.observations}</div>
                  )}

                  {iv.photoUrls && iv.photoUrls.length > 0 && (
                    <div className="photos-note">📷 {iv.photoUrls.length} foto(s) registada(s)</div>
                  )}

                  {mats.length > 0 && (
                    <table>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Ref.</th>
                          <th className="tr">Qtd.</th>
                          <th>Un.</th>
                          <th className="tr">€/un</th>
                          <th className="tr">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mats.map((m) => (
                          <tr key={m.id}>
                            <td className="fw">{m.name}</td>
                            <td>{m.reference ?? '—'}</td>
                            <td className="tr">{m.quantity}</td>
                            <td>{m.unit ?? '—'}</td>
                            <td className="tr">{m.unitCost != null ? `${m.unitCost.toFixed(2)} €` : '—'}</td>
                            <td className="tr fw">{m.unitCost != null ? `${(m.unitCost * m.quantity).toFixed(2)} €` : '—'}</td>
                          </tr>
                        ))}
                        {matCost > 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, paddingTop: 5, borderBottom: 'none' }}>Total materiais</td>
                            <td className="tr fw" style={{ color: '#1B4F72', borderBottom: 'none' }}>{matCost.toFixed(2)} €</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* Resumo */}
        <div className="sec-title">Resumo</div>
        <div className="sum-grid">
          <div className="sum-cell">
            <div className="sum-val">{interventions.length}</div>
            <div className="sum-lbl">Intervenções</div>
          </div>
          <div className="sum-cell">
            <div className="sum-val">{totalDuration}</div>
            <div className="sum-lbl">Tempo total</div>
          </div>
          <div className="sum-cell">
            <div className="sum-val">{totalCost > 0 ? `${totalCost.toFixed(2)} €` : `${allMaterials.length}`}</div>
            <div className="sum-lbl">{totalCost > 0 ? 'Custo materiais' : 'Materiais usados'}</div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="rf">
          <span>RG Maintenance · {companyName}</span>
          <span>Gerado em {generatedAt}</span>
        </div>
      </div>
    </>
  )
}
