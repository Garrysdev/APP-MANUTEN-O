'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { Eye, EyeOff } from 'lucide-react'

const TEST_ACCOUNTS = [
  { label: 'Free',       email: 'free@teste.rg',       password: 'Teste123!', role: 'Gestor' },
  { label: 'Starter',    email: 'starter@teste.rg',    password: 'Teste123!', role: 'Gestor' },
  { label: 'Pro',        email: 'pro@teste.rg',        password: 'Teste123!', role: 'Gestor' },
  { label: 'Business',   email: 'business@teste.rg',   password: 'Teste123!', role: 'Gestor' },
  { label: 'Enterprise', email: 'enterprise@teste.rg', password: 'Teste123!', role: 'Gestor' },
  { label: 'Técnico (RG - RuiG)', email: 'tecnico@teste.rg', password: 'Teste123!', role: 'Técnico' },
]

export default function LoginPage() {
  const router = useRouter()

  const [usernameInput, setUsernameInput] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title={showPassword ? "Ocultar password" : "Mostrar password"}
                  aria-label={showPassword ? "Ocultar password" : "Mostrar password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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

          <div className="mt-5 pt-5 border-t border-slate-200 text-center space-y-3">
            <a
              href="https://wa.me/?text=Ol%C3%A1,%20esqueci-me%20da%20minha%20password%20no%20RG%20Maintenance%20e%20pretendo%20alterar/recuperar%20o%20acesso."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 py-2.5 px-4 rounded-xl hover:bg-emerald-100 transition-all shadow-sm"
            >
              <svg className="w-4 h-4 fill-emerald-600" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
              </svg>
              Recuperar / Alterar Password via WhatsApp
            </a>
            <p className="text-xs font-medium text-slate-700">
              Ainda não tens conta?{' '}
              <a href="/register" className="text-[#1B4F72] hover:text-safety-orange hover:underline font-bold">Criar conta</a>
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
