'use client'

import { useRouter } from 'next/navigation'
import CreateTaskModal from '@/components/modals/CreateTaskModal'

export default function NewTaskPageClient({
  assets,
  users,
  stockRefs,
  isManager,
  initialAssetId,
  initialTitle,
  initialDescription,
  initialTipo,
  initialPhotoUrl,
}: {
  assets: any[]
  users: any[]
  stockRefs: any[]
  isManager: boolean
  initialAssetId?: string
  initialTitle?: string
  initialDescription?: string
  initialTipo?: any
  initialPhotoUrl?: string
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
      initialAssetId={initialAssetId}
      initialTitle={initialTitle}
      initialDescription={initialDescription}
      initialTipo={initialTipo}
      initialPhotoUrl={initialPhotoUrl}
      onSuccess={() => {
        router.push('/dashboard/tasks')
        router.refresh()
      }}
    />
  )
}
