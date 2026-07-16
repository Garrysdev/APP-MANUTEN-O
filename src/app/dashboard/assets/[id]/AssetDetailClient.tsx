'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Activity, Thermometer, Clock, Package, 
  Settings, PenTool, Edit2, Save, X, Camera, ImageOff
} from 'lucide-react'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import { updateAssetAction } from '../actions'
import { 
  LineChart, Line, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'
import type { Asset, Task, User } from '@/types/models'
import { STATUS_LABELS, TIPO_LABELS } from '@/types/models'

// Mock Data Generators for KPIs
const mockVibrationData = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i}:00`,
  mm_s: (Math.random() * 2 + 1.5).toFixed(2)
}))

const mockTempData = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i}:00`,
  celsius: (Math.random() * 15 + 40).toFixed(1)
}))

export default function AssetDetailClient({
  asset,
  tasks,
  users
}: {
  asset: Asset
  tasks: Task[]
  users: User[]
}) {
  const router = useRouter()

  const [isEditing, setIsEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(asset.photoUrl ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (!original) return
    const file = await compressImage(original)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSaveSpecs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      if (photoFile) {
        try {
          const url = await uploadImage(photoFile, 'assets')
          formData.set('photoUrl', url)
        } catch {
          if (asset.photoUrl) formData.set('photoUrl', asset.photoUrl)
        }
      } else if (photoPreview === null) {
        formData.set('photoUrl', '')
      } else if (asset.photoUrl) {
        formData.set('photoUrl', asset.photoUrl)
      }

      const result = await updateAssetAction({}, formData)
      
      if (result.error) {
        setError(result.error)
      } else {
        setIsEditing(false)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar.')
    } finally {
      setBusy(false)
    }
  }

  const uptime = 98.4

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/assets')} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-slate-300">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-3">
            {asset.name}
            <span className={asset.active ? 'badge-done text-sm' : 'badge-cancelled text-sm'}>
              {asset.active ? 'Ativo' : 'Inativo'}
            </span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {asset.tag ? `TAG: ${asset.tag}` : 'Sem TAG'} • {asset.area ? `Área: ${asset.area}` : 'Sem Área'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Asset Info & Specs */}
        <div className="space-y-6">
          <form onSubmit={handleSaveSpecs} className="card p-6 border border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
            <input type="hidden" name="id" value={asset.id} />
            <input type="hidden" name="name" value={asset.name} />
            <input type="hidden" name="tag" value={asset.tag ?? ''} />
            <input type="hidden" name="area" value={asset.area ?? ''} />
            <input type="hidden" name="location" value={asset.location ?? ''} />
            <input type="hidden" name="tags" value={asset.tags?.join(',') ?? ''} />
            <input type="hidden" name="notes" value={asset.notes ?? ''} />
            <input type="hidden" name="active" value={asset.active ? 'true' : 'false'} />
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#2E86C1]" /> Ficha Técnica
              </h3>
              {!isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)} className="p-1.5 text-gray-400 hover:text-[#2E86C1] hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition-colors" title="Editar Ficha Técnica">
                  <Edit2 className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setIsEditing(false); setPhotoPreview(asset.photoUrl ?? null); setError('') }} disabled={busy} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                  <button type="submit" disabled={busy} className="p-1.5 text-white bg-[#2E86C1] hover:bg-[#21618C] rounded transition-colors disabled:opacity-50">
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className={`aspect-video relative rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 mb-6 border border-gray-200 dark:border-slate-700 ${isEditing ? 'ring-2 ring-[#2E86C1] ring-offset-2 dark:ring-offset-slate-900' : ''}`}>
              {photoPreview ? (
                <Image src={photoPreview} alt={asset.name} fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="h-12 w-12 text-gray-300 dark:text-slate-600" />
                </div>
              )}
              
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-primary text-xs flex items-center gap-2 py-1.5 px-3">
                    <Camera className="h-4 w-4" /> Alterar Foto
                  </button>
                  {photoPreview && (
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} className="btn-secondary text-xs text-red-500 flex items-center gap-2 py-1.5 px-3">
                      <ImageOff className="h-4 w-4" /> Remover
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                <span className="text-gray-500 dark:text-slate-400">Fabricante</span>
                {isEditing ? (
                  <input name="manufacturer" defaultValue={asset.manufacturer ?? ''} className="input py-0.5 px-2 text-xs w-1/2 text-right" />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-slate-200">{asset.manufacturer || '—'}</span>
                )}
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                <span className="text-gray-500 dark:text-slate-400">Nº de Série</span>
                {isEditing ? (
                  <input name="serialNumber" defaultValue={asset.serialNumber ?? ''} className="input py-0.5 px-2 text-xs w-1/2 text-right" />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-slate-200">{asset.serialNumber || '—'}</span>
                )}
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                <span className="text-gray-500 dark:text-slate-400">Tipo</span>
                {isEditing ? (
                  <input name="type" defaultValue={asset.type ?? ''} className="input py-0.5 px-2 text-xs w-1/2 text-right" />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-slate-200">{asset.type || '—'}</span>
                )}
              </div>
              <div className="flex flex-col pb-2">
                <span className="text-gray-500 dark:text-slate-400 mb-1">Características</span>
                {isEditing ? (
                  <textarea name="characteristics" defaultValue={asset.characteristics ?? ''} className="input py-1.5 px-2 text-xs w-full min-h-[60px]" />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-slate-200">{asset.characteristics || '—'}</span>
                )}
              </div>
            </div>
            
            {isEditing && (
              <p className="mt-4 text-[10px] text-gray-400 dark:text-slate-500 text-center uppercase tracking-widest font-semibold">
                Funcionalidade sujeita a validação de plano
              </p>
            )}
          </form>
        </div>

        {/* MIDDLE & RIGHT: KPIs and History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* KPI ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 border border-[#2E86C1]/20 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/80">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#2E86C1]/10 rounded-lg text-[#2E86C1]">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-300">Vibrações (RMS)</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 mb-4">2.4 <span className="text-sm font-normal text-gray-500">mm/s</span></p>
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockVibrationData}>
                    <Line type="monotone" dataKey="mm_s" stroke="#2E86C1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5 border border-amber-500/20 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/80">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                  <Thermometer className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-300">Temperatura</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 mb-4">48.2 <span className="text-sm font-normal text-gray-500">°C</span></p>
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockTempData}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="celsius" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5 border border-emerald-500/20 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/80">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-300">Disponibilidade</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 mb-4">{uptime} <span className="text-sm font-normal text-gray-500">%</span></p>
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 mt-8">
                <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${uptime}%` }}></div>
              </div>
            </div>
          </div>

          {/* HISTORY TABLE */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <PenTool className="h-4 w-4 text-[#2E86C1]" /> Histórico de Intervenções
              </h3>
            </div>
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                Nenhum registo de manutenção encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Ordem de Trabalho (OT)</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => (
                      <tr key={t.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString('pt-PT')}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">
                          <Link href={`/dashboard/tasks?id=${t.id}`} className="hover:text-[#2E86C1] transition-colors">
                            {t.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                          {TIPO_LABELS[t.tipo]}
                        </td>
                        <td className="px-4 py-3">
                          <span className={
                            t.status === 'done' ? 'badge-done' : 
                            t.status === 'in_progress' ? 'badge-pending' : 
                            t.status === 'cancelled' ? 'badge-cancelled' : 'badge-neutral'
                          }>
                            {STATUS_LABELS[t.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
