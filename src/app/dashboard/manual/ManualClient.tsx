'use client'

import { useState, useMemo } from 'react'
import {
  BookOpen, Search, Printer, ChevronRight, CheckCircle2,
  Wrench, Calendar, ClipboardList, Package, FolderKanban,
  Activity, ShieldCheck, Boxes, FileSpreadsheet, Download,
  HelpCircle, ExternalLink, PlayCircle, Sparkles, AlertTriangle, Lightbulb,
  Smartphone, Bell, MessageSquare
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
    title: '1. Introdução e Perfis de Utilizador',
    icon: BookOpen,
    category: 'Primeiros Passos',
    badge: 'Essencial',
    summary: 'O RG Maintenance OS é uma plataforma industrial para gestão ágil de equipamentos, planos preventivos, ordens de trabalho e comunicação em chão de fábrica.',
    steps: [
      {
        title: 'Perfil Gestor de Manutenção',
        desc: 'Acesso integral ao sistema: Gestão de Equipamentos, Planos de Manutenção Preventiva, Calendário Geral, Gráficos Gantt, Indicadores de Fiabilidade (MTBF/MTTR), Encerramento e Validação de OTs e atribuição de equipas.',
        tip: 'Os Gestores têm permissão para importar planos em Excel e gerir o cadastro de todos os ativos fabris.'
      },
      {
        title: 'Perfil Técnico de Manutenção',
        desc: 'Interface limpa e focada no telemóvel e tablet: O menu lateral apresenta exclusivamente **Ordens de Trabalho**, **Mensagens Internas**, **Manual do Utilizador** e **O meu Perfil**.',
        tip: 'Cada técnico visualiza apenas as OTs que lhe foram diretamente atribuídas, eliminando distrações e confusões entre equipas.'
      }
    ],
    faqs: [
      { q: 'Como alterar palavra-passe ou foto de perfil?', a: 'Aceda ao menu "O meu Perfil" na barra lateral ou no menu de topo para gerir a sua conta e preferências.' }
    ]
  },
  {
    id: 'ots',
    title: '2. Ordens de Trabalho (OTs) & Filtragem do Técnico',
    icon: ClipboardList,
    category: 'Operações',
    badge: 'Diário',
    summary: 'Criação, gestão e execução de Ordens de Trabalho com isolamento estrito por técnico e abertura rápida de fichas de equipamentos.',
    steps: [
      {
        title: 'Isolamento Rigoroso de OTs por Técnico',
        desc: 'Quando um técnico inicia sessão, o sistema filtra e apresenta exclusivamente as ordens de trabalho atribuídas à sua sigla/nome (ex.: RG, LM, MS, CB). Todas as categorias de estado são mantidas acessíveis: **Pendentes**, **Em curso**, **Concluídas** e **Canceladas**.',
        tip: 'Um técnico nunca visualiza OTs atribuídas exclusivamente a outros colegas, garantindo total privacidade e foco.'
      },
      {
        title: 'Edição e Consulta Rápida',
        desc: 'Basta **clicar em qualquer linha da tabela de OTs** para abrir instantaneamente o modal de detalhes e edição da ordem de trabalho correspondente.'
      },
      {
        title: 'Link Direto para Ficha do Equipamento',
        desc: 'Na tabela de OTs e OTs de PM, o nome e TAG do equipamento funcionam como links diretos: ao clicar, abre-se a página com a ficha técnica e histórico desse ativo.'
      },
      {
        title: 'Criar uma Nova Ordem (Gestores / Técnicos)',
        desc: 'Clique em **+ Nova Ordem**. Selecione primeiro a **Área** para que o campo **TAG** filtre apenas os equipamentos dessa área fabril. O nome do ativo preenche-se automaticamente.'
      }
    ],
    faqs: [
      { q: 'Porque não vejo OTs de outros técnicos no meu perfil?', a: 'Por regra de segurança e organização de fábrica, a vista do técnico é restrita às tarefas da sua responsabilidade.' }
    ]
  },
  {
    id: 'notificacoes-mobile',
    title: '3. Notificações no Telemóvel & Mensagens Internas',
    icon: Smartphone,
    category: 'Comunicação',
    badge: 'Mobile & Estados',
    summary: 'Receba alertas instantâneos no telemóvel para novas OTs e comunique com a equipa através de mensagens com múltiplos estados e pedidos de resposta.',
    steps: [
      {
        title: 'Notificações Web Push em Tempo Real',
        desc: 'Sempre que o Gestor atribuir uma nova OT ou um colega enviar uma mensagem no chat interno, o técnico recebe uma notificação sonoro-visual no telemóvel ou tablet (mesmo com o browser em segundo plano).',
        tip: 'Certifique-se de aceitar as permissões de notificação do browser quando solicitado.'
      },
      {
        title: 'Estados das Mensagens (Aguarda Resposta, Respondida, Informativa, Fechada)',
        desc: 'Cada mensagem interna suporta 4 estados: **⏳ Aguarda Resposta** (alerta destacado para resposta obrigatória), **💬 Respondida** (atualizado automaticamente após o destinatário responder), **ℹ️ Informativa** (comunicação sem necessidade de retorno) e **✅ Fechada** (concluída/arquivada).',
        tip: 'Pode alterar o estado diretamente no seletor rápido do cartão da mensagem ou no modal de detalhe.'
      },
      {
        title: 'Responder no Mesmo Menu de Nova Mensagem',
        desc: 'Ao clicar em **"Responder"** num cartão ou no detalhe da mensagem, é aberto o mesmo menu de composição, com o destinatário, assunto (`Re: ...`), OT associada e trecho da mensagem original preenchidos de forma automática.',
        tip: 'Ao enviar a resposta, a mensagem original passa automaticamente ao estado "Respondida".'
      },
      {
        title: 'Ativação e Sincronização Automática no Telemóvel',
        desc: 'Ao iniciar sessão no telemóvel, o sistema sincroniza a subscrição de notificações de forma transparente. Pode também clicar no **Sino de Notificações** no topo e premir "Ativar Notificações no Telemóvel".'
      }
    ],
    faqs: [
      { q: 'Não estou a receber notificações no meu smartphone Android / iPhone. O que fazer?', a: '1) Clique no ícone do sino e selecione "Ativar Notificações"; 2) Verifique nas definições do telemóvel se o browser (Chrome / Safari) tem permissão para emitir notificações.' },
      { q: 'Como saber se uma mensagem aguarda a minha resposta?', a: 'Mensagens que aguardam resposta surgem destacadas a cor âmbar com o badge "⏳ Aguarda Resposta" e botão direto "Responder".' }
    ]
  },
  {
    id: 'calendario',
    title: '4. Calendário, Vista de Dia e Conclusão Rápida',
    icon: Calendar,
    category: 'Agendamento',
    badge: 'Interativo',
    summary: 'Visualização de tarefas ativas com reagendamento por arraste (Drag & Drop), vista detalhada do dia e botão direto para Concluir.',
    steps: [
      {
        title: 'Foco em Tarefas Não Concluídas',
        desc: 'Para manter o calendário limpo e operacional, apenas as OTs e manutenções preventivas pendentes/em curso são visíveis nos blocos diários.',
        tip: 'As tarefas já concluídas ficam arquivadas no Histórico e na Lista de OTs.'
      },
      {
        title: 'Vista Diária ao Clicar no Cabeçalho do Dia',
        desc: 'Ao clicar no **número do dia (topo da célula)** no calendário de Mês ou Semana, abre-se a **Vista Diária** com todas as intervenções agendadas para essa data específica.'
      },
      {
        title: 'Ação Rápida de Conclusão de Tarefas',
        desc: 'Na Vista Diária, cada linha de intervenção dispõe de um botão **Concluir Tarefa** para registar a conclusão imediata sem necessidade de passos adicionais.'
      },
      {
        title: 'Abrir OT ao Clicar em Qualquer Evento',
        desc: 'Ao clicar diretamente no cartão de uma OT ou OT de PM no calendário, abre-se a janela de edição e registo de horas.'
      },
      {
        title: 'Reagendar por Arraste (Drag & Drop)',
        desc: 'Arraste qualquer cartão de intervenção para outro dia para atualizar automaticamente a data de execução planeada.'
      }
    ]
  },
  {
    id: 'gantt',
    title: '5. Gráficos Gantt de Projetos e Paragens',
    icon: FolderKanban,
    category: 'Projetos',
    badge: 'Projetos',
    summary: 'Controlo cronológico de paragens industriais (Agosto / Dezembro) com abertura direta de OTs nas linhas e barras.',
    steps: [
      {
        title: 'Abertura de OTs por Clique no Gantt',
        desc: 'Ao clicar em qualquer linha ou barra cronológica do gráfico Gantt, a respetiva Ordem de Trabalho abre-se de imediato para consulta e edição de progresso.',
        tip: 'Facilita a atualização de percentagens de avanço durante as reuniões diárias de paragem.'
      },
      {
        title: 'Filtros Dinâmicos por Área e TAG',
        desc: 'Utilize os filtros superiores para isolar intervenções de áreas críticas da fábrica ou selecionar apenas projetos de paragem específicos.'
      }
    ]
  },
  {
    id: 'equipamentos',
    title: '6. Gestão de Equipamentos e Ativos (Gestores)',
    icon: Package,
    category: 'Cadastros',
    badge: 'Estrutura',
    summary: 'Organização estruturada da fábrica por Áreas, TAGs e Sistemas para parametrização dos planos e histórico de manutenção.',
    steps: [
      {
        title: 'Acesso Reservado a Gestores',
        desc: 'O módulo de Equipamentos fica disponível para Gestores de Manutenção para cadastrar, editar fichas técnicas e gerir dados de placas de características.',
        tip: 'Os técnicos acedem aos dados do equipamento diretamente através das suas OTs atribuídas.'
      },
      {
        title: 'Histórico Completo por Ativo',
        desc: 'No cartão do equipamento, aceda a "Ver OTs" para consultar o histórico integral de intervenções preventivas e corretivas.'
      }
    ]
  },
  {
    id: 'plano-manutencao',
    title: '7. Plano de Manutenção Preventiva (PL-MAN-01)',
    icon: Wrench,
    category: 'Planeamento',
    badge: 'ISO 9001',
    summary: 'Estruture o plano anual preventivo, gere agendamentos automáticos e acompanhe o rácio de cumprimento.',
    steps: [
      {
        title: 'Importar Plano Excel Oficial',
        desc: 'Em **Plano Manutenção** -> **Importar**, carregue o ficheiro Excel. O validador deteta automaticamente periodicidades (S, M, T, S, A) e converte em agendamentos de fábrica.'
      },
      {
        title: 'Acompanhamento do Rácio de Cumprimento',
        desc: 'O dashboard apresenta a taxa de execução real calculando a proporção de OTs de PM concluídas face ao total de intervenções planeadas para o ano em curso.'
      }
    ]
  },
  {
    id: 'fiabilidade',
    title: '8. Indicadores de Fiabilidade (MTBF & MTTR)',
    icon: Activity,
    category: 'Engenharia',
    badge: 'Métricas',
    summary: 'Monitorização em tempo real do Tempo Médio Entre Falhas (MTBF), Tempo Médio de Reparação (MTTR) e Taxa de Disponibilidade.',
    steps: [
      {
        title: 'Análise de Indicadores',
        desc: 'Aceda ao menu **Fiabilidade** para identificar os equipamentos que geram maior tempo de indisponibilidade e orientar melhorias contínuas.'
      }
    ]
  },
  {
    id: 'backups',
    title: '9. Backups Automáticos e Ficheiros Excel',
    icon: FileSpreadsheet,
    category: 'Segurança',
    badge: 'Segurança',
    summary: 'Cópias de segurança diárias automáticas em Excel formatado e descarregamento instantâneo em 1 clique.',
    steps: [
      {
        title: 'Descarregar Backups em 1 Clique',
        desc: 'Prima o botão **Descarregar Backups Excel** no topo do manual para obter imediatamente os ficheiros `PL-MAN-01` e `FR-MAN-09` atualizados.'
      },
      {
        title: 'Backup Diário Automático no Computador Local',
        desc: 'O script local `scripts/run-daily-backup.bat` corre em segundo plano diariamente e guarda as cópias de segurança na pasta local do computador da fábrica.'
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
