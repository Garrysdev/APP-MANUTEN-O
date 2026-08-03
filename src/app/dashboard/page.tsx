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
  if (profile.role === 'technician') redirect('/dashboard/tasks')

  const [tasks, usersList] = await Promise.all([
    listTasks(profile.companyId),
    listUsers(profile.companyId),
  ])

  const technicians = usersList.filter(u => u.role === 'technician' && u.active !== false);
  const totalActiveUsers = usersList.filter(u => u.active !== false);
  
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

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Ordens Ativas" value={normalActiveTasks.length.toString()} icon={ClipboardList} href="/dashboard/tasks" />
        <StatCard 
          label="Técnicos Ativos" 
          value={technicians.length.toString()} 
          icon={Users} 
          sub={`de ${totalActiveUsers.length} Ativos`} 
          href="/dashboard/users"
        />
        <StatCard label="Tempo Médio Resolução" value={avgResolutionHours} icon={Timer} sub="hrs" href="/dashboard/history" />
      </section>

      {/* Quadros Lado a Lado: OTs Ativas e Atribuídas (Esquerdo) + Projetos (Direito) com Filtros por Colunas */}
      <DashboardTablesClient
        normalTasks={normalActiveTasks}
        projectTasks={projectActiveTasks}
        usersList={usersList}
      />

      <section className="bg-white border border-outline rounded-lg overflow-hidden flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <div>
            <h3 className="text-lg font-bold text-industrial-blue">Histórico Recente para Revisão (Admin)</h3>
            <p className="text-xs text-industrial-blue-light font-medium mt-1">Ordens concluídas que podem necessitar de reabertura ou auditoria.</p>
          </div>
          <Link href="/dashboard/history" className="flex items-center gap-2 text-xs font-bold text-safety-orange hover:underline">
            <span>Ver Histórico Completo</span>
            <AlertCircle size={18} className="text-safety-orange" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-outline">
              <tr>
                <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">ID Ordem</th>
                <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">Equipamento / Tarefa</th>
                <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">Data de Conclusão</th>
                <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-industrial-blue">
              {completedTasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 italic font-medium">Nenhuma tarefa concluída recentemente.</td>
                </tr>
              ) : completedTasks.slice(0, 5).map((order) => (
                <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-mono text-industrial-blue-light uppercase">
                    <Link href="/dashboard/history" className="hover:underline">{order.id.slice(0, 8)}</Link>
                  </td>
                  <td className="py-4 px-6 font-bold">
                    <Link href="/dashboard/history" className="hover:text-safety-orange transition-colors">{order.title}</Link>
                  </td>
                  <td className="py-4 px-6 text-industrial-blue-light text-xs font-mono">
                    {order.updatedAt ? formatDate(order.updatedAt) : '-'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Link 
                      href="/dashboard/history"
                      className="px-4 py-2 bg-safety-orange text-white text-[10px] font-bold uppercase rounded-lg hover:bg-safety-orange/90 transition-all shadow-lg shadow-safety-orange/10 inline-flex items-center gap-2"
                    >
                      <Plus size={14} className="rotate-45" />
                      Ver Histórico
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}


