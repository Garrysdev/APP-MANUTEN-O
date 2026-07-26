'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'

const TEST_ACCOUNTS = [
  { label: 'Free',       email: 'free@teste.rg',       password: 'Teste123!', role: 'Gestor' },
  { label: 'Starter',    email: 'starter@teste.rg',    password: 'Teste123!', role: 'Gestor' },
  { label: 'Pro',        email: 'pro@teste.rg',        password: 'Teste123!', role: 'Gestor' },
  { label: 'Business',   email: 'business@teste.rg',   password: 'Teste123!', role: 'Gestor' },
  { label: 'Enterprise', email: 'enterprise@teste.rg', password: 'Teste123!', role: 'Gestor' },
  { label: 'Técnico',    email: 'tecnico@teste.rg',    password: 'Teste123!', role: 'Técnico' },
]

export default function LoginPage() {
  const router = useRouter()

  const [usernameInput, setUsernameInput] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      let resolvedEmail = usernameInput.trim()
      if (!resolvedEmail.includes('@')) {
        const resResolve = await fetch('/api/auth/resolve-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: resolvedEmail })
        })
        const dataResolve = await resResolve.json()
        if (dataResolve.email) {
          resolvedEmail = dataResolve.email
        }
      }

      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), resolvedEmail, password)
      const idToken = await cred.user.getIdToken()

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (!res.ok) throw new Error('session')

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('[handleLogin] error:', err)
      setError('Utilizador / Código ou password incorretos.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f4f8] px-4 py-8">

      {/* Barra superior de acento */}
      <div className="fixed top-0 left-0 right-0 h-1.5 bg-[#1B4F72]" />

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/logo-rg.png" alt="RG Maintenance" width={220} height={123} className="mx-auto" priority />
          <p className="mt-3 text-xs font-bold text-slate-700 uppercase tracking-widest">Gestão de Manutenção</p>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-7">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Utilizador / Código ou E-mail
              </label>
              <input
                id="username"
                type="text"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                className="input"
                placeholder="Ex: RG, garrido.rui, LM ou email"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs font-bold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 py-3 text-sm font-bold shadow-md"
            >
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-200 text-center space-y-1.5">
            <p className="text-xs font-medium text-slate-700">
              Ainda não tens conta?{' '}
              <a href="/register" className="text-[#1B4F72] hover:text-safety-orange hover:underline font-bold">Criar conta</a>
            </p>
            <p className="text-[11px] text-slate-600 font-medium">
              Problemas de acesso? Entre em contacto com o gestor da sua empresa.
            </p>
          </div>
        </div>

        {/* Acesso rápido — contas de teste */}
        <div className="mt-6">
          <p className="text-center text-xs text-slate-700 mb-2 uppercase tracking-wide font-bold">Acesso rápido (teste)</p>
          <div className="grid grid-cols-3 gap-2">
            {TEST_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => { setUsernameInput(acc.email); setPassword(acc.password); setError('') }}
                className="text-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-2 py-2 transition-all shadow-sm"
              >
                <p className="text-xs font-bold text-slate-900">{acc.label}</p>
                <p className="text-[10px] font-semibold text-slate-600">{acc.role}</p>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-semibold text-slate-600">
          © {new Date().getFullYear()} RG Maintenance
        </p>
      </div>
    </div>
  )
}
