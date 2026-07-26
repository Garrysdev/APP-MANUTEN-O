import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { CheckCircle, Star, AlertTriangle } from 'lucide-react'
import { UpgradeButton, ManageButton } from './BillingClient'

export const dynamic = 'force-dynamic'

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
  starter: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  business: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const ALL_PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    price: '9€/mês',
    desc: 'Para pequenas oficinas e técnicos autónomos',
    features: ['Até 3 técnicos', 'Até 50 OTs/mês', 'Gestão de Equipamentos Básica', 'Relatórios Simples'],
    tier: 1,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '29€/mês',
    desc: 'Para equipas e PMEs em crescimento',
    features: ['Até 15 técnicos', 'Intervenções & OTs ilimitadas', 'Fiabilidade & KPIs Avançados', 'Relatórios PDF & Excel', 'Gestão de Stocks & Itens Segurança'],
    tier: 2,
  },
  {
    id: 'business' as const,
    name: 'Business',
    price: '79€/mês',
    desc: 'Para operações industriais e multinacionais',
    features: ['Técnicos Ilimitados', 'Consultor IA Global (com RAG & Ficheiros)', 'Fiabilidade & MTBF/MTTR Avançado', 'Gestão Financeira & Projetos', 'Suporte Prioritário 24/7'],
    tier: 3,
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: 'Sob Consulta',
    desc: 'Personalizado para grandes grupos industriais',
    features: ['Infraestrutura Dedicada', 'Integração SAP / ERP', 'SLA Garantido 99.9%', 'Formação de Equipa Presencial'],
    tier: 4,
  },
]

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>
}) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard')

  const params = await searchParams
  const currentPlanId = (profile.company?.plan ?? 'free').toLowerCase()
  
  // Determinar tier atual
  const currentPlanObj = ALL_PLANS.find(p => p.id === currentPlanId) || {
    id: 'free',
    name: 'Free',
    price: 'Grátis',
    desc: 'Plano inicial',
    features: ['Recursos básicos'],
    tier: 0,
  }

  // Upgrades possíveis (apenas planos de nível superior ao atual)
  const availableUpgrades = ALL_PLANS.filter((p) => p.tier > currentPlanObj.tier)

  // Data de validade do plano (calculada ou renovação)
  const planValidityDate = profile.company?.createdAt
    ? new Date(new Date(profile.company.createdAt).setFullYear(new Date(profile.company.createdAt).getFullYear() + 1)).toLocaleDateString('pt-PT')
    : '31/12/2026'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-[#1B4F72] dark:text-slate-100 tracking-tight leading-tight">
          Upgrade & Plano Atual
        </h1>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-wider font-medium">
          {profile.company?.name} · Estado da subscrição e opções de expansão
        </p>
      </div>

      {params.success === '1' && (
        <div className="rounded-xl bg-green-50 dark:bg-emerald-900/30 border border-green-200 dark:border-emerald-800/50 px-4 py-3 flex items-center gap-2 text-green-700 dark:text-emerald-400 text-sm">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          Subscrição actualizada com sucesso! O teu novo plano já está ativo.
        </div>
      )}
      {params.cancelled === '1' && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 px-4 py-3 flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Pagamento cancelado. Nenhuma alteração efetuada.
        </div>
      )}

      {/* Cartão do Plano Atual */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-[#1B4F72] dark:border-blue-500/50 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">O Teu Plano Atual</p>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-[#1B4F72] dark:text-slate-100">
                {PLAN_LABELS[currentPlanId] ?? currentPlanId.toUpperCase()}
              </h2>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${PLAN_COLORS[currentPlanId] ?? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                {currentPlanId === 'free' ? 'Grátis' : 'Ativo'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-right md:text-left">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Validade do Plano</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              Validade / Renovação: {planValidityDate}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-600 dark:text-slate-300">
          <span>Técnicos Ativos: <strong>{profile.company?.maxTechnicians || 'Ilimitados'}</strong></span>
          <span>Módulos Ativos: <strong>Todos Incluídos</strong></span>
          {currentPlanId !== 'free' && currentPlanId !== 'enterprise' && (
            <ManageButton />
          )}
        </div>
      </div>

      {/* Upgrades Possíveis */}
      <div>
        <h2 className="font-extrabold text-gray-900 dark:text-slate-100 text-lg uppercase tracking-wide mb-3 flex items-center gap-2">
          <Star className="h-5 w-5 text-safety-orange" />
          Upgrades Possíveis {availableUpgrades.length > 0 ? `(${availableUpgrades.length})` : ''}
        </h2>

        {availableUpgrades.length === 0 ? (
          <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-base text-slate-800 dark:text-slate-200">Estás no plano máximo (Enterprise)!</p>
            <p className="text-xs mt-1">Não há mais upgrades disponíveis. O teu plano inclui todas as funcionalidades sem limites.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {availableUpgrades.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col justify-between ${
                  plan.id === 'pro' || plan.id === 'business'
                    ? 'border-safety-orange ring-1 ring-safety-orange/20 bg-white dark:bg-slate-900'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-black text-gray-900 dark:text-slate-100 text-xl">{plan.name}</h3>
                    <span className="text-xs font-bold text-safety-orange bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-900">
                      Upgrade Direto
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">{plan.desc}</p>
                  <div className="text-3xl font-black text-[#1B4F72] dark:text-blue-400 mb-4">{plan.price}</div>
                  
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-700 dark:text-slate-300">
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <UpgradeButton
                  plan={plan.id}
                  label={`Subscrever ${plan.name}`}
                  primary={plan.id === 'pro' || plan.id === 'business'}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
