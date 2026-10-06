import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface LegalLayoutProps {
  title: string
  updatedAt: string
  children: React.ReactNode
}

/**
 * Esqueleto partilhado pelas páginas públicas /legal/termos e /legal/privacidade.
 * Mantém o mesmo estilo visual da landing page (src/app/page.tsx) sem duplicar
 * a navegação e o rodapé em cada ficheiro.
 */
export default function LegalLayout({ title, updatedAt, children }: LegalLayoutProps) {
  return (
    <div className="bg-white min-h-screen font-sans">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-rg.png" alt="RG Maintenance" width={140} height={78} className="h-12 w-auto" priority />
          </Link>
          <Link href="/" className="text-sm font-bold text-gray-600 hover:text-[#1B4F72] transition-colors">
            ← Voltar ao site
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
          <p>
            <strong>Rascunho.</strong> Este documento é um modelo genérico, ainda não revisto por um
            advogado, e contém campos por confirmar (assinalados com <code className="font-mono text-amber-800">[A CONFIRMAR]</code>).
            Não constitui aconselhamento jurídico. Substituir os dados da entidade legal e rever o
            conteúdo antes de considerar esta página definitiva.
          </p>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">{title}</h1>
        <p className="text-sm font-medium text-slate-400 mb-10">Última atualização: {updatedAt}</p>

        <div className="space-y-8">
          {children}
        </div>
      </main>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-sm font-medium text-slate-400 text-center">
          © {new Date().getFullYear()} RG Maintenance. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  )
}
