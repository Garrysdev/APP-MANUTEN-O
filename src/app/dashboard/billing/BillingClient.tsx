'use client'

import { useState } from 'react'
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react'

interface UpgradeButtonProps {
  plan: 'pro' | 'business'
  label: string
  primary?: boolean
}

export function UpgradeButton({ plan, label, primary = false }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'Erro ao criar sessão de pagamento.')
        setLoading(false)
      }
    } catch {
      alert('Erro de rede. Tenta novamente.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-2 w-full justify-center py-2.5 text-sm rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        primary ? 'btn-primary' : 'btn-secondary'
      }`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
      {!loading && <ArrowRight className="h-4 w-4" />}
    </button>
  )
}

export function ManageButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'Erro ao abrir portal de faturação.')
        setLoading(false)
      }
    } catch {
      alert('Erro de rede. Tenta novamente.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-secondary flex items-center gap-2 w-full justify-center py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
      Gerir subscrição
    </button>
  )
}
