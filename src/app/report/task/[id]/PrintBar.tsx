'use client'

export default function PrintBar({ title }: { title: string }) {
  return (
    <div className="print-bar no-print">
      <span style={{ color: 'white', fontWeight: 600, fontSize: '10pt' }}>
        Relatório · {title}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="close-btn" onClick={() => window.close()}>Fechar</button>
        <button className="print-btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>
    </div>
  )
}
