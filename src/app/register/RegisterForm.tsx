'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { Building2, UserCheck } from 'lucide-react'

interface Props {
  inviteToken: string | null
  inviteCompanyName: string | null
  inviteRole: string | null
  inviteEmail: string | null
}

export default function RegisterForm({ inviteToken, inviteCompanyName, inviteRole, inviteEmail }: Props) {
  const router = useRouter()
  const isInvite = !!inviteToken

  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [email, setEmail] = useState(inviteEmail ?? '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
      const idToken = await cred.user.getIdToken()

      const body = isInvite
        ? { idToken, userName, inviteToken }
        : { idToken, companyName, userName }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'register')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      const msg = (err as { message?: string })?.message
      if (code === 'auth/email-already-in-use') setError('Este e-mail já está registado. Entra na tua conta.')
      else if (code === 'auth/invalid-email') setError('E-mail inválido.')
      else if (msg && msg !== 'register') setError(msg)
      else setError('Não foi possível criar a conta. Tenta novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1B4F72] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg mb-4">
            <span className="text-2xl font-black text-[#1B4F72] tracking-tight">RG</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isInvite ? 'Aceitar convite' : 'Criar conta'}
          </h1>
          <p className="mt-1 text-sm text-blue-200">
            {isInvite
              ? 'Cria a tua conta para te juntares à equipa'
              : 'Começa a gerir a manutenção da tua empresa'}
          </p>
        </div>

        {isInvite && inviteCompanyName && (
          <div className="mb-4 rounded-xl bg-white/10 border border-white/20 px-4 py-3 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-blue-200 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">{inviteCompanyName}</p>
              <p className="text-xs text-blue-200">
                {inviteRole === 'manager' ? 'Papel: Gestor' : 'Papel: Técnico'}
              </p>
            </div>
            <UserCheck className="h-5 w-5 text-green-300 ml-auto flex-shrink-0" />
          </div>
        )}

        <div className="card p-6 shadow-xl">
          <form onSubmit={handleRegister} className="space-y-4">
            {!isInvite && (
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Empresa
                </label>
                <input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input"
                  placeholder="Nome da empresa"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-1.5">
                O teu nome
              </label>
              <input
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="input"
                placeholder="Nome completo"
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="nome@empresa.pt"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Mínimo 6 caracteres"
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'A criar conta…' : isInvite ? 'Juntar à equipa' : 'Criar conta'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Já tens conta?{' '}
            <Link href="/login" className="text-[#2E86C1] hover:underline font-medium">
              Entrar
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-blue-300">© {new Date().getFullYear()} RG Maintenance</p>
      </div>
    </div>
  )
}
