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

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
      const idToken = await cred.user.getIdToken()

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (!res.ok) throw new Error('session')

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('E-mail ou password incorrectos.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">

      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#1B4F72]" />

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <Image src="/logo-rg.png" alt="RG Maintenance" width={200} height={112} className="mx-auto " priority />
          <p className="mt-2 text-sm text-gray-400 font-medium uppercase tracking-widest">Gestão de Manutenção</p>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-7">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="nome@empresa.pt"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
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
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-1 py-3 text-base"
            >
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center space-y-1">
            <p className="text-sm text-gray-500">
              Ainda não tens conta?{' '}
              <a href="/register" className="text-[#1B4F72] hover:underline font-semibold">Criar conta</a>
            </p>
            <p className="text-xs text-gray-400">
              Problemas de acesso? Contacta o gestor da tua empresa.
            </p>
          </div>
        </div>

        {/* Acesso rápido — contas de teste */}
        <div className="mt-5">
          <p className="text-center text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">Acesso rápido (teste)</p>
          <div className="grid grid-cols-3 gap-2">
            {TEST_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => { setEmail(acc.email); setPassword(acc.password); setError('') }}
                className="text-center rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 px-2 py-2 transition-colors"
              >
                <p className="text-xs font-semibold text-gray-700">{acc.label}</p>
                <p className="text-[10px] text-gray-400">{acc.role}</p>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-300">
          © {new Date().getFullYear()} RG Maintenance
        </p>
      </div>
    </div>
  )
}
