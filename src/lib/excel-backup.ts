import ExcelJS from 'exceljs'
import type { MaintenancePlan, Task, Asset, User } from '@/types/models'
import { compareDates } from '@/lib/utils'

const CRITICIDADE_LABELS: Record<string, string> = {
  vermelho: 'Vermelho (Alta)',
  amarelo: 'Amarelo (Média)',
  verde: 'Verde (Baixa)',
  alta: 'Vermelho (Alta)',
  media: 'Amarelo (Média)',
  baixa: 'Verde (Baixa)'
}

const TIPO_LABELS: Record<string, string> = {
  preventiva: 'Preventiva',
  curativa: 'Curativa',
  inspecao: 'Inspeção',
  melhoria: 'Melhoria',
  lubrificacao: 'Lubrificação',
  plano: 'Plano Preventivo'
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em Progresso',
  done: 'Concluída',
  completed: 'Concluída',
  cancelled: 'Cancelada'
}

/**
 * Gerar Ficheiro Excel: PL-MAN-01 PLANO MANUTENÇÃO_2026.xlsx
 */
export async function generateMaintenancePlanExcel(
  plans: MaintenancePlan[],
  assets: Asset[],
  users: User[]
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RG Maintenance OS'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Plano de Manutenção', {
    views: [{ showGridLines: true }]
  })

  const assetMap = new Map<string, Asset>()
  assets.forEach(a => assetMap.set(a.id, a))

  const userMap = new Map<string, string>()
  users.forEach(u => userMap.set(u.id, u.name))

  // Cabeçalho de Título do Documento
  sheet.mergeCells('A1:M1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'PL-MAN-01 PLANO DE MANUTENÇÃO PREVENTIVA'
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 35

  // Subtítulo de Informação
  sheet.mergeCells('A2:M2')
  const subCell = sheet.getCell('A2')
  subCell.value = `RG MAINTENANCE OS — BACKUP AUTOMÁTICO REALIZADO EM: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT')} | TOTAL DE PLANOS: ${plans.length}`
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF333333' } }
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } }
  subCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 20

  sheet.addRow([]) // Linha em branco

  // Definição das Colunas
  const headerRowNumber = 4
  const headers = [
    'ÁREA',
    'TAG',
    'SISTEMA',
    'EQUIPAMENTO',
    'AÇÃO / TAREFA',
    'PERIODICIDADE',
    'CRITICIDADE',
    'EXECUTOR',
    'OBRIGATÓRIA (LEGAL)',
    'REGRAS DE SEGURANÇA',
    'TÉCNICO ATRIBUÍDO',
    'AGENDADO NO CALENDÁRIO',
    'ESTADO'
  ]

  const headerRow = sheet.getRow(headerRowNumber)
  headerRow.values = headers
  headerRow.height = 28

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1B4F72' } },
      left: { style: 'thin', color: { argb: 'FF1B4F72' } },
      bottom: { style: 'medium', color: { argb: 'FF1B4F72' } },
      right: { style: 'thin', color: { argb: 'FF1B4F72' } }
    }
  })

  // Adicionar Dados dos Planos (Ordenados por DATA)
  const sortedPlans = [...plans].sort((a, b) =>
    compareDates(a.nextDueDate || a.calendarStartDate || a.createdAt, b.nextDueDate || b.calendarStartDate || b.createdAt)
  )

  sortedPlans.forEach((plan, idx) => {
    const asset = plan.assetId ? assetMap.get(plan.assetId) : null
    const area = plan.area || asset?.area || '—'
    const tag = plan.tag || asset?.tag || '—'
    const system = plan.system || asset?.system || '—'
    const equipName = asset?.name || 'Vários / Geral'
    const safetyText = plan.safetyRules ? plan.safetyRules.join('; ') : '—'
    const technician = plan.assignedTo ? (userMap.get(plan.assignedTo) || plan.assignedTo) : 'Não Atribuído'
    const activeText = plan.active !== false ? 'ATIVO' : 'INATIVO'
    const isCalScheduled = plan.showInCalendar ? 'SIM' : 'NÃO'

    const row = sheet.addRow([
      area,
      tag,
      system,
      equipName,
      plan.title || plan.description || '—',
      plan.periodicidadeLabel || plan.periodicidade || '—',
      CRITICIDADE_LABELS[plan.criticidade || 'amarelo'] || plan.criticidade || 'Média',
      plan.executor ? plan.executor.toUpperCase() : 'INTERNO',
      plan.legal ? 'SIM' : 'NÃO',
      safetyText,
      technician,
      isCalScheduled,
      activeText
    ])

    row.height = 22
    const isEven = idx % 2 === 0
    const bgColor = isEven ? 'FFFFFFFF' : 'FFF8F9FA'

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.alignment = { vertical: 'middle', horizontal: colNumber <= 3 || colNumber >= 6 ? 'center' : 'left' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      }

      // Destacar Estado
      if (colNumber === 13) {
        if (activeText === 'ATIVO') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E8449' } }
        } else {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFC0392B' } }
        }
      }
    })
  })

  // Ajuste automático de largura das colunas
  sheet.columns.forEach((column) => {
    let maxLen = 12
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length
      if (len > maxLen && len < 60) maxLen = len
    })
    column.width = Math.max(maxLen + 4, 12)
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(arrayBuffer)
}

/**
 * Gerar Ficheiro Excel: FR-MAN-09 MANUTENÇÃO_05_08_2026.xlsx (Histórico + Aberto)
 */
export async function generateTasksHistoryExcel(
  tasks: Task[],
  assets: Asset[],
  users: User[]
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RG Maintenance OS'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Histórico e OTs em Aberto', {
    views: [{ showGridLines: true }]
  })

  const assetMap = new Map<string, Asset>()
  assets.forEach(a => assetMap.set(a.id, a))

  const userMap = new Map<string, string>()
  users.forEach(u => userMap.set(u.id, u.name))

  // Cabeçalho de Título do Documento
  sheet.mergeCells('A1:L1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'FR-MAN-09 FOLHA DE REGISTO DE ORDENS DE TRABALHO (HISTÓRICO E EM ABERTO)'
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 35

  // Subtítulo de Informação
  sheet.mergeCells('A2:L2')
  const subCell = sheet.getCell('A2')
  const pendingCount = tasks.filter(t => t.status !== 'done' && (t.status as string) !== 'completed').length
  const doneCount = tasks.length - pendingCount
  subCell.value = `RG MAINTENANCE OS — BACKUP AUTOMÁTICO REALIZADO EM: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT')} | TOTAL OTs: ${tasks.length} (EM ABERTO: ${pendingCount} | CONCLUÍDAS: ${doneCount})`
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF333333' } }
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } }
  subCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 20

  sheet.addRow([]) // Linha em branco

  // Definição das Colunas
  const headerRowNumber = 4
  const headers = [
    'Nº OT',
    'DATA CRIAÇÃO',
    'TIPO',
    'TAG',
    'EQUIPAMENTO',
    'TÍTULO DA TAREFA / TRABALHO',
    'CRITICIDADE',
    'TÉCNICO / ATRIBUÍDO',
    'ESTADO',
    'PRAZO / DATA CONCLUSÃO',
    'REGRAS DE SEGURANÇA',
    'CUSTO TOTAL (€)'
  ]

  const headerRow = sheet.getRow(headerRowNumber)
  headerRow.values = headers
  headerRow.height = 28

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1B4F72' } },
      left: { style: 'thin', color: { argb: 'FF1B4F72' } },
      bottom: { style: 'medium', color: { argb: 'FF1B4F72' } },
      right: { style: 'thin', color: { argb: 'FF1B4F72' } }
    }
  })

  // Ordenar tarefas por data (usando compareDates para ordenação robusta por DATA)
  const sortedTasks = [...tasks].sort((a, b) =>
    compareDates(a.plannedStartDate || a.createdAt, b.plannedStartDate || b.createdAt)
  )

  sortedTasks.forEach((task, idx) => {
    const asset = task.assetId ? assetMap.get(task.assetId) : null
    const tag = task.tag || asset?.tag || '—'
    const equipName = asset?.name || 'Vários / Geral'
    const createdDate = task.createdAt ? new Date(task.createdAt).toLocaleDateString('pt-PT') : '—'
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-PT') : '—'
    const technician = task.assignedTo ? (userMap.get(task.assignedTo) || task.assignedTo) : 'Não Atribuído'
    const safetyText = task.safetyRules ? task.safetyRules.join('; ') : '—'
    const cost = task.totalCost != null ? `${task.totalCost.toFixed(2)} €` : '0.00 €'
    const statusText = STATUS_LABELS[task.status] || task.status

    const row = sheet.addRow([
      task.id,
      createdDate,
      TIPO_LABELS[task.tipo] || task.tipo,
      tag,
      equipName,
      task.title || task.description || '—',
      CRITICIDADE_LABELS[task.criticidade || 'amarelo'] || task.criticidade || 'Média',
      technician,
      statusText,
      dueDate,
      safetyText,
      cost
    ])

    row.height = 22
    const isEven = idx % 2 === 0
    const bgColor = isEven ? 'FFFFFFFF' : 'FFF8F9FA'

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.alignment = { vertical: 'middle', horizontal: colNumber <= 4 || colNumber === 7 || colNumber === 9 || colNumber === 10 ? 'center' : 'left' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      }

      // Destacar Estado
      if (colNumber === 9) {
        if (task.status === 'done' || (task.status as string) === 'completed') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E8449' } }
        } else if (task.status === 'in_progress') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD4AC0D' } }
        } else {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFC0392B' } }
        }
      }
    })
  })

  // Ajuste automático de largura das colunas
  sheet.columns.forEach((column) => {
    let maxLen = 12
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length
      if (len > maxLen && len < 60) maxLen = len
    })
    column.width = Math.max(maxLen + 4, 12)
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(arrayBuffer)
}
