import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssets, listDocRecords, listDocuments, listUsers } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName, User } from '@/types/models'
import ArchiveClient from './ArchiveClient'

export const metadata = {
  title: 'Arquivo de FR/IT | RG Maintenance',
}

function isInternalTechnician(u: User): boolean {
  return u.role === 'technician' && u.active !== false && u.isExternal !== true
    && !(u.externalCompanyId || '').trim() && !(u.externalCompanyName || '').trim()
}

export default async function DocumentArchivePage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'documents')) redirect('/dashboard/billing?feature=documents')

  const [records, docs, assets, users] = await Promise.all([
    listDocRecords(profile.companyId),
    listDocuments(profile.companyId),
    listAssets(profile.companyId),
    listUsers(profile.companyId),
  ])
  const docInfo = Object.fromEntries(docs.map((d) => [d.id, { code: d.code || '', title: d.title }]))

  // Listas dos filtros: Área/TAG do cadastro de equipamentos + as que já aparecem nos registos;
  // "Assinado por" = técnicos internos + quem já assinou (para nenhum registo ficar de fora).
  const areaTags = Array.from(new Map(
    [...assets.filter((a) => a.active !== false), ...records]
      .filter((x) => (x.area || '').trim() || (x.tag || '').trim())
      .map((x) => {
        const pair = { area: (x.area || '').trim(), tag: (x.tag || '').trim() }
        return [`${pair.area}|${pair.tag}`, pair] as const
      })
  ).values())
  const signers = Array.from(new Set([
    ...users.filter(isInternalTechnician).map((u) => (u.name || '').trim()),
    ...records.map((r) => (r.signedBy || '').trim()),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt'))

  return <ArchiveClient records={records} docInfo={docInfo} areaTags={areaTags} signers={signers} />
}
