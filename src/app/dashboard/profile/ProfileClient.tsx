'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mail, Building2, Shield, Save, KeyRound, Camera, Lock } from 'lucide-react'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import { useLanguage } from '@/components/providers/LanguageProvider'
import type { UserProfile } from '@/types/models'
import { ROLE_LABELS } from '@/types/models'
import { updateProfileAction } from './actions'

export default function ProfileClient({ profile }: { profile: UserProfile }) {
  const router = useRouter()
  const { dict } = useLanguage()
  const [name, setName] = useState(profile.name)
  const [abbreviation, setAbbreviation] = useState(profile.abbreviation || '')
  const [language, setLanguage] = useState(profile.language || 'pt')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = profile.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (!original) return
    const file = await compressImage(original, 512)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccess(false)

    try {
      let avatarUrl: string | null = null

      let avatarFailed = false
      if (avatarFile) {
        setUploadingAvatar(true)
        try {
          avatarUrl = await uploadImage(avatarFile, 'avatars')
        } catch {
          avatarFailed = true
        } finally {
          setUploadingAvatar(false)
        }
      }

      const fd = new FormData()
      fd.set('name', name)
      fd.set('abbreviation', abbreviation)
      fd.set('language', language)
      if (avatarUrl) fd.set('avatarUrl', avatarUrl)
      const result = await updateProfileAction({}, fd)

      setBusy(false)
      if (result.error) setError(result.error)
      else if (avatarFailed) {
        setError('Perfil guardado, mas a foto não foi carregada. Tenta novamente.')
        setAvatarFile(null)
        router.refresh()
      }
      else {
        setSuccess(true)
        setAvatarFile(null)
        router.refresh()
      }
    } catch (err) {
      setUploadingAvatar(false)
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Erro ao guardar.')
    }
  }

  const currentAvatar = avatarPreview ?? profile.avatarUrl

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{dict.profile.title}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{dict.profile.desc}</p>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {currentAvatar ? (
              <Image
                src={currentAvatar}
                alt={profile.name}
                width={72}
                height={72}
                className="h-18 w-18 rounded-full object-cover border-2 border-gray-100 dark:border-slate-700"
                style={{ width: 72, height: 72 }}
              />
            ) : (
              <div className="h-[72px] w-[72px] rounded-full bg-[#2E86C1] flex items-center justify-center border-2 border-gray-100 dark:border-slate-700">
                <span className="text-xl font-bold text-white">{initials}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-gray-500 dark:text-slate-400 hover:text-[#2E86C1] dark:hover:text-blue-400 transition-colors"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{profile.name}</p>
              {profile.abbreviation && (
                <span className="font-mono font-bold text-xs bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600">
                  {profile.abbreviation}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500">{ROLE_LABELS[profile.role]}</p>
            {avatarFile && (
              <p className="text-xs text-[#2E86C1] dark:text-blue-400 mt-0.5">Nova foto selecionada</p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 mb-6">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> Informação da conta · gerida pelo sistema
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">E-mail</p>
              <p className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                {profile.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">Papel</p>
              <p className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400">
                <Shield className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                {ROLE_LABELS[profile.role]}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">Empresa</p>
              <p className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400">
                <Building2 className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                {profile.company?.name ?? '—'}
              </p>
            </div>
            {profile.role === 'manager' && profile.company?.plan && (
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">Plano</p>
                <p className="text-[#2E86C1] dark:text-blue-400 font-semibold capitalize">{profile.company.plan}</p>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 border-t border-gray-100 dark:border-slate-800 pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Nome completo</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Abreviatura / Código (3 dígitos)</label>
              <input
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
                className="input font-mono font-bold uppercase"
                placeholder="Ex: RG, LM, MS"
                maxLength={6}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.profile.language}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              className="input max-w-sm"
            >
              <option value="pt">Português (PT)</option>
              <option value="en">English (EN)</option>
              <option value="es">Español (ES)</option>
              <option value="fr">Français (FR)</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-600 dark:text-emerald-400">Perfil atualizado com sucesso.</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={busy || uploadingAvatar} className="btn-primary">
              {uploadingAvatar ? dict.common.loading : busy ? dict.common.loading : dict.common.save}
            </button>
          </div>
        </form>
      </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.profile.language}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              className="input max-w-sm"
            >
              <option value="pt">Português (PT)</option>
              <option value="en">English (EN)</option>
              <option value="es">Español (ES)</option>
              <option value="fr">Français (FR)</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-600 dark:text-emerald-400">Perfil atualizado com sucesso.</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={busy || uploadingAvatar} className="btn-primary">
              {uploadingAvatar ? dict.common.loading : busy ? dict.common.loading : dict.common.save}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-2 text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          Alterar password
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Será enviado um e-mail para <strong>{profile.email}</strong> com instruções de recuperação.
        </p>
        <ResetPasswordButton email={profile.email} />
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-2 text-base flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Notificações no Telemóvel (Web Push)
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Recebe alertas imediatos de novas tarefas e avisos urgentes diretamente no ecrã do teu telemóvel ou PC.
        </p>
        <WebPushButton userId={profile.id} isSubscribed={!!profile.pushSubscription} />
      </div>
    </div>
  )
}

function WebPushButton({ userId, isSubscribed }: { userId: string, isSubscribed: boolean }) {
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(isSubscribed)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubscribe() {
    setBusy(true)
    setError('')
    try {
      const { subscribeToPushNotifications } = await import('@/lib/webpush-client')
      const result = await subscribeToPushNotifications(userId)
      if (result) {
        setSuccess(true)
        router.refresh()
      } else {
        setError('Falha ao ativar notificações. Verifica as permissões do browser.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar notificações.')
    } finally {
      setBusy(false)
    }
  }

  if (success) return <p className="text-sm text-green-600 dark:text-emerald-400 font-medium">✓ Notificações ativas neste dispositivo</p>

  return (
    <div className="space-y-2">
      <button onClick={handleSubscribe} disabled={busy} className="btn-primary">
        {busy ? 'A ativar...' : 'Ativar Notificações'}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function ResetPasswordButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleReset() {
    setBusy(true)
    try {
      const { getFirebaseAuth } = await import('@/lib/firebase/client')
      const { sendPasswordResetEmail } = await import('firebase/auth')
      await sendPasswordResetEmail(getFirebaseAuth(), email)
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  if (sent) return <p className="text-sm text-green-600">E-mail de recuperação enviado. Verifica a tua caixa de entrada.</p>
  return (
    <button onClick={handleReset} disabled={busy} className="btn-secondary">
      {busy ? 'A enviar…' : 'Enviar e-mail de recuperação'}
    </button>
  )
}
