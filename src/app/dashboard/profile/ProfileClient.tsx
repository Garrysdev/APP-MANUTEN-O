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

      <div className="card p-6">
        <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-2 text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          Alterar Password
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Define uma nova password para a tua conta diretamente aqui, ou envia o pedido via WhatsApp ao teu gestor.
        </p>
        <ChangePasswordForm profileName={profile.name} abbreviation={profile.abbreviation} />
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

function ChangePasswordForm({ profileName, abbreviation }: { profileName: string; abbreviation?: string | null }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('A nova password deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As passwords não coincidem.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess(false)

    const { changeUserPasswordAction } = await import('./actions')
    const res = await changeUserPasswordAction(newPassword)
    setBusy(false)

    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const waMessage = `Olá! Sou o(a) ${profileName}${abbreviation ? ` (${abbreviation})` : ''} e pretendo alterar/recuperar a minha password no RG Maintenance.`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
            Nova Password *
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
            placeholder="Mínimo 6 caracteres"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
            Confirmar Password *
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="Repete a nova password"
            required
            minLength={6}
          />
        </div>

        {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Password alterada com sucesso!</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-xs font-bold shadow-md">
          {busy ? 'A alterar…' : 'Guardar Nova Password'}
        </button>
      </form>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-500 mb-2">Preferes enviar o pedido ao teu gestor via WhatsApp?</p>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 py-2 px-4 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all shadow-sm"
        >
          <svg className="w-4 h-4 fill-emerald-600" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
          </svg>
          Pedir Alteração de Password via WhatsApp
        </a>
      </div>
    </div>
  )
}
