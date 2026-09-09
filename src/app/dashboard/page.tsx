import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listUsers, listAssets, listInterventions } from '@/lib/firebase/data'
import { formatDate } from '@/lib/utils'
import { ClipboardList, Users, Timer, ArrowUp, ArrowDown, Plus, AlertCircle, FolderKanban } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const [tasks, usersList, assets, interventions] = await Promise.all([
    listTasks(profile.companyId),
    listUsers(profile.companyId),
    listAssets(profile.companyId),
    listInterventions(profile.companyId),
  ])

  const isTech = (role?: string | null) => {
    const r = (role || '').toLowerCase().trim()
    return r === 'technician' || r === 'tecnico' || r === 'técnico' || r === 'tech'
  }

  const activeUsers = usersList.filter(u => u.active !== false)
  const internalTechs = activeUsers.filter(u => isTech(u.role) && !u.isExternal)
  const externalTechs = activeUsers.filter(u => isTech(u.role) && u.isExternal === true)
  
  const isProject = (t: any) =>
    t.source === 'folha_projetos' ||
    t.isProject === true ||
    (t.description || '').toLowerCase().includes('projecto') ||
    (t.description || '').toLowerCase().includes('projeto')

  const normalActiveTasks = tasks.filter((t) => !isProject(t) && t.status !== 'done' && t.status !== 'cancelled')
  const projectActiveTasks = tasks.filter((t) => isProject(t) && t.status !== 'done' && t.status !== 'cancelled')
  const completedTasks = tasks.filter((t) => t.status === 'done')
  let totalDurationHours = 0
  let completedCount = 0
  for (const t of completedTasks) {
    if (t.createdAt && t.completedAt) {
      const start = new Date(t.createdAt).getTime()
      const end = new Date(t.completedAt).getTime()
      if (end > start) {
        totalDurationHours += (end - start) / (1000 * 60 * 60)
        completedCount++
      }
    }
  }
  const avgResolutionHours = completedCount > 0 ? (totalDurationHours / completedCount).toFixed(1) : '0.0'

  const criticalAssets = assets
    .map((asset) => {
      const assetTasks = tasks.filter((t) => t.assetId === asset.id || t.tag === asset.tag)
      const openUrgent = assetTasks.filter((t) => t.criticidade === 'vermelho' && t.status !== 'done' && t.status !== 'cancelled').length
      const totalInterventions = interventions.filter((iv) => {
        const t = tasks.find((tk) => tk.id === iv.taskId)
        return t && (t.assetId === asset.id || t.tag === asset.tag)
      }).length + assetTasks.length

      return {
        asset,
        totalTasks: assetTasks.length,
        totalInterventions,
        openUrgent,
        criticidadeABC: asset.criticidadeABC || 'C',
      }
    })
    .sort((a, b) => {
      const rank: Record<string, number> = { A: 1, B: 2, C: 3 }
      const rA = rank[a.criticidadeABC] || 4
      const rB = rank[b.criticidadeABC] || 4
      if (rA !== rB) return rA - rB
      return b.totalTasks - a.totalTasks
    })
    .slice(0, 10)

  const isPMTask = (t: any) => {
    const tipoLow = String(t.tipo || '').toLowerCase().trim()
    const tiLow = String(t.ti || t.tipoText || '').toLowerCase().trim()
    const titleLow = String(t.title || '').toLowerCase()
    return (
      tipoLow === 'mp' ||
      tipoLow === 'pm' ||
      tipoLow === 'preventiva' ||
      tipoLow === 'plano' ||
      tiLow === 'mp' ||
      tiLow === 'pm' ||
      tiLow === 'preventiva' ||
      tiLow === 'plano' ||
      Boolean(t.maintenancePlanId) ||
      t.source === 'plano_manutencao' ||
      t.source === 'folha_ur_planos' ||
      String(t.id || '').startsWith('task_pm_') ||
      titleLow.includes('plano de manutenção') ||
      titleLow.startsWith('pm ') ||
      titleLow.startsWith('pm-') ||
      titleLow.startsWith('mp ') ||
      titleLow.startsWith('mp-')
    )
  }

  const isPITask = (t: any) => {
    const tipoLow = String(t.tipo || '').toLowerCase().trim()
    const tiLow = String(t.ti || t.tipoText || '').toLowerCase().trim()
    const titleLow = String(t.title || '').toLowerCase()
    return (
      tipoLow === 'pi' ||
      tiLow === 'pi' ||
      tipoLow === 'solicitacao' ||
      t.source === 'folha_ur_pi' ||
      t.source === 'pedidos_pi' ||
      Boolean(t.requesterEmail) ||
      titleLow.startsWith('pi ') ||
      titleLow.startsWith('pi-') ||
      titleLow.includes('pedido de intervenção') ||
      titleLow.includes('pedido pi')
    )
  }

  const totalOTs = tasks.length
  const doneOTs = tasks.filter((t) => t.status === 'done').length
  const inProgressOTs = tasks.filter((t) => t.status === 'in_progress').length
  const pendingOTs = tasks.filter((t) => t.status === 'pending').length

  const pmTasks = tasks.filter(isPMTask)
  const pmTotal = pmTasks.length
  const pmDone = pmTasks.filter((t) => t.status === 'done' || !!t.completedAt).length
  const pmCompliancePct = pmTotal > 0 ? Math.round((pmDone / pmTotal) * 100) : 100

  const piTasks = tasks.filter(isPITask)
  const piRequested = piTasks.length
  const piCompleted = piTasks.filter((t) => t.status === 'done' || !!t.completedAt).length

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline/60 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-industrial-blue tracking-tight">Dashboard de Manutenção</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Visão geral e indicadores executivos da operação industrial.</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <Link 
            href="/dashboard/tasks?status=pending,in_progress"
            className="flex-1 sm:flex-initial h-11 px-4 bg-white border border-outline text-industrial-blue rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <ClipboardList size={18} className="text-industrial-blue-light" />
            <span>Gestão de OTs</span>
          </Link>
          <Link 
            href="/dashboard/tasks?create=true"
            className="flex-1 sm:flex-initial h-11 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Plus size={18} className="stroke-[2.5]" />
            <span>+ Nova OT</span>
          </Link>
          <Link 
            href="/dashboard/projects?create=true"
            className="flex-1 sm:flex-initial h-11 px-4 bg-industrial-blue hover:bg-industrial-blue/90 text-white rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <FolderKanban size={18} />
            <span>+ Novo Projeto</span>
          </Link>
        </div>
      </div>

      {/* ── 1ª LINHA DE INDICADORES (ANEXO 1) ────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/tasks" className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-all group">
          <p className="text-4xl font-extrabold text-[#1B4F72] dark:text-blue-400 group-hover:scale-105 transition-transform">{totalOTs}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center justify-center gap-1 group-hover:text-industrial-blue">
            <span>Total OTs</span> <span className="text-[10px]">↗</span>
          </p>
        </Link>
        <Link href="/dashboard/tasks?status=done" className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-all group">
          <p className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">{doneOTs}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center justify-center gap-1 group-hover:text-emerald-600">
            <span>Concluídas</span> <span className="text-[10px]">↗</span>
          </p>
        </Link>
        <Link href="/dashboard/tasks?status=in_progress" className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-all group">
          <p className="text-4xl font-extrabold text-blue-500 dark:text-blue-400 group-hover:scale-105 transition-transform">{inProgressOTs}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center justify-center gap-1 group-hover:text-blue-500">
            <span>Em curso</span> <span className="text-[10px]">↗</span>
          </p>
        </Link>
        <Link href="/dashboard/tasks?status=pending" className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-all group">
          <p className="text-4xl font-extrabold text-amber-600 dark:text-amber-500 group-hover:scale-105 transition-transform">{pendingOTs}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center justify-center gap-1 group-hover:text-amber-600">
            <span>Pendentes</span> <span className="text-[10px]">↗</span>
          </p>
        </Link>
      </section>

      {/* ── 2ª LINHA DE INDICADORES (ANEXO 2 — SEM AS OTs ATIVAS) ──────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/projects" className="block">
          <div className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-industrial-blue/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-industrial-blue transition-colors">Projetos Ativos</span>
              <FolderKanban size={20} className="text-industrial-blue group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue dark:text-slate-100">{projectActiveTasks.length}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">Em Curso</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/users" className="block">
          <div className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-amber-500/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-amber-600 transition-colors">Técnicos Internos</span>
              <Users size={20} className="text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue dark:text-slate-100">{internalTechs.length}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">Internos</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/users" className="block">
          <div className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-blue-500/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-blue-600 transition-colors">Técnicos Externos</span>
              <Users size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue dark:text-slate-100">{externalTechs.length}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">Prestadores</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/history" className="block">
          <div className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Tempo Resolução</span>
              <Timer size={20} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue dark:text-slate-100">{avgResolutionHours}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">Horas</span>
            </div>
          </div>
        </Link>
      </section>

      {/* ── 3ª LINHA DE INDICADORES (ANEXO 3) ────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cartão Cumprimento do Plano de Manutenção (PM) */}
        <div className="bg-gradient-to-br from-slate-900 via-industrial-blue to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400">
              Cumprimento do Plano de Manutenção (PM)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{pmCompliancePct}%</span>
              <span className="text-xs font-bold text-slate-300">
                ({pmDone} de {pmTotal} OTs de PM Existentes)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Considera a totalidade de OTs de PM geradas no período selecionado ({pmTotal} OTs) vs Concluídas ({pmDone} OTs).
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center font-black text-xl border border-white/20 shrink-0 text-amber-400">
            {pmCompliancePct}%
          </div>
        </div>

        {/* Cartão Pedidos de Intervenção (PI) — Resumo */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-industrial-blue dark:text-sky-400">
              Pedidos de Intervenção (PI) — Resumo
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {piCompleted} / {piRequested}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                PIs Concluídos
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Total de solicitações de intervenção criadas e tratadas na fábrica no período selecionado.
            </p>
          </div>
        </div>
      </section>

      {/* Análise dos Equipamentos Mais Críticos */}
      <div className="mt-2">
        <h2 className="text-base font-bold text-gray-800 dark:text-slate-200 mb-3 flex items-center justify-between">
          <span>Análise dos Equipamentos Mais Críticos</span>
          <Link href="/dashboard/assets" className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline">
            Ver Todos os Equipamentos →
          </Link>
        </h2>
        {criticalAssets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
            Sem equipamentos cadastrados.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[650px] md:min-w-0">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5">ÁREA</th>
                    <th className="text-left px-3 py-2.5">TAG</th>
                    <th className="text-left px-3 py-2.5">EQUIPAMENTO</th>
                    <th className="text-center px-3 py-2.5">CRITICIDADE ABC</th>
                    <th className="text-center px-3 py-2.5">TOTAL OTs</th>
                    <th className="text-center px-3 py-2.5">URGENTES EM ABERTO</th>
                    <th className="text-center px-3 py-2.5">ESTADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {criticalAssets.map(({ asset, totalTasks, openUrgent, criticidadeABC }) => (
                    <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {asset.area || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <Link href={`/dashboard/assets/${asset.id}`} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:text-purple-600 transition-colors">
                          {asset.tag || '—'}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                        <Link href={`/dashboard/assets/${asset.id}`} className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors">
                          {asset.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-extrabold ${
                          criticidadeABC === 'A' ? 'bg-red-100 text-red-800 border border-red-300' :
                          criticidadeABC === 'B' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          Classe {criticidadeABC}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold font-mono text-slate-800 dark:text-slate-200">
                        <Link href={`/dashboard/tasks?search=${encodeURIComponent(asset.tag || asset.name)}`} className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors">
                          {totalTasks} OT(s) ↗
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        {openUrgent > 0 ? (
                          <Link href={`/dashboard/tasks?search=${encodeURIComponent(asset.tag || asset.name)}`} className="bg-red-50 text-red-700 font-extrabold px-2 py-0.5 rounded border border-red-200 hover:bg-red-100 transition-colors">
                            ⚠️ {openUrgent}
                          </Link>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${asset.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-300'}`}>
                          {asset.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


