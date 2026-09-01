import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listAssetRefs, listUsers, listExternalCompanies } from '@/lib/firebase/data'
import TasksClient from './TasksClient'

export const dynamic = 'force-dynamic'

function isTaskAssignedToUser(t: any, profile: any): boolean {
  if (!t || !profile) return false

  const pId = String(profile.id || '').toLowerCase().trim()
  const pAbbr = String(profile.abbreviation || '').toLowerCase().trim()
  const pName = String(profile.name || '').toLowerCase().trim()
  const pEmail = String(profile.email || '').toLowerCase().trim()

  // 1. Verificação direta por ID na lista de técnicos atribuídos
  if (t.assignedTo && String(t.assignedTo).toLowerCase().trim() === pId) return true
  if (Array.isArray(t.assignedToIds) && t.assignedToIds.some((id: string) => String(id).toLowerCase().trim() === pId)) return true

  // 2. Análise por tokens do texto de atribuição (ex: "MS+CB", "LM+MS", "MS", "Marco Silva")
  const textToScan = `${t.assignedToText || ''} ${t.assignedTo || ''}`.trim()
  if (textToScan) {
    const tokens = textToScan.split(/[\+,\/&|;\s]+/).map((s) => s.toLowerCase().trim()).filter(Boolean)
    if (pAbbr && tokens.includes(pAbbr)) return true
    if (pId && tokens.includes(pId)) return true
    if (pEmail && tokens.includes(pEmail)) return true
    if (pName && textToScan.toLowerCase().includes(pName)) return true
  }

  // 3. Tarefas criadas explicitamente por este utilizador (nunca 'system')
  if (t.createdBy && t.createdBy !== 'system' && t.createdBy !== 'eu') {
    const c = String(t.createdBy).toLowerCase().trim()
    if (c === pId || (pEmail && c === pEmail)) return true
  }

  return false
}

export default async function TasksPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  // Planos NÃO são carregados aqui — o cliente busca-os sob demanda ao abrir o modal (loadPlanTaskRefsAction).
  const [allTasks, assets, users, externalCompanies] = await Promise.all([
    listTasks(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
    listExternalCompanies(profile.companyId).catch(() => []),
  ])

  const normalTasks = allTasks.filter(
    (t) =>
      (t as any).source !== 'folha_projetos' &&
      !(t as any).isProject
  )

  const roleStr = String(profile.role || '').toLowerCase().trim()
  const isManagerOrAdmin =
    roleStr === 'manager' ||
    roleStr === 'admin' ||
    roleStr === 'gestor' ||
    roleStr === 'administrador' ||
    profile.email?.toLowerCase().trim() === 'garrido.rui@gmail.com'

  const tasks = !isManagerOrAdmin
    ? normalTasks.filter((t) => isTaskAssignedToUser(t, profile))
    : normalTasks

  const activeTasks = tasks.filter((t) => t.status !== 'done')

  return (
    <Suspense fallback={<div className="p-6 text-slate-500 font-medium">A carregar Gestão de OTs...</div>}>
      <TasksClient
        tasks={tasks}
        assets={assets}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          abbreviation: u.abbreviation || u.name,
          avatarUrl: u.avatarUrl,
          active: u.active,
          role: u.role,
          isExternal: u.isExternal,
          externalCompanyId: (u as any).externalCompanyId,
          externalCompanyName: (u as any).externalCompanyName,
        }))}
        externalCompanies={externalCompanies}
        role={isManagerOrAdmin ? 'manager' : profile.role}
        userId={profile.id}
      />
    </Suspense>
  )
}
