import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listUsers } from '@/lib/firebase/data'
import { formatDate } from '@/lib/utils'
import { ClipboardList, Users, Timer, ArrowUp, ArrowDown, Filter, MoreVertical, AlertTriangle, Plus, Check, Calendar as CalendarIcon, AlertCircle, X, ChevronRight, ArrowLeft, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

const getStatusStyles = (status: string) => {
  switch (status) {
    case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending': return 'bg-slate-50 text-slate-700 border-slate-200';
    case 'vermelho': return 'bg-red-50 text-red-700 border-red-200';
    case 'done': return 'bg-green-50 text-green-700 border-green-200';
    case 'cancelled': return 'bg-slate-50 text-slate-700 border-slate-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const StatCard = ({ label, value, icon: Icon, trend, sub }: { label: string; value: string; icon: any; trend?: string; sub?: string }) => (
  <div className="bg-white border border-outline rounded-lg p-6 flex flex-col justify-between h-[150px] shadow-sm">
    <div className="flex justify-between items-start">
      <span className="font-mono text-xs font-bold text-industrial-blue-light uppercase tracking-wider">{label}</span>
      <Icon size={20} className="text-slate-300" />
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
);

export default async function DashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'technician') redirect('/dashboard/tasks')

  const [tasks, usersList] = await Promise.all([
    listTasks(profile.companyId),
    listUsers(profile.companyId),
  ])

  const technicians = usersList.filter(u => u.role === 'technician');
  
  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const completedTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline/60 pb-5">
        <h1 className="text-3xl font-extrabold text-industrial-blue tracking-tight">Dashboard de Manutenção</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link 
            href="/dashboard/tasks"
            className="flex-1 sm:flex-initial h-11 px-5 bg-white border border-outline text-industrial-blue rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <ClipboardList size={18} className="text-industrial-blue-light" />
            <span>Gestão de Tarefas</span>
          </Link>
          <Link 
            href="/dashboard/tasks?create=true"
            className="flex-1 sm:flex-initial h-11 px-5 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Plus size={18} className="stroke-[2.5]" />
            <span>Nova Intervenção</span>
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Ordens Ativas" value={activeTasks.length.toString()} icon={ClipboardList} trend="+12%" />
        <StatCard 
          label="Técnicos Online" 
          value={Math.round(technicians.length * 0.8).toString()} 
          icon={Users} 
          sub={`/ ${technicians.length} Ativos`} 
        />
        <StatCard label="Tempo Médio Resolução" value="4.2" icon={Timer} sub="hrs" trend="-0.5h" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-white border border-outline rounded-lg overflow-hidden flex flex-col shadow-sm">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-industrial-blue">Tarefas Ativas e Atribuídas</h3>
              <p className="text-xs text-industrial-blue-light font-medium mt-1">Lista de ordens em curso ou aguardando início.</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link 
                href="/dashboard/tasks"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-slate-50 border border-outline text-sm font-bold text-industrial-blue rounded-lg hover:bg-slate-100 transition-colors"
              >
                Geral de Tarefas
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-b border-outline">
                <tr>
                  <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">ID Ordem</th>
                  <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">Equipamento</th>
                  <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">Técnico</th>
                  <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">Estado</th>
                  <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">Data Agendada</th>
                  <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider text-center">Prioridade</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-industrial-blue">
                {activeTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">Nenhuma ordem de serviço ativa.</td>
                  </tr>
                ) : activeTasks.slice(0, 8).map((order) => (
                  <tr 
                    key={order.id} 
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                  >
                    <td className="py-4 px-6 font-mono text-industrial-blue-light uppercase">
                      <Link href={`/dashboard/tasks/${order.id}`}>{order.id.slice(0, 8)}</Link>
                    </td>
                    <td className="py-4 px-6 font-bold group-hover:text-safety-orange transition-colors">
                      <Link href={`/dashboard/tasks/${order.id}`}>{order.title}</Link>
                    </td>
                    <td className="py-4 px-6 text-industrial-blue-light">
                      {usersList.find(u => u.id === order.assignedTo)?.name || 'Sem Atribuição'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusStyles(order.status === 'in_progress' && order.criticidade === 'vermelho' ? 'vermelho' : order.status)}`}>
                        {order.status === 'in_progress' ? (order.criticidade === 'vermelho' ? 'Emergência' : 'Em Curso') : 
                         order.status === 'pending' ? 'Atribuída' : 'Desconhecido'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-industrial-blue-light text-xs font-mono">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {order.criticidade === 'vermelho' ? (
                        <AlertTriangle size={18} className="text-red-500 mx-auto" />
                      ) : (
                        <div className={`w-1.5 h-1.5 rounded-full mx-auto ${order.criticidade === 'amarelo' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-outline rounded-lg p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <CalendarIcon className="text-safety-orange" size={24} />
            <div>
              <h3 className="font-bold text-industrial-blue">Próximas Tarefas</h3>
              <p className="text-[10px] font-bold text-industrial-blue-light uppercase tracking-widest">A aguardar início</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            {activeTasks.filter(o => o.status === 'pending').slice(0, 5).map(order => (
              <div key={order.id} className="flex flex-col gap-1 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-industrial-blue-light">{formatDate(order.createdAt)}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getStatusStyles(order.status)}`}>Pendente</span>
                </div>
                <p className="text-xs font-bold text-industrial-blue truncate">{order.title}</p>
                <p className="text-[10px] text-industrial-blue-light italic">Técnico: {usersList.find(u => u.id === order.assignedTo)?.name || 'Sem Atribuição'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white border border-outline rounded-lg overflow-hidden flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <div>
            <h3 className="text-lg font-bold text-industrial-blue">Histórico Recente para Revisão (Admin)</h3>
            <p className="text-xs text-industrial-blue-light font-medium mt-1">Ordens concluídas que podem necessitar de reabertura ou auditoria.</p>
          </div>
          <AlertCircle size={20} className="text-safety-orange/50" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-outline">
              <tr>
                <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">ID Ordem</th>
                <th className="font-mono text-xs font-bold text-industrial-blue-light py-3 px-6 uppercase tracking-wider">Equipamento</th>
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
                    <Link href={`/dashboard/tasks/${order.id}`}>{order.id.slice(0, 8)}</Link>
                  </td>
                  <td className="py-4 px-6 font-bold">{order.title}</td>
                  <td className="py-4 px-6 text-industrial-blue-light text-xs font-mono">
                    {order.updatedAt ? formatDate(order.updatedAt) : '-'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Link 
                      href={`/dashboard/tasks/${order.id}`}
                      className="px-4 py-2 bg-safety-orange text-white text-[10px] font-bold uppercase rounded-lg hover:bg-safety-orange/90 transition-all shadow-lg shadow-safety-orange/10 inline-flex items-center gap-2"
                    >
                      <Plus size={14} className="rotate-45" />
                      Ver Detalhes
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


