'use client'

import { useState } from 'react'
import { FileText, UploadCloud, Trash2, CheckCircle2 } from 'lucide-react'

// Mock data representing the downloaded files in the artifact
const initialFiles = [
  { id: '1', name: 'NP_EN_13306_Terminologia.md', size: '2 KB', date: new Date().toLocaleDateString(), status: 'active' },
  { id: '2', name: 'ISO_9001_Maintenance.md', size: '3 KB', date: new Date().toLocaleDateString(), status: 'active' },
]

export default function KnowledgeClient({ isAdmin }: { isAdmin: boolean }) {
  const [files, setFiles] = useState(initialFiles)
  const [uploading, setUploading] = useState(false)

  function handleUploadSimulated() {
    if (!isAdmin) return alert('Apenas gestores podem fazer upload.')
    setUploading(true)
    setTimeout(() => {
      const newFile = {
        id: Math.random().toString(),
        name: `Manual_Seguranca_v${Math.floor(Math.random() * 10)}.pdf`,
        size: '1.2 MB',
        date: new Date().toLocaleDateString(),
        status: 'active',
      }
      setFiles([newFile, ...files])
      setUploading(false)
    }, 1500)
  }

  function handleDelete(id: string) {
    if (!isAdmin) return alert('Apenas gestores podem apagar documentos.')
    if (confirm('Tem a certeza que deseja remover este documento da memória da IA?')) {
      setFiles(files.filter(f => f.id !== id))
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Col: Upload Zone */}
        {isAdmin && (
          <div className="md:col-span-1">
            <div className="card p-6 flex flex-col items-center justify-center text-center border-dashed border-2 border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <UploadCloud className="h-6 w-6 text-[#2E86C1] dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1">Upload de Documento</h3>
              <p className="text-xs text-gray-500 mb-4 px-2">
                Suporta PDF, DOCX e MD. A IA passará a usar as regras deste ficheiro no Consultor.
              </p>
              <button 
                onClick={handleUploadSimulated} 
                disabled={uploading}
                className="btn-primary w-full"
              >
                {uploading ? 'A indexar...' : 'Selecionar Ficheiro'}
              </button>
            </div>
            
            <div className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30">
              <p className="text-xs text-green-800 dark:text-green-300 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>O RAG (Retrieval-Augmented Generation) está ativo. O Consultor IA aprende automaticamente com estes ficheiros.</span>
              </p>
            </div>
          </div>
        )}

        {/* Right Col: Document List */}
        <div className={`md:col-span-${isAdmin ? '2' : '3'}`}>
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-gray-800 dark:text-slate-200">Ficheiros Indexados ({files.length})</h3>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {files.length === 0 ? (
                <li className="p-8 text-center text-gray-500">Nenhum documento na Base de Conhecimento.</li>
              ) : (
                files.map(f => (
                  <li key={f.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 flex items-center justify-between group transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">{f.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{f.size}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          <span className="text-xs text-gray-500">{f.date}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          <span className="text-[10px] uppercase font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">Ativo</span>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(f.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Remover documento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
