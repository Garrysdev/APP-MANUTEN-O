'use client'

import { useRouter } from 'next/navigation'
import CreateTaskModal from '@/components/modals/CreateTaskModal'

export default function NewTaskPageClient({
  assets,
  users,
  stockRefs,
  isManager,
}: {
  assets: any[]
  users: any[]
  stockRefs: any[]
  isManager: boolean
}) {
  const router = useRouter()

  return (
    <CreateTaskModal
      isOpen={true}
      onClose={() => router.push('/dashboard/tasks')}
      assets={assets}
      users={users}
      stockRefs={stockRefs}
      isManager={isManager}
      onSuccess={() => {
        router.push('/dashboard/tasks')
        router.refresh()
      }}
    />
  )
}
