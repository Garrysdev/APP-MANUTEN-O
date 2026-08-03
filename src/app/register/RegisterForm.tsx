'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { Building2, UserCheck, Eye, EyeOff } from 'lucide-react'

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
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 py-10">
      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#1B4F72]" />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/logo-rg.png"
            alt="RG Maintenance"
            width={200}
            height={112}
            className="mx-auto mb-2"
            priority
          />
          <h1 className="text-2xl font-bold text-gray-900">
            {isInvite ? 'Aceitar convite' : 'Criar conta'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isInvite
              ? 'Cria a tua conta para te juntares à equipa'
              : 'Começa a gerir a manutenção da tua empresa'}
          </p>
        </div>

        {isInvite && inviteCompanyName && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-[#1B4F72] flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{inviteCompanyName}</p>
              <p className="text-xs text-gray-600">
                {inviteRole === 'manager' ? 'Papel: Gestor' : 'Papel: Técnico'}
              </p>
            </div>
            <UserCheck className="h-5 w-5 text-green-600 ml-auto flex-shrink-0" />
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete="new-password"
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
