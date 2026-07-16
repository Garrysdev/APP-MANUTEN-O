'use client'

import { X, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PLAN_LABELS, type FeatureKey, minPlanFor } from '@/lib/plans'

const FEATURE_LABELS: Record<FeatureKey, string> = {
  assets:              'Gestão de Equipamentos',
  history:             'Histórico de OTs',
  users:               'Gestão de Utilizadores',
  reports:             'Relatórios Avançados',
  'maintenance-plan':  'Plano de Manutenção',
  calendar:            'Calendário',
  stocks:              'Gestão de Stocks',
  finance:             'Gestão Financeira',
  aiConsultant:        'Consultor IA',
  reliability:         'Fiabilidade & KPIs',
  compliance:          'Compliance ISO & Auditorias',
}

interface UpgradeModalProps {
  feature: FeatureKey
  onClose: () => void
  isTeaser?: boolean
}

export default function UpgradeModal({ feature, onClose, isTeaser = false }: UpgradeModalProps) {
  const router = useRouter()
  const requiredPlan = minPlanFor(feature)
  const featureLabel = FEATURE_LABELS[feature]
  const planLabel = PLAN_LABELS[requiredPlan]

  function goUpgrade() {
    onClose()
    router.push('/dashboard/billing')
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 mb-4 mx-auto">
          <Zap className="h-6 w-6 text-amber-500" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 text-center mb-1">
          {isTeaser ? 'Limite de Demonstração' : 'Funcionalidade bloqueada'}
        </h2>
        <p className="text-sm text-gray-500 text-center mb-5">
          {isTeaser ? (
            <>
              Atingiste o limite do Teaser. O módulo de <span className="font-medium text-gray-700">{featureLabel}</span> está disponível de forma ilimitada a partir do plano <span className="font-semibold text-[#2E86C1]">{planLabel}</span>.
            </>
          ) : (
            <>
              <span className="font-medium text-gray-700">{featureLabel}</span> está disponível a partir do plano <span className="font-semibold text-[#2E86C1]">{planLabel}</span>.
            </>
          )}
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">
            Fechar
          </button>
          <button onClick={goUpgrade} className="btn-primary flex-1 text-sm">
            Ver planos
          </button>
        </div>
      </div>
    </div>
  )
}
