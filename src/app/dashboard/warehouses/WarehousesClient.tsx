'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Warehouse as WarehouseIcon, Plus, Trash2, Edit2, MapPin } from 'lucide-react'
import type { Warehouse } from '@/types/models'
import { createWarehouseAction, updateWarehouseAction, deleteWarehouseAction } from './actions'

export default function WarehousesClient({ initialWarehouses }: { initialWarehouses: Warehouse[] }) {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setWarehouses(initialWarehouses)
  }, [initialWarehouses])

  function openCreate() {
    setEditingWarehouse(null)
    setName('')
    setAddress('')
    setNotes('')
    setError('')
    setModalOpen(true)
  }

  function openEdit(w: Warehouse) {
    setEditingWarehouse(w)
    setName(w.name)
    setAddress(w.address || '')
    setNotes(w.notes || '')
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('O nome do armazém é obrigatório.')
      return
    }
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('name', name.trim())
    formData.append('address', address.trim())
    formData.append('notes', notes.trim())

    const res = editingWarehouse
      ? await updateWarehouseAction(editingWarehouse.id, formData)
      : await createWarehouseAction(formData)

    setLoading(false)
    if (res?.error) {
      setError(res.error)
    } else {
      if (editingWarehouse) {
        setWarehouses((prev) =>
          prev.map((w) =>
            w.id === editingWarehouse.id
              ? { ...w, name: name.trim(), address: address.trim() || null, notes: notes.trim() || null }
              : w
          ).sort((a, b) => a.name.localeCompare(b.name, 'pt'))
        )
      } else if (res.id) {
        setWarehouses((prev) =>
          [
            ...prev,
            {
              id: res.id!,
              companyId: '',
              name: name.trim(),
              address: address.trim() || null,
              notes: notes.trim() || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
        )
      }
      setModalOpen(false)
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem a certeza que deseja eliminar este armazém?')) return
    const res = await deleteWarehouseAction(id)
    if (res?.error) {
      alert(res.error)
      return
    }
    setWarehouses((prev) => prev.filter((w) => w.id !== id))
    router.refresh()
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <WarehouseIcon className="h-7 w-7 text-safety-orange" />
            <h1 className="text-2xl font-extrabold text-industrial-blue dark:text-slate-100">
              Armazéns
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestão dos armazéns de manutenção usados na Localização dos artigos de Inventário.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Novo Armazém</span>
        </button>
      </div>

      {warehouses.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-500 dark:text-slate-400">
          Ainda não existem armazéns criados. Clique em &quot;Novo Armazém&quot; para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map((w) => (
            <div
              key={w.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">{w.name}</h3>
                {w.address && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <MapPin size={12} /> {w.address}
                  </p>
                )}
                {w.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{w.notes}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => openEdit(w)}
                  className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Editar"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="p-1.5 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {editingWarehouse ? 'Editar Armazém' : 'Novo Armazém'}
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Armazém *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Armazém UR, Armazém Central..."
                  className="input text-xs w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Morada
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Morada ou localização física (opcional)"
                  className="input text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações adicionais (opcional)"
                  className="input text-xs w-full h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold text-white bg-safety-orange hover:bg-safety-orange/90 rounded-lg shadow-sm transition-all"
                >
                  {loading ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
