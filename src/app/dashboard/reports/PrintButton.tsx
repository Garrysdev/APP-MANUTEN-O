'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 no-print">
      <Printer className="h-4 w-4" />
      Imprimir / PDF
    </button>
  )
}
