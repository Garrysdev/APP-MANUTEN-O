'use client'

import { useState, useMemo } from 'react'
import {
  BookOpen, Search, Printer, ChevronRight, CheckCircle2,
  Wrench, Calendar, ClipboardList, Package, FolderKanban,
  Activity, ShieldCheck, Boxes, FileSpreadsheet, Download,
  HelpCircle, ExternalLink, PlayCircle, Sparkles, AlertTriangle, Lightbulb
} from 'lucide-react'

interface ManualSection {
  id: string
  title: string
  icon: any
  category: string
  badge: string
  summary: string
  steps: { title: string; desc: string; tip?: string }[]
  faqs?: { q: string; a: string }[]
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'introducao',
    title: '1. Introdução e Visão Geral',
    icon: BookOpen,
    category: 'Primeiros Passos',
    badge: 'Essencial',
    summary: 'O RG Maintenance OS é uma plataforma industrial desenvolvida para simplificar a gestão de equipamentos, planos de manutenção preventiva, ordens de trabalho e conformidade normativa.',
    steps: [
      {
        title: 'Perfis de Utilizador',
        desc: 'Existem 2 perfis: **Gestor de Manutenção** (acesso a todas as definições, encerramento de OTs, planos e relatórios) e **Técnico** (acesso focado nas OTs atribuídas e registo de intervenções).',
        tip: 'Apenas os Gestores têm permissão para encerrar OTs diretamente no calendário ou importar planos em Excel.'
      },
      {
        title: 'Navegação Principal',
        desc: 'Utilize a barra lateral esquerda para aceder rapidamente aos módulos de OTs, Calendário, Plano de Manutenção, Equipamentos, Gantt e Fiabilidade.'
      }
    ],
    faqs: [
      { q: 'Como alterar o meu idioma ou palavra-passe?', a: 'Aceda ao menu "O meu Perfil" no fundo da barra lateral para alterar dados pessoais, foto de perfil ou palavra-passe.' }
    ]
  },
  {
    id: 'equipamentos',
    title: '2. Gestão de Equipamentos e Ativos',
    icon: Package,
    category: 'Cadastros',
    badge: 'Estrutura',
    summary: 'A hierarquia de ativos organiza a fábrica em Áreas, TAGs e Sistemas para garantir uma identificação rápida e sem erros.',
    steps: [
      {
        title: 'Cadastrar um Novo Equipamento',
        desc: 'Vá a **Equipamentos** -> clique em **Novo Equipamento**. Preencha o Nome, Área (ex: 20), TAG (ex: 20 P1) e Sistema.',
        tip: 'A combinação de Área + TAG permite pesquisas instantâneas e filtragens em cascata na criação de OTs.'
      },
      {
        title: 'Histórico por Equipamento',
        desc: 'No cartão de cada equipamento, clique em "Ver OTs" para aceder ao histórico de manutenções preventivas e corretivas efetuadas nesse ativo.'
      }
    ],
    faqs: [
      { q: 'Por que motivo a pesquisa por TAG é tão rápida?', a: 'O sistema utiliza índices otimizados e suporte a pesquisa por prefixos locais para resposta imediata.' }
    ]
  },
  {
    id: 'ots',
    title: '3. Ordens de Trabalho (OTs)',
    icon: ClipboardList,
    category: 'Operações',
    badge: 'Diário',
    summary: 'Crie, atribua e gira Ordens de Trabalho preventivas e corretivas com formulários em cascata e associação de normas de segurança.',
    steps: [
      {
        title: 'Criar uma Nova OT',
        desc: 'Clique no botão **+ Nova Ordem** (ou no Calendário/Lista de OTs). Selecione primeiro a **Área**. Automaticamente, o campo **TAG** será filtrado apenas com as TAGs daquela Área. Ao escolher a TAG, o **Nome do Equipamento** é preenchido de forma automática.',
        tip: 'Pode incluir múltiplas Folhas de Registo Obrigatórias (FR) e Instruções de Trabalho (IT) assim como Regras de Segurança.'
      },
      {
        title: 'Atribuir Técnicos e Criticidade',
        desc: 'Defina o técnico responsável (ou empresa externa contratada), a data limite de execução (Prazo) e a Criticidade (Vermelho - Alta, Amarelo - Média, Verde - Baixa).'
      },
      {
        title: 'Encerrar OT no Calendário (Gestores)',
        desc: 'No Calendário, marque a caixa de seleção `[x]` diretamente na badge da OT agendada. A OT passará a estado "Concluída" instantaneamente.'
      }
    ],
    faqs: [
      { q: 'Um técnico pode encerrar OTs no calendário?', a: 'Não. Por razões de controlo de qualidade, a caixa de verificação direta no calendário fica ativa apenas para Gestores.' }
    ]
  },
  {
    id: 'plano-manutencao',
    title: '4. Plano de Manutenção Preventiva',
    icon: Wrench,
    category: 'Planeamento',
    badge: 'ISO 9001',
    summary: 'Estruture o seu plano anual preventivo, agende tarefas automaticamente e sincronize datas com o Calendário de fábrica.',
    steps: [
      {
        title: 'Importar Plano Excel (PL-MAN-01)',
        desc: 'Clique em **Plano Manutenção** -> **Importar**. Carregue o seu ficheiro Excel oficial. O sistema deteta automaticamente Áreas, TAGs, Ações e Periodicidades.',
        tip: 'O validador ignora linhas duplicadas e previne dados corrompidos.'
      },
      {
        title: 'Agendar para o Calendário',
        desc: 'Em cada plano, selecione a caixa `[x] Calendário`. É aberto o modal de agendamento automático onde pode escolher a Data de Início e ver todas as datas projetadas (Semanal, Mensal, Anual, etc.).'
      }
    ]
  },
  {
    id: 'calendario',
    title: '5. Calendário Interativo e Reagendamento por Arraste',
    icon: Calendar,
    category: 'Agendamento',
    badge: 'Novo',
    summary: 'Visualização completa da carga de trabalho em vista de Mês, Semana e Dia, com alteração de datas por Drag & Drop e impressão de relatórios.',
    steps: [
      {
        title: 'Alterar Datas por Arraste (Drag & Drop)',
        desc: 'Para mudar a data de uma OT ou Plano, clique e **arraste o cartão do evento** até ao dia pretendido no calendário. A célula de destino fica destacada em dourado.',
        tip: 'Estilo semelhante ao Google Calendar ou Outlook Web.'
      },
      {
        title: 'Imprimir Agendamentos da Semana ou Mês',
        desc: 'Clique no botão **🖨️ Imprimir Agendamentos** no topo do calendário para gerar um relatório formatado com resumo de tarefas pendentes, concluídas e lista detalhada para impressão ou PDF.'
      }
    ]
  },
  {
    id: 'gantt',
    title: '6. Gráficos Gantt de Projetos e Paragens',
    icon: FolderKanban,
    category: 'Projetos',
    badge: 'Projetos',
    summary: 'Controlo de paragens industriais (Agosto / Dezembro) com filtros dedicados por Área, TAG e ordenação de colunas.',
    steps: [
      {
        title: 'Alternar entre Paragens e Gantt Geral',
        desc: 'Utilize o seletor superior para alternar entre "Paragem" e "Projetos". Os totalizadores superiores atualizam-se dinamicamente.',
        tip: 'Pode filtrar os trabalhos por Área e TAG nos menus suspensos da barra de ferramentas.'
      }
    ]
  },
  {
    id: 'fiabilidade',
    title: '7. Indicadores de Fiabilidade (MTBF & MTTR)',
    icon: Activity,
    category: 'Engenharia',
    badge: 'Métricas',
    summary: 'Monitore o Tempo Médio Entre Falhas (MTBF), Tempo Médio de Reparação (MTTR) e a Disponibilidade Operacional da Fábrica.',
    steps: [
      {
        title: 'Análise de Disponibilidade',
        desc: 'Aceda ao menu **Fiabilidade** para visualizar os gráficos de uptime e downtime por equipamento e identificar os ativos mais críticos.'
      }
    ]
  },
  {
    id: 'backups',
    title: '8. Backups Automáticos e Ficheiros Excel',
    icon: FileSpreadsheet,
    category: 'Segurança',
    badge: 'Segurança',
    summary: 'Cópias de segurança diárias automáticas em Excel formatado na pasta `DOWNLOADS CHROME` e descarregamento manual em 1 clique.',
    steps: [
      {
        title: 'Exportar Backup em 1 Clique',
        desc: 'Nas páginas de **Plano de Manutenção** ou **Histórico**, clique no botão verde **📊 Backup Excel (Planos + OTs)** para descarregar imediatamente os ficheiros `PL-MAN-01` e `FR-MAN-09`.',
        tip: 'Os ficheiros são formatados segundo a norma industrial com cabeçalhos azuis e estados coloridos.'
      },
      {
        title: 'Backup Diário Automático no PC',
        desc: 'O script local `scripts/run-daily-backup.bat` executa diariamente no computador da fábrica e guarda os ficheiros atualizados na pasta de trabalho.'
      }
    ]
  }
]

export default function ManualClient() {
  const [selectedSectionId, setSelectedSectionId] = useState<string>('introducao')
  const [searchQuery, setSearchQuery] = useState('')
  const [openFaq, setOpenFaq] = useState<Record<string, boolean>>({})

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return MANUAL_SECTIONS
    const q = searchQuery.toLowerCase()
    return MANUAL_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.steps.some((st) => st.title.toLowerCase().includes(q) || st.desc.toLowerCase().includes(q))
    )
  }, [searchQuery])

  const activeSection = useMemo(() => {
    return MANUAL_SECTIONS.find((s) => s.id === selectedSectionId) || MANUAL_SECTIONS[0]
  }, [selectedSectionId])

  const toggleFaq = (key: string) => {
    setOpenFaq((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header com estilo industrial elegante */}
      <div className="bg-gradient-to-r from-industrial-blue via-industrial-blue-dark to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-10 -translate-y-10">
          <BookOpen size={320} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-safety-orange mb-3 border border-white/10">
              <Sparkles size={14} /> <span>Manual Interativo de Utilizador v2.5</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Guia de Utilização — RG Maintenance OS
            </h1>
            <p className="text-sm text-slate-300 font-medium max-w-2xl mt-1.5 leading-relaxed">
              Manual completo passo-a-passo para Gestores e Técnicos. Pesquise tópicos ou navegue pelos capítulos para aprender a gerir equipamentos, OTs, planos preventivos e backups.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 no-print">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Printer size={16} /> <span>Imprimir Manual</span>
            </button>
            <button
              onClick={() => {
                window.open('/api/backup/excel?type=plan', '_blank')
                setTimeout(() => window.open('/api/backup/excel?type=tasks', '_blank'), 500)
              }}
              className="px-4 py-2.5 bg-safety-orange hover:bg-safety-orange/90 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download size={16} /> <span>Descarregar Backups Excel</span>
            </button>
          </div>
        </div>

        {/* Barra de Pesquisa Interativa */}
        <div className="mt-6 relative z-10 no-print">
          <div className="relative max-w-xl">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar no manual (ex.: Criar OT, Drag & Drop, Excel, TAG, Gestor)..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-xs font-semibold text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-safety-orange focus:bg-white/20 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal (Navegação + Conteúdo do Capítulo) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna de Capítulos (Esquerda) */}
        <div className="lg:col-span-4 space-y-2 no-print">
          <h2 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest px-1 mb-2">
            Capítulos do Manual ({filteredSections.length})
          </h2>
          <div className="space-y-1.5">
            {filteredSections.map((sec) => {
              const Icon = sec.icon
              const isSelected = sec.id === selectedSectionId
              return (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 group cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-safety-orange shadow-md ring-1 ring-safety-orange/30'
                      : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-safety-orange text-white'
                        : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-slate-300 dark:group-hover:bg-slate-700'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-tight">
                        {sec.category}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {sec.badge}
                      </span>
                    </div>
                    <h3 className={`text-sm font-bold truncate mt-0.5 ${isSelected ? 'text-industrial-blue dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {sec.title}
                    </h3>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`self-center shrink-0 transition-transform ${
                      isSelected ? 'text-safety-orange translate-x-0.5' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>

        {/* Painel do Capítulo Selecionado (Direita) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          {activeSection && (
            <div>
              {/* Header do Capítulo */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 bg-industrial-blue/10 dark:bg-blue-900/30 text-industrial-blue dark:text-blue-400 font-extrabold text-xs rounded-lg uppercase tracking-wide">
                    {activeSection.category}
                  </span>
                  <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold text-xs rounded-lg">
                    {activeSection.badge}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {activeSection.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-2 leading-relaxed">
                  {activeSection.summary}
                </p>
              </div>

              {/* Passos do Guia */}
              <div className="mt-6 space-y-6">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Passo a Passo de Operação</span>
                </h3>

                <div className="space-y-4">
                  {activeSection.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 relative"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-industrial-blue text-white font-extrabold text-xs shrink-0 shadow">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {step.title}
                        </h4>
                      </div>
                      <p
                        className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed pl-10"
                        dangerouslySetInnerHTML={{
                          __html: step.desc.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        }}
                      />
                      {step.tip && (
                        <div className="ml-10 mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <span><strong>Dica Prática:</strong> {step.tip}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ e Resolução de Problemas */}
              {activeSection.faqs && activeSection.faqs.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-industrial-blue" />
                    <span>Perguntas Frequentes & Resolução</span>
                  </h3>

                  <div className="space-y-2">
                    {activeSection.faqs.map((faq, i) => {
                      const faqKey = `${activeSection.id}-${i}`
                      const isOpen = Boolean(openFaq[faqKey])
                      return (
                        <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleFaq(faqKey)}
                            className="w-full text-left p-3.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              ❓ {faq.q}
                            </span>
                            <ChevronRight
                              size={16}
                              className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                            />
                          </button>
                          {isOpen && (
                            <div className="p-3.5 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 font-medium border-t border-slate-200 dark:border-slate-800 leading-relaxed">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Botão de simulação/atalho para a página real */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between no-print">
                <span className="text-xs text-slate-400 font-medium">Precisa de ir diretamente para este módulo?</span>
                <a
                  href={
                    activeSection.id === 'equipamentos' ? '/dashboard/assets' :
                    activeSection.id === 'ots' ? '/dashboard/tasks' :
                    activeSection.id === 'plano-manutencao' ? '/dashboard/maintenance-plan' :
                    activeSection.id === 'calendario' ? '/dashboard/calendar' :
                    activeSection.id === 'gantt' ? '/dashboard/projects' :
                    activeSection.id === 'fiabilidade' ? '/dashboard/reliability' :
                    activeSection.id === 'backups' ? '/dashboard/history' : '/dashboard'
                  }
                  className="px-4 py-2 bg-industrial-blue hover:bg-industrial-blue/90 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
                >
                  <span>Abrir Módulo na App</span> <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
