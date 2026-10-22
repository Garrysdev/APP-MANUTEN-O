'use client'

import { createContext, useContext } from 'react'

// Nome e logótipo da empresa (Perfil → Empresa) para os componentes de cliente que geram
// documentos: pré-visualização de FR, Excel/PDF exportados, cabeçalho de impressão.
export type Branding = { companyName: string | null; logoUrl: string | null }

const BrandingContext = createContext<Branding>({ companyName: null, logoUrl: null })

export function BrandingProvider({ value, children }: { value: Branding; children: React.ReactNode }) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding(): Branding {
  return useContext(BrandingContext)
}
