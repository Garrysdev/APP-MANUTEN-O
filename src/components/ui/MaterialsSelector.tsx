'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, X, Package, Check, Sparkles } from 'lucide-react'
import { createStockItemAction } from '@/app/dashboard/stocks/actions'

export interface StockItemRef {
  id: string
  name: string
  unit: string | null
}

export default function MaterialsSelector({
  items,
  onChange,
  stockRefs = [],
  onStockItemCreated,
}: {
  items: string[]
  onChange: (items: string[]) => void
  stockRefs?: StockItemRef[]
  onStockItemCreated?: (newItem: StockItemRef) => void
}) {
  const [addingNew, setAddingNew] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [addToStock, setAddToStock] = useState(true)
  const [initialQty, setInitialQty] = useState('10')
  const [unit, setUnit] = useState('unidade')
  const [creating, setCreating] = useState(false)

  function handleSelectExisting(index: number, value: string) {
    const updated = [...items]
    updated[index] = value
    onChange(updated)
  }

  function handleRemove(index: number) {
    const updated = items.filter((_, i) => i !== index)
    onChange(updated)
  }

  function handleAddLine() {
    onChange([...items, ''])
  }

  async function handleCreateNewMaterial(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName.trim()) return

    const name = newItemName.trim()
    setCreating(true)

    try {
      if (addToStock) {
        const fd = new FormData()
        fd.set('name', name)
        fd.set('quantity', initialQty || '10')
        fd.set('unit', unit || 'unidade')
        const res = await createStockItemAction({}, fd)
        if (res.ok && onStockItemCreated) {
          onStockItemCreated({ id: Math.random().toString(), name, unit })
        }
      }

      // Adicionar à lista da OT
      const updated = [...items, name]
      onChange(updated)

      // Reset form
      setNewItemName('')
      setAddingNew(false)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-slate-500" /> Materiais a utilizar
        </label>
        <Link
          href="/dashboard/stocks"
          className="text-[11px] font-bold text-safety-orange hover:underline"
        >
          Gerir inventário em Stocks ↗
        </Link>
      </div>

      {/* Lista de Seleção de Materiais */}
      <div className="space-y-2">
        {items.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={val}
              onChange={(e) => handleSelectExisting(i, e.target.value)}
              className="input flex-1 text-xs"
            >
              <option value="">— Selecionar do Inventário —</option>
              {stockRefs.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} {s.unit ? `(${s.unit})` : ''}
                </option>
              ))}
              {val && !stockRefs.some((s) => s.name === val) && (
                <option value={val}>{val} (Novo/Avulso)</option>
              )}
            </select>

            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="text-slate-400 hover:text-red-500 p-1 flex-shrink-0"
              title="Remover material"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Opções de Adicionar */}
      {!addingNew ? (
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleAddLine}
            className="text-xs font-bold text-safety-orange hover:text-safety-orange/80 transition-colors flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar material do Stock
          </button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="text-xs font-bold text-industrial-blue dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Sparkles className="h-3.5 w-3.5" /> + Introduzir Novo Consumível
          </button>
        </div>
      ) : (
        /* Formulário Inline de Novo Consumível */
        <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-3 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-industrial-blue dark:text-blue-300">Novo Consumível</span>
            <button
              type="button"
              onClick={() => setAddingNew(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Consumível *</label>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Ex: Rolamento SKF 6204, Óleo Sintético 5W30..."
              className="input text-xs"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="addToStockChk"
              checked={addToStock}
              onChange={(e) => setAddToStock(e.target.checked)}
              className="rounded border-slate-300 text-safety-orange focus:ring-safety-orange h-4 w-4"
            />
            <label htmlFor="addToStockChk" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
              Adicionar este artigo ao Inventário de Stock?
            </label>
          </div>

          {addToStock && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Stock Inicial (Qtd)</label>
                <input
                  type="number"
                  value={initialQty}
                  onChange={(e) => setInitialQty(e.target.value)}
                  className="input text-xs"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Unidade</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="unidade, kg, L, m..."
                  className="input text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddingNew(false)}
              className="btn-secondary text-xs py-1 px-3"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateNewMaterial}
              disabled={creating || !newItemName.trim()}
              className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" /> {creating ? 'A guardar...' : 'Confirmar & Adicionar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
