'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { FileText, ClipboardList, BookOpen, Plus, Trash2, Edit2, X, Paperclip, Download, Upload, Eye, RefreshCw } from 'lucide-react'
import type { DocumentoObrigatorio } from '@/types/models'
import { uploadFile } from '@/lib/upload'
import { readFrLayout } from '@/lib/fr-layout'
import FrDocumentPreview from '@/components/ui/FrDocumentPreview'
import { createDocumentAction, updateDocumentAction, deleteDocumentAction, parseDocumentFileAction } from './actions'

type DocTab = 'FR' | 'IT' | 'MANUAL'
type ParsedFile = Awaited<ReturnType<typeof parseDocumentFileAction>>

const IMPORT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,image/*'
const READABLE_FILE_RE = /\.(docx?|xls[xm]|pdf)$/i

/** "FR-MAN-18 CONTROLO UPS rev 02 01 2025.doc" → { code: 'FR-MAN-18', title: 'CONTROLO UPS' }. */
function docFromFileName(fileName: string): { code: string; title: string } {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+rev\b.*$/i, '').trim()
  const m = base.match(/^((?:FR|IT|MAN)(?:[\s.-]*[A-Z]{2,4})?[\s.-]*\d+[A-Za-z]?)\s*[-–:.]?\s*(.*)$/i)
  if (m) return { code: m[1].toUpperCase().replace(/\s+/g, '-'), title: m[2].trim() || base }
  return { code: '', title: base }
}

/** O que a importação preenche sozinha: código e título do conteúdo (Word/Excel) ou do nome do
 * ficheiro, campos da FR, texto da IT e a estrutura para a cópia fiel. */
function importedFields(parsed: ParsedFile, fileName: string) {
  const fromName = docFromFileName(fileName)
  const hasLayout = Boolean(parsed.layout)
  return {
    code: parsed.code || fromName.code,
    title: (hasLayout && parsed.title) || fromName.title,
    fieldLabels: parsed.fieldLabels || [],
    content: parsed.content || '',
    layoutJson: parsed.layout ? JSON.stringify(parsed.layout) : '',
  }
}
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
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [layoutJson, setLayoutJson] = useState('')
  const [readingFile, setReadingFile] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<DocumentoObrigatorio | null>(null)

  const shown = initialDocs.filter((d) => d.type === tab)
  // Importados antes da leitura automática: têm ficheiro legível mas nem estrutura nem campos/texto.
  const unread = shown.filter((d) =>
    d.type !== 'MANUAL' && d.fileUrl && READABLE_FILE_RE.test(d.fileName || d.fileUrl) &&
    !d.layoutJson && !(d.type === 'FR' ? d.fieldLabels?.length : d.content)
  )

  function appendImported(formData: FormData, fields: ReturnType<typeof importedFields>) {
    if (tab === 'FR') fields.fieldLabels.forEach((f) => formData.append('fieldLabels', f))
    formData.append('layoutJson', fields.layoutJson)
  }

  // Relê os ficheiros já importados e preenche o que falta (campos, texto, estrutura).
  async function handleReadExisting() {
    const failures: string[] = []
    let updated = 0
    for (const [i, d] of unread.entries()) {
      setImportStatus(`A ler ${i + 1} de ${unread.length}: ${d.fileName || d.title}`)
      const parsed = await parseDocumentFileAction(d.fileUrl!, d.fileName || d.fileUrl!)
      if (parsed.error) { failures.push(`${d.fileName || d.title}: ${parsed.error}`); continue }
      const fields = importedFields(parsed, d.fileName || '')
      const formData = new FormData()
      formData.append('type', d.type)
      formData.append('code', d.code)
      formData.append('title', d.title)
      formData.append('category', d.category || 'Geral')
      formData.append('content', d.type === 'IT' ? (d.content || fields.content) : (d.content || ''))
      formData.append('active', d.active !== false ? 'true' : 'false')
      appendImported(formData, fields)
      const res = await updateDocumentAction(d.id, formData)
      if (res?.error) failures.push(`${d.fileName || d.title}: ${res.error}`)
      else updated++
    }
    setImportStatus(updated > 0 ? `${updated} documento(s) atualizado(s) com o conteúdo do ficheiro.` : '')
    setImportErrors(failures)
    router.refresh()
  }

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
    setLayoutJson('')
    setError('')
    setModalOpen(true)
  }

  function openEdit(doc: DocumentoObrigatorio) {
    setLayoutJson(doc.layoutJson || '')
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
      const url = await uploadFile(file, tab === 'MANUAL' ? 'manuals' : 'documents')
      setFileUrl(url)
      setFileName(file.name)
      if (tab !== 'MANUAL') await readFileIntoForm(url, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar o ficheiro.')
    } finally {
      setUploadingFile(false)
    }
  }

  // Preenche o formulário com o conteúdo do ficheiro — só os campos ainda vazios, para não
  // apagar o que já foi escrito à mão; a estrutura (cópia fiel) é sempre a do ficheiro novo.
  async function readFileIntoForm(url: string, name: string) {
    setReadingFile(true)
    try {
      const parsed = await parseDocumentFileAction(url, name)
      if (parsed.error) { setError(parsed.error); return }
      const fields = importedFields(parsed, name)
      setLayoutJson(fields.layoutJson)
      if (!code.trim() && fields.code) setCode(fields.code)
      if (!title.trim() && fields.title) setTitle(fields.title)
      if (tab === 'FR' && fields.fieldLabels.length > 0 && !fieldLabels.some((f) => f.trim())) setFieldLabels(fields.fieldLabels)
      if (tab === 'IT' && fields.content && !content.trim()) setContent(fields.content)
    } finally {
      setReadingFile(false)
    }
  }

  // Importação em lote: um documento por ficheiro, do tipo do separador atual. Código e
  // título vêm do nome do ficheiro; os campos das FR definem-se depois em "Editar".
  async function handleImportFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return
    const failures: string[] = []
    let created = 0
    for (const [i, file] of files.entries()) {
      setImportStatus(`A importar ${i + 1} de ${files.length}: ${file.name}`)
      try {
        const url = await uploadFile(file, tab === 'MANUAL' ? 'manuals' : 'documents')
        const parsed: ParsedFile = tab === 'MANUAL' ? {} : await parseDocumentFileAction(url, file.name)
        if (parsed.error) failures.push(`${file.name}: ${parsed.error} (importado só com o ficheiro)`)
        const fields = importedFields(parsed.error ? {} : parsed, file.name)
        const formData = new FormData()
        formData.append('type', tab)
        formData.append('code', fields.code)
        formData.append('title', fields.title)
        formData.append('category', 'Geral')
        formData.append('content', tab === 'IT' ? fields.content : '')
        formData.append('active', 'true')
        formData.append('fileUrl', url)
        formData.append('fileName', file.name)
        if (tab !== 'MANUAL') appendImported(formData, fields)
        const res = await createDocumentAction(formData)
        if (res?.error) {
          failures.push(`${file.name}: ${res.error}`)
          if (res.error.includes('Limite')) break
        } else {
          created++
        }
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : 'falha no envio'}`)
      }
    }
    setImportStatus(created > 0 ? `${created} documento(s) importado(s).` : '')
    setImportErrors(failures)
    router.refresh()
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
    formData.append('fileUrl', fileUrl)
    formData.append('fileName', fileName)
    if (tab !== 'MANUAL') formData.append('layoutJson', fileUrl ? layoutJson : '')

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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            ref={importInputRef}
            type="file"
            multiple
            accept={IMPORT_ACCEPT}
            onChange={handleImportFiles}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={!!importStatus && importStatus.startsWith('A importar')}
            className="h-10 px-4 border border-industrial-blue text-industrial-blue dark:text-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-2"
            title="Escolher um ou vários ficheiros (PDF, Word, Excel, imagem) — cria um documento por ficheiro"
          >
            <Upload size={16} />
            <span>Importar ficheiros</span>
          </button>
          {unread.length > 0 && (
            <button
              type="button"
              onClick={handleReadExisting}
              disabled={!!importStatus && importStatus.startsWith('A ')}
              className="h-10 px-4 border border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-2"
              title="Ler os ficheiros já importados e preencher campos, texto e cópia fiel"
            >
              <RefreshCw size={16} />
              <span>Ler {unread.length} ficheiro(s) importado(s)</span>
            </button>
          )}
          <button
            onClick={openCreate}
            className="h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            <span>{tab === 'FR' ? 'Nova Folha de Registo' : tab === 'IT' ? 'Nova Instrução de Trabalho' : 'Novo Manual/Norma'}</span>
          </button>
        </div>
      </div>

      {(importStatus || importErrors.length > 0) && (
        <div className="mb-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
          {importStatus && <p className="font-semibold text-slate-700 dark:text-slate-200">{importStatus}</p>}
          {tab === 'FR' && importStatus && !importStatus.startsWith('A ') && (
            <p className="text-slate-500 dark:text-slate-400">
              Campos lidos automaticamente das tabelas (Word/Excel). Confirma em «Editar» se precisares de ajustar.
            </p>
          )}
          {importErrors.map((msg) => (
            <p key={msg} className="text-red-600 dark:text-red-400">{msg}</p>
          ))}
        </div>
      )}

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
                {d.type === 'FR' && (
                  d.fieldLabels && d.fieldLabels.length > 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{d.fieldLabels.length} campo(s) a preencher</p>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Sem campos definidos — o técnico preenche «Registo / Observações»</p>
                  )
                )}
                {d.type === 'IT' && d.content && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{d.content}</p>
                )}
                {d.fileUrl && (
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
                {(d.layoutJson || /\.pdf$|\.(png|jpe?g|webp|gif)$/i.test(d.fileName || d.fileUrl || '')) && (
                  <button onClick={() => setPreviewDoc(d)} className="mr-auto inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-industrial-blue dark:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Ver o documento como o original">
                    <Eye size={15} /> Ver documento
                  </button>
                )}
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
              ) : tab === 'MANUAL' ? null : (
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

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {tab === 'MANUAL' ? 'Ficheiro (PDF, imagem...) *' : 'Documento original (opcional — PDF, Word, Excel, imagem)'}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={IMPORT_ACCEPT}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-industrial-blue hover:text-industrial-blue transition-colors"
                  >
                    <Paperclip size={14} />
                    {uploadingFile ? 'A enviar...' : fileName ? `Trocar ficheiro (${fileName})` : 'Escolher ficheiro'}
                  </button>
                  {fileUrl && tab !== 'MANUAL' && !uploadingFile && (
                    <button
                      type="button"
                      onClick={() => { setFileUrl(''); setFileName('') }}
                      className="p-2 text-slate-400 hover:text-red-500"
                      title="Remover ficheiro"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {fileUrl && !uploadingFile && (
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs font-semibold">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ Ficheiro anexado{layoutJson ? ' · conteúdo lido' : ''}
                    </span>
                    {tab !== 'MANUAL' && READABLE_FILE_RE.test(fileName || fileUrl) && (
                      <button
                        type="button"
                        onClick={() => readFileIntoForm(fileUrl, fileName || fileUrl)}
                        disabled={readingFile}
                        className="text-industrial-blue dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <RefreshCw size={12} /> {readingFile ? 'A ler...' : 'Ler conteúdo do ficheiro'}
                      </button>
                    )}
                  </div>
                )}
              </div>

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

      {previewDoc && createPortal(
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />,
        document.body
      )}
    </div>
  )
}

function DocumentPreviewModal({ doc, onClose }: { doc: DocumentoObrigatorio; onClose: () => void }) {
  const layout = readFrLayout(doc.layoutJson)
  const name = doc.fileName || doc.fileUrl || ''
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex justify-center p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-4xl my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 mb-3 text-white">
          <h2 className="font-bold text-sm truncate">{doc.code} · {doc.title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {doc.fileUrl && (
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg">
                <Download size={14} /> Original
              </a>
            )}
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25" title="Fechar">
              <X size={16} />
            </button>
          </div>
        </div>
        {layout ? (
          <FrDocumentPreview layout={layout} fallbackCode={doc.code} />
        ) : /\.pdf$/i.test(name) ? (
          <iframe src={doc.fileUrl!} title={doc.title} className="w-full h-[85vh] bg-white rounded-lg" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.fileUrl!} alt={doc.title} className="w-full h-auto bg-white rounded-lg" />
        )}
      </div>
    </div>
  )
}
