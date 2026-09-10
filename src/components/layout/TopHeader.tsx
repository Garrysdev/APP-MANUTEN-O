'use client'

import { Bell, Search, Settings, Menu } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import NotificationBell from './NotificationBell'

export default function TopHeader({ user, onMenuClick }: { user: any, onMenuClick?: () => void }) {
  const router = useRouter()

  return (
    <header className="flex justify-between items-center w-full px-4 lg:px-6 h-16 bg-white border-b border-outline shrink-0 sticky top-0 z-40">
      <div className="flex items-center gap-3 lg:gap-6">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-industrial-blue-light hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
        )}
        <Image
          src="/logo-rg.png"
          alt="RG Maintenance"
          width={100}
          height={56}
          className="lg:hidden h-8 w-auto"
        />

        
        <div className="hidden md:flex items-center bg-background rounded-full px-4 py-1.5 border border-transparent focus-within:border-safety-orange transition-all">
          <Search size={18} className="text-industrial-blue-light mr-2" />
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-industrial-blue w-64 p-0 placeholder:text-industrial-blue-light outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell initialNotifications={user?.notifications || []} />
        <button 
          onClick={() => router.push('/dashboard/profile')}
          className="hidden sm:flex p-2 text-industrial-blue-light hover:bg-slate-100 rounded-full transition-colors"
        >
          <Settings size={20} />
        </button>
        <Link 
          href="/dashboard/profile"
          className="flex items-center gap-2 ml-1 sm:ml-2 pl-2 sm:pl-4 border-l border-outline cursor-pointer group active:opacity-75 transition-opacity"
          title="Abrir Perfil do Utilizador"
        >
          <div className="h-8 w-8 rounded-full bg-slate-200 border border-outline overflow-hidden group-hover:ring-2 group-hover:ring-safety-orange transition-all shrink-0">
            {user?.avatarUrl ? (
              <Image 
                src={user.avatarUrl} 
                alt="User" 
                width={32} 
                height={32} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-industrial-blue text-white font-bold text-xs uppercase">
                {user?.abbreviation || user?.name?.split(' ').map((n: string) => n[0]).join('').substring(0,2) || 'U'}
              </div>
            )}
          </div>
          <div className="block text-left">
            <p className="text-xs font-bold text-industrial-blue group-hover:text-safety-orange transition-colors truncate max-w-[110px] sm:max-w-[190px]">
              {user?.abbreviation ? `[${user.abbreviation}] ` : ''}{user?.name ? user.name.replace(/^([A-Z]{2,4}\s*[-–—]\s*)/i, '').trim() : 'Carregando...'}
            </p>
            <p className="text-[9px] sm:text-[10px] text-industrial-blue-light font-mono font-bold tracking-wider uppercase">
              {user?.role === 'manager' ? 'Gestor' : 'Técnico'}
            </p>
          </div>
        </Link>
      </div>
    </header>
  )
}
