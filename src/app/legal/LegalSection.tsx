interface LegalSectionProps {
  title: string
  children: React.ReactNode
}

/** Bloco de secção numerada, usado pelas páginas /legal/termos e /legal/privacidade. */
export default function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}
