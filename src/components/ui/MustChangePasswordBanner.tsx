'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { changeUserPasswordAction } from '@/app/dashboard/profile/actions'

export default function MustChangePasswordBanner({ mustChange }: { mustChange?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(!!mustChange)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!mustChange || !open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres.')
      return
    }
    setBusy(true)
    setError('')
    const res = await changeUserPasswordAction(newPassword)
    setBusy(false)
    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        router.refresh()
      }, 1500)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4 text-amber-800 dark:text-amber-300">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 rounded-xl border border-amber-300 dark:border-amber-700">
            <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Alteração Obrigatória de Password</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Por segurança, deves alterar a tua password provisória.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-lg border border-emerald-300 text-center">
            ✓ Password alterada com sucesso! A carregar...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nova Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digita a tua nova password..."
                  className="input text-sm py-2 px-3 pr-10 w-full"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-safety-orange hover:bg-safety-orange/90 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {busy ? 'A guardar...' : 'Guardar Nova Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
