import Link from 'next/link'
import { Lock } from 'lucide-react'

/**
 * Mensagem única para qualquer registo que não existe OU não pertence à empresa de quem
 * abre o link (OT, equipamento, stock, relatório). Nunca distinguir os dois casos —
 * "existe mas é de outra empresa" já seria informação a mais.
 */
export default function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <Lock className="h-10 w-10 mx-auto mb-4 text-safety-orange" />
        <h1 className="text-xl font-extrabold text-industrial-blue dark:text-slate-100 mb-2">Acesso não autorizado</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Este registo não existe ou não pertence à sua empresa.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-safety-orange hover:bg-safety-orange/90 text-white text-xs font-bold"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
