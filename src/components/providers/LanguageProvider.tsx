'use client'

import { createContext, useContext } from 'react'
import { dictionaries, type Dictionary, type Language } from '@/lib/i18n/dictionaries'

interface LanguageContextType {
  lang: Language
  dict: Dictionary
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({
  lang,
  children
}: {
  lang: string
  children: React.ReactNode
}) {
  const language = (lang || 'pt') as Language
  const dict = dictionaries[language] || dictionaries['pt']

  return (
    <LanguageContext.Provider value={{ lang: language, dict }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
