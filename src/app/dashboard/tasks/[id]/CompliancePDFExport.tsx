'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, ShieldCheck } from 'lucide-react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { formatDate } from '@/lib/utils'

type Props = {
  task: any
  interventions: any[]
  materialsByIntervention: Record<string, any[]>
  assetName: string
  companyName: string
  hasComplianceModule: boolean
}

export default function CompliancePDFExport({ task, interventions, materialsByIntervention, assetName, companyName, hasComplianceModule }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  if (!hasComplianceModule) return null

  async function handleExport() {
    if (!printRef.current) return
    setIsExporting(true)
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2 })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`Relatorio_Auditoria_OT_${task.id.slice(-6)}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Erro ao gerar PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <button 
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50 mt-4"
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {isExporting ? 'A Gerar Certificado ISO...' : 'Exportar Relatório ISO 9001 (PDF)'}
      </button>

      {/* Hidden element for PDF generation */}
      <div className="absolute top-[-9999px] left-[-9999px]">
        <div 
          ref={printRef} 
          className="bg-white text-black p-12" 
          style={{ width: '800px', minHeight: '1122px', fontFamily: 'sans-serif' }}
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider text-gray-900">Relatório de Intervenção</h1>
              <p className="text-gray-500 font-medium mt-1">Conformidade ISO 9001 - Registo de Auditoria</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-xl">{companyName}</p>
              <p className="text-gray-500 text-sm mt-1">Ref: OT-{task.id.slice(-6).toUpperCase()}</p>
              <p className="text-gray-500 text-sm">Data Doc: {formatDate(new Date().toISOString())}</p>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-6">
            <section className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-3">1. Dados do Equipamento & Tarefa</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold">Equipamento:</span> {assetName}</div>
                <div><span className="font-semibold">Tipo de Tarefa:</span> {task.tipo?.toUpperCase()}</div>
                <div><span className="font-semibold">Descrição:</span> {task.title}</div>
                <div><span className="font-semibold">Estado:</span> {task.status.toUpperCase()}</div>
                <div><span className="font-semibold">Criticidade:</span> {task.criticidade?.toUpperCase()}</div>
                <div><span className="font-semibold">Data Criação:</span> {formatDate(task.createdAt)}</div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-3">2. Registos de Intervenção (Audit Trail)</h2>
              {interventions.length === 0 ? (
                <p className="text-sm italic text-gray-500">Sem intervenções registadas.</p>
              ) : (
                <div className="space-y-4">
                  {interventions.map((inv, idx) => (
                    <div key={inv.id} className="border border-gray-300 p-4 rounded-lg">
                      <div className="flex justify-between font-semibold text-sm mb-2">
                        <span>Intervenção #{idx + 1}</span>
                        <span>{formatDate(inv.createdAt)}</span>
                      </div>
                      <div className="text-sm grid grid-cols-2 gap-2 mb-3">
                        <div><span className="text-gray-500">Técnico ID:</span> {inv.technicianId}</div>
                        <div>
                          <span className="text-gray-500">Duração:</span>{' '}
                          {inv.startedAt && inv.endedAt ? `${formatDate(inv.startedAt, true)} a ${formatDate(inv.endedAt, true)}` : 'N/A'}
                        </div>
                      </div>
                      
                      {inv.observations && (
                        <div className="text-sm mb-3">
                          <span className="font-semibold block mb-1">Observações:</span>
                          <p className="bg-gray-50 p-2 rounded border border-gray-200">{inv.observations}</p>
                        </div>
                      )}

                      {materialsByIntervention[inv.id]?.length > 0 && (
                        <div className="text-sm">
                          <span className="font-semibold block mb-1">Materiais Aplicados:</span>
                          <ul className="list-disc pl-5">
                            {materialsByIntervention[inv.id].map((mat: any) => (
                              <li key={mat.id}>{mat.name} - Qtd: {mat.quantity} {mat.unit || 'un'}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            
            <section className="pt-8">
              <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-6">3. Certificação de Conformidade</h2>
              <div className="flex justify-between items-end border border-gray-300 p-6 rounded-lg bg-gray-50">
                <div className="text-sm text-gray-600 max-w-sm">
                  Declara-se que os registos documentados acima são imutáveis e refletem as operações técnicas realizadas no ativo indicado, em conformidade com o sistema de gestão da qualidade.
                </div>
                <div className="text-center">
                  <div className="border-b-2 border-gray-800 w-48 mb-2 h-12 flex items-end justify-center">
                    <span className="italic text-gray-400 font-serif text-lg">Assinatura Digital Integrada</span>
                  </div>
                  <p className="text-xs font-bold text-gray-500">Selo Eletrónico PlantOS</p>
                  <p className="text-[10px] text-gray-400 mt-1">Hash: {task.id}-{new Date().getTime()}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
