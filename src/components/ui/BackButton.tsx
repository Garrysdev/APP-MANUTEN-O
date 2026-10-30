'use client'

import { useRouter } from 'next/navigation'

/**
 * Seta de voltar: regressa à página de onde se veio (ex.: Estatísticas → equipamento →
 * voltar = Estatísticas). Só vai para `fallback` quando não há página anterior (link aberto
 * num separador novo). Antes ia sempre para uma página fixa (lista de OTs/equipamentos).
 */
export default function BackButton({ fallback, className, title = 'Voltar', children }: {
  fallback: string
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      title={title}
      className={className}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      {children}
    </button>
  )
}
