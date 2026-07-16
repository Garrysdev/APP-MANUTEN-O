'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ClipboardList, Package, History, LogOut, X,
  Users, FileBarChart, CreditCard, Lock, UserCircle, Calendar, Wrench, Boxes, Activity, DollarSign, Brain, BookOpen,
  Plus, ShieldCheck
} from 'lucide-react'
import { planHas, type FeatureKey } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { dictionaries, type Language } from '@/lib/i18n/dictionaries'

interface NavItem {
  href: string
  key: string
  icon: React.ElementType
  feature?: FeatureKey
}

interface SidebarProps {
  user: {
    name: string
    role: string
    avatarUrl?: string | null
    company?: { name: string; plan?: string } | null
    language?: string
  }
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface NavGroup {
  groupName: string
  items: NavItem[]
}

const managerNavGroups: NavGroup[] = [
  {
    groupName: 'Base (Free)',
    items: [
      { href: '/dashboard',                    key: 'dashboard',       icon: LayoutDashboard },
      { href: '/dashboard/tasks',              key: 'tasks',           icon: ClipboardList },
      { href: '/dashboard/users',              key: 'users',           icon: Users,          feature: 'users' },
      { href: '/dashboard/history',            key: 'history',         icon: History,        feature: 'history' },
    ]
  },
  {
    groupName: 'Módulos Starter',
    items: [
      { href: '/dashboard/assets',             key: 'assets',          icon: Package,        feature: 'assets' },
      { href: '/dashboard/stocks',             key: 'stocks',          icon: Boxes,          feature: 'stocks' },
      { href: '/dashboard/calendar',           key: 'calendar',        icon: Calendar,       feature: 'calendar' },
      { href: '/dashboard/maintenance-plan',   key: 'maintenancePlan', icon: Wrench,         feature: 'maintenance-plan' },
    ]
  },
  {
    groupName: 'Módulos Pro',
    items: [
      { href: '/dashboard/reports',            key: 'reports',         icon: FileBarChart,   feature: 'reports' },
      { href: '/dashboard/reliability',        key: 'reliability',     icon: Activity,       feature: 'reliability' },
    ]
  },
  {
    groupName: 'Módulos Business',
    items: [
      { href: '/dashboard/finance',            key: 'finance',         icon: DollarSign,     feature: 'finance' },
      { href: '/dashboard/ai',                 key: 'aiConsultant',    icon: Brain,          feature: 'aiConsultant' },
      { href: '/dashboard/knowledge',          key: 'knowledgeBase',   icon: BookOpen,       feature: 'aiConsultant' },
    ]
  },
  {
    groupName: 'Módulos Enterprise',
    items: [
      { href: '/dashboard/compliance', key: 'compliance', icon: ShieldCheck, feature: 'compliance' },
    ]
  },
  {
    groupName: 'Configurações',
    items: [
      { href: '/dashboard/profile',            key: 'profile',         icon: UserCircle },
      { href: '/dashboard/billing',            key: 'upgrade',         icon: CreditCard },
    ]
  }
]

const techNavKeys: NavItem[] = [
  { href: '/dashboard/tasks',   key: 'tasks',   icon: ClipboardList },
  { href: '/dashboard/history', key: 'history', icon: History },
  { href: '/dashboard/profile', key: 'profile', icon: UserCircle },
]

export default function Sidebar({ user, open: externalOpen, onOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null)

  const open = externalOpen !== undefined ? externalOpen : internalOpen
  function setOpen(v: boolean) {
    setInternalOpen(v)
    onOpenChange?.(v)
  }

  const plan = (user.company?.plan ?? 'free') as PlanName
  const lang = (user.language || 'pt') as Language
  const dict = dictionaries[lang] || dictionaries['pt']

  async function handleLogout() {
    await signOut(getFirebaseAuth())
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  const NavLinks = () => (
    <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto custom-scrollbar pt-2">
      {user.role === 'manager' ? (
        managerNavGroups.map((group, idx) => (
          <div key={idx} className="mb-4 last:mb-0">
            <h3 className="px-4 text-[10px] font-mono font-bold text-industrial-blue-light uppercase tracking-widest mb-1.5">
              {group.groupName}
            </h3>
            <div className="flex flex-col gap-1">
              {group.items.map(({ href, key, icon: Icon, feature }) => {
                const isLocked = !!feature && !planHas(plan, feature)
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                const label = dict.sidebar[key as keyof typeof dict.sidebar] || key

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 group',
                      active
                        ? 'bg-safety-orange text-white shadow-md shadow-safety-orange/20 translate-x-1'
                        : 'text-industrial-blue-light hover:text-industrial-blue hover:bg-slate-100'
                    )}
                  >
                    <Icon size={18} className={cn('flex-shrink-0', active ? 'fill-current/20' : '')} />
                    <span className="text-xs uppercase tracking-wider font-mono font-semibold flex-1 text-left">{label}</span>
                    {isLocked && !active && (
                      <Lock className="h-3.5 w-3.5 text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-col gap-1">
          {techNavKeys.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            const label = dict.sidebar[key as keyof typeof dict.sidebar] || key

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 group',
                  active
                    ? 'bg-safety-orange text-white shadow-md shadow-safety-orange/20 translate-x-1'
                    : 'text-industrial-blue-light hover:text-industrial-blue hover:bg-slate-100'
                )}
              >
                <Icon size={18} className={cn('flex-shrink-0', active ? 'fill-current/20' : '')} />
                <span className="text-xs uppercase tracking-wider font-mono font-semibold flex-1 text-left">{label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )

  return (
    <>
      {lockedFeature && (
        <UpgradeModal feature={lockedFeature} onClose={() => setLockedFeature(null)} />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-slate-50 border-r border-outline min-h-screen transition-colors shrink-0 py-6 gap-4">
        <div className="px-6 flex items-center justify-between border-b border-outline/60 pb-4">
          <div className="flex flex-col items-start gap-1">
            <Image src="/logo-rg.png" alt="RG Maintenance" width={140} height={78} className="h-10 w-auto" priority />
            <p className="font-mono text-[9px] text-industrial-blue-light bg-slate-200/50 px-1.5 py-0.5 rounded mt-1 w-fit font-bold">ID: 442-B</p>
          </div>
        </div>
        
        {user.role === 'manager' && (
          <div className="px-6">
            <button onClick={() => router.push('/dashboard/tasks')} className="w-full btn-primary h-10 uppercase text-[11px] tracking-widest font-bold">
              <Plus size={16} />
              Nova Ordem
            </button>
          </div>
        )}

        <NavLinks />
        
        <div className="px-4">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-red-500 hover:bg-red-50 transition-all uppercase tracking-wider font-mono text-[11px] font-bold"
          >
            <LogOut size={16} />
            {dict.sidebar.logout}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-industrial-blue/50 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} />
          <aside className="relative flex w-64 flex-col bg-slate-50 h-full shadow-2xl border-r border-outline transition-transform duration-300 ease-in-out py-6 gap-4">
            <div className="px-6 flex items-center justify-between border-b border-outline/60 pb-4">
              <div className="flex flex-col items-start gap-1">
                <Image src="/logo-rg.png" alt="RG Maintenance" width={110} height={62} className="h-8 w-auto" />
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 text-industrial-blue-light hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            {user.role === 'manager' && (
              <div className="px-6">
                <button onClick={() => { setOpen(false); router.push('/dashboard/tasks'); }} className="w-full btn-primary h-10 uppercase text-[11px] tracking-widest font-bold">
                  <Plus size={16} />
                  Nova Ordem
                </button>
              </div>
            )}

            <NavLinks />

            <div className="px-4">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-red-500 hover:bg-red-50 transition-all uppercase tracking-wider font-mono text-[11px] font-bold"
              >
                <LogOut size={16} />
                {dict.sidebar.logout}
              </button>
            </div>
          </aside>
        </div>
      )}
      
    </>
  )
}
