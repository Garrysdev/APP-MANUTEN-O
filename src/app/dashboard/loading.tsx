import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
      <Loader2 className="h-10 w-10 text-[#2E86C1] animate-spin mb-4" />
      <h2 className="text-lg font-medium text-gray-700 dark:text-slate-300">A carregar dados...</h2>
      <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">A comunicar com a base de dados em tempo real</p>
    </div>
  )
}
