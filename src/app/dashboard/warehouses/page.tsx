import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listWarehouses } from '@/lib/firebase/data'
import WarehousesClient from './WarehousesClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Armazéns | RG Maintenance',
}

export default async function WarehousesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const warehouses = await listWarehouses(profile.companyId)

  return <WarehousesClient initialWarehouses={warehouses} />
}
