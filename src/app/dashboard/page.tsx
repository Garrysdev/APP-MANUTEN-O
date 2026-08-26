import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listUsers } from '@/lib/firebase/data'
import { formatDate } from '@/lib/utils'
import { ClipboardList, Users, Timer, ArrowUp, ArrowDown, Plus, AlertCircle, FolderKanban } from 'lucide-react'
import DashboardTablesClient from './DashboardTablesClient'

export const dynamic = 'force-dynamic'

const StatCard = ({ label, value, icon: Icon, trend, sub, href }: { label: string; value: string; icon: any; trend?: string; sub?: string; href?: string }) => {
  const content = (
    <div className="bg-white border border-outline rounded-lg p-6 flex flex-col justify-between h-[150px] shadow-sm hover:shadow-md hover:border-safety-orange/40 transition-all cursor-pointer group">
      <div className="flex justify-between items-start">
        <span className="font-mono text-xs font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-safety-orange transition-colors">{label}</span>
        <Icon size={20} className="text-slate-300 group-hover:text-safety-orange transition-colors" />
      </div>
      <div className="flex items-end gap-3">
        <span className="text-4xl font-bold text-industrial-blue">{value}</span>
        {trend && (
          <span className={`text-sm font-bold flex items-center mb-1 ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
            {trend.startsWith('+') ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {trend.replace(/[+-]/, '')}
          </span>
        )}
        {sub && <span className="text-xs font-medium text-industrial-blue-light mb-1">{sub}</span>}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{content}</Link>
  }
  return content
};

export default async function DashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const [tasks, usersList] = await Promise.all([
    listTasks(profile.companyId),
    listUsers(profile.companyId),
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

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline/60 pb-5">
        <h1 className="text-3xl font-extrabold text-industrial-blue tracking-tight">Dashboard de Manutenção</h1>
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <Link 
            href="/dashboard/tasks"
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

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <Link href="/dashboard/tasks?status=pending,in_progress" className="block">
          <div className="bg-white border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-safety-orange/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-safety-orange transition-colors">Ordens Ativas</span>
              <ClipboardList size={20} className="text-safety-orange group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue">{normalActiveTasks.length}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">OTs</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/projects" className="block">
          <div className="bg-white border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-industrial-blue/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-industrial-blue transition-colors">Projetos Ativos</span>
              <FolderKanban size={20} className="text-industrial-blue group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue">{projectActiveTasks.length}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">Em Curso</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/users" className="block">
          <div className="bg-white border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-amber-500/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-amber-600 transition-colors">Técnicos Internos</span>
              <Users size={20} className="text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue">{internalTechs.length}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">Internos</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/users" className="block">
          <div className="bg-white border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-blue-500/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-blue-600 transition-colors">Técnicos Externos</span>
              <Users size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue">{externalTechs.length}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">Prestadores</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/history" className="block">
          <div className="bg-white border border-outline rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all cursor-pointer group h-[125px]">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[11px] font-bold text-industrial-blue-light uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Tempo Resolução</span>
              <Timer size={20} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-extrabold text-industrial-blue">{avgResolutionHours}</span>
              <span className="text-[11px] font-medium text-slate-500 mb-1">Horas</span>
            </div>
          </div>
        </Link>
      </section>

      {/* 2 Gráficos de KPI (PIs por mês e % Cumprimento do Plano por ano) */}
      <DashboardTablesClient
        normalTasks={normalActiveTasks}
        projectTasks={projectActiveTasks}
        allTasks={tasks}
        usersList={usersList}
      />
    </div>
  )
}


