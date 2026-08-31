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

  let derivedAbbr = pAbbr
  if (!derivedAbbr && pName) {
    const parenMatch = pName.match(/\(([^)]+)\)/)
    if (parenMatch) {
      derivedAbbr = parenMatch[1].toLowerCase().trim()
    } else {
      const parts = pName.split(' ').filter(Boolean)
      if (parts.length >= 2) {
        derivedAbbr = (parts[0][0] + parts[parts.length - 1][0]).toLowerCase()
      }
    }
  }

  const assignedTo = String(t.assignedTo || '').toLowerCase().trim()
  const assignedToText = String((t as any).assignedToText || '').toLowerCase().trim()
  const assignedIds = Array.isArray(t.assignedToIds)
    ? t.assignedToIds.map((x: any) => String(x || '').toLowerCase().trim())
    : []

  if (assignedTo) {
    if (pId && assignedTo === pId) return true
    if (pAbbr && assignedTo === pAbbr) return true
    if (derivedAbbr && assignedTo === derivedAbbr) return true
    if (pName && (assignedTo === pName || pName.includes(assignedTo))) return true
  }

  if (assignedToText) {
    if (pId && assignedToText.includes(pId)) return true
    if (pAbbr && assignedToText.includes(pAbbr)) return true
    if (derivedAbbr && assignedToText.includes(derivedAbbr)) return true
    if (pName && assignedToText.includes(pName)) return true
  }

  if (assignedIds.length > 0) {
    if (pId && assignedIds.includes(pId)) return true
    if (pAbbr && assignedIds.includes(pAbbr)) return true
    if (derivedAbbr && assignedIds.includes(derivedAbbr)) return true
    if (pName && assignedIds.some((id) => id === pName || id.includes(pName) || pName.includes(id))) return true
  }

  if (t.createdBy && pId && String(t.createdBy).toLowerCase().trim() === pId) {
    return true
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
      !(t as any).isProject &&
      !(t.description || '').toLowerCase().includes('projecto') &&
      !(t.description || '').toLowerCase().includes('projeto')
  )

  const isRGAdmin = profile.email?.toLowerCase().trim() === 'garrido.rui@gmail.com'
  const isTechnician = profile.role === 'technician' && !isRGAdmin

  const tasks = isTechnician
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
        role={isRGAdmin ? 'manager' : profile.role}
        userId={profile.id}
      />
    </Suspense>
  )
}
