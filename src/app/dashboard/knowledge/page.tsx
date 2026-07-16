import { BookOpen } from 'lucide-react'
import KnowledgeClient from './KnowledgeClient'
import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function KnowledgePage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-[#2E86C1]" />
            Base de Conhecimento IA
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gere os manuais, normas ISO e PDFs que o teu Consultor IA vai estudar.
          </p>
        </div>
      </div>
      
      <KnowledgeClient isAdmin={profile.role === 'manager'} />
    </div>
  )
}
