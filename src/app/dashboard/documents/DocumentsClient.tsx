'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { FileText, ClipboardList, BookOpen, Plus, Trash2, Edit2, X, Paperclip, Download } from 'lucide-react'
import type { DocumentoObrigatorio } from '@/types/models'
import { uploadFile } from '@/lib/upload'
import { createDocumentAction, updateDocumentAction, deleteDocumentAction } from './actions'

type DocTab = 'FR' | 'IT' | 'MANUAL'

/**
 * Gestão Documental — Folhas de Registo (FR), Instruções de Trabalho (IT) e, desde
 * Out/2026, Manuais/Normas (type 'MANUAL', upload de PDF via Cloudinary) reais por
 * empresa, mesmo padrão de página/CRUD de Regras de Segurança
 * (safety-rules/SafetyRulesClient.tsx). Substitui os 3 FR + 3 IT antes fixos no código
 * (ver TaskDocRequirements.tsx), que passam a ler daqui via listDocuments().
 */
export default function DocumentsClient({ initialDocs }: { initialDocs: DocumentoObrigatorio[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<DocTab>('FR')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentoObrigatorio | null>(null)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Geral')
  const [content, setContent] = useState('')
  const [fieldLabels, setFieldLabels] = useState<string[]>([''])
  const [active, setActive] = useState(true)
  const [fileUrl, setFileUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const shown = initialDocs.filter((d) => d.type === tab)

  function openCreate() {
    setEditingDoc(null)
    setCode('')
    setTitle('')
    setCategory('Geral')
    setContent('')
    setFieldLabels([''])
    setActive(true)
    setFileUrl('')
    setFileName('')
    setError('')
    setModalOpen(true)
  }

  function openEdit(doc: DocumentoObrigatorio) {
    setEditingDoc(doc)
    setCode(doc.code)
    setTitle(doc.title)
    setCategory(doc.category || 'Geral')
    setContent(doc.content || '')
    setFieldLabels(doc.fieldLabels && doc.fieldLabels.length > 0 ? doc.fieldLabels : [''])
    setActive(doc.active !== false)
    setFileUrl(doc.fileUrl || '')
    setFileName(doc.fileName || '')
    setError('')
    setModalOpen(true)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    setError('')
    try {
      const url = await uploadFile(file, 'manuals')
      setFileUrl(url)
      setFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar o ficheiro.')
    } finally {
      setUploadingFile(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('O título é obrigatório.')
      return
    }
    if (tab === 'MANUAL' && !fileUrl) {
      setError('Anexa um ficheiro antes de guardar.')
      return
    }
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('type', tab)
    formData.append('code', code)
    formData.append('title', title)
    formData.append('category', category)
    formData.append('content', content)
    formData.append('active', active ? 'true' : 'false')
    fieldLabels.filter((f) => f.trim()).forEach((f) => formData.append('fieldLabels', f.trim()))
    if (tab === 'MANUAL') {
      formData.append('fileUrl', fileUrl)
      formData.append('fileName', fileName)
    }

    const res = editingDoc
      ? await updateDocumentAction(editingDoc.id, formData)
      : await createDocumentAction(formData)

    setLoading(false)
    if (res?.error) {
      setError(res.error)
    } else {
      setModalOpen(false)
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem a certeza que deseja eliminar este documento?')) return
    await deleteDocumentAction(id)
    router.refresh()
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-7 w-7 text-safety-orange" />
            <h1 className="text-2xl font-extrabold text-industrial-blue dark:text-slate-100">
              Gestão Documental
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Folhas de Registo (FR), Instruções de Trabalho (IT) e Base de Conhecimento (manuais/normas) da empresa.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          <span>{tab === 'FR' ? 'Nova Folha de Registo' : tab === 'IT' ? 'Nova Instrução de Trabalho' : 'Novo Manual/Norma'}</span>
        </button>
      </div>

      <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 mb-5">
        <button
          type="button"
          onClick={() => setTab('FR')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === 'FR' ? 'bg-industrial-blue text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" /> Folhas de Registo (FR)
        </button>
        <button
          type="button"
          onClick={() => setTab('IT')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === 'IT' ? 'bg-industrial-blue text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <FileText className="h-3.5 w-3.5" /> Instruções de Trabalho (IT)
        </button>
        <button
          type="button"
          onClick={() => setTab('MANUAL')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === 'MANUAL' ? 'bg-industrial-blue text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" /> Manuais & Normas
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {tab === 'FR' ? 'Nenhuma Folha de Registo criada ainda.' : tab === 'IT' ? 'Nenhuma Instrução de Trabalho criada ainda.' : 'Nenhum Manual/Norma carregado ainda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((d) => (
            <div
              key={d.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-mono">
                    {d.code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${d.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                    {d.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">{d.title}</h3>
                {d.type === 'FR' && d.fieldLabels && d.fieldLabels.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{d.fieldLabels.length} campo(s) a preencher</p>
                )}
                {d.type === 'IT' && d.content && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{d.content}</p>
                )}
                {d.type === 'MANUAL' && d.fileUrl && (
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-industrial-blue dark:text-blue-400 hover:underline font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" /> {d.fileName || 'Descarregar ficheiro'}
                  </a>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => openEdit(d)} className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Editar">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => handleDelete(d.id)} className="p-1.5 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Eliminar">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl my-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {editingDoc ? 'Editar' : 'Novo'} {tab === 'FR' ? 'Folha de Registo' : tab === 'IT' ? 'Instrução de Trabalho' : 'Manual/Norma'}
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-semibold">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Código</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={tab === 'FR' ? 'FR-04' : tab === 'IT' ? 'IT-04' : 'MAN-01'}
                    className="input text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Geral, Elétrico, Mecânico..."
                    className="input text-xs w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Título *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tab === 'FR' ? 'Registo de Leituras Diárias' : tab === 'IT' ? 'Consignação LOTO & Segurança Elétrica' : 'Manual do Fabricante — Compressor XYZ'}
                  className="input text-xs w-full"
                  required
                />
              </div>

              {tab === 'IT' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Procedimento
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Texto do procedimento que o técnico tem de ler e confirmar..."
                    className="input text-xs w-full h-28 resize-none"
                  />
                </div>
              ) : tab === 'MANUAL' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ficheiro (PDF, imagem...)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-industrial-blue hover:text-industrial-blue transition-colors"
                  >
                    <Paperclip size={14} />
                    {uploadingFile ? 'A enviar...' : fileName ? `Trocar ficheiro (${fileName})` : 'Escolher ficheiro'}
                  </button>
                  {fileUrl && !uploadingFile && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-semibold">✓ Ficheiro anexado</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Campos a preencher pelo técnico
                  </label>
                  <div className="space-y-1.5">
                    {fieldLabels.map((label, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={label}
                          onChange={(e) => setFieldLabels((prev) => prev.map((f, i) => (i === idx ? e.target.value : f)))}
                          placeholder={`Ex: Pressão (bar), Temperatura (ºC)...`}
                          className="input text-xs w-full"
                        />
                        <button
                          type="button"
                          onClick={() => setFieldLabels((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                          title="Remover campo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFieldLabels((prev) => [...prev, ''])}
                    className="mt-1.5 text-xs font-bold text-industrial-blue dark:text-blue-400 hover:underline"
                  >
                    + Adicionar campo
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="docActive"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <label htmlFor="docActive" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {tab === 'MANUAL' ? 'Ativo (visível na lista)' : 'Ativo (disponível na seleção de OTs)'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-xs font-bold text-white bg-safety-orange hover:bg-safety-orange/90 rounded-lg shadow-sm transition-all">
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
