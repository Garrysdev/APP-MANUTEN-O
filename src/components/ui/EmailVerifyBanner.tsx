'use client'

import { useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { MailWarning, X, CheckCircle } from 'lucide-react'

export default function EmailVerifyBanner() {
  const [sent, setSent] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  if (dismissed) return null

  async function handleResend() {
    setBusy(true)
    try {
      const user = getFirebaseAuth().currentUser
      if (user) await sendEmailVerification(user)
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 text-sm">
      <MailWarning className="h-4 w-4 text-amber-600 flex-shrink-0" />
      <span className="text-amber-800 flex-1">
        {sent
          ? 'E-mail de verificação enviado. Verifica a tua caixa de entrada.'
          : 'Verifica o teu e-mail para ativar todas as funcionalidades.'}
      </span>
      {!sent && (
        <button
          onClick={handleResend}
          disabled={busy}
          className="text-amber-700 font-medium hover:underline whitespace-nowrap"
        >
          {busy ? 'A enviar…' : 'Reenviar e-mail'}
        </button>
      )}
      {sent && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
      <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 ml-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
