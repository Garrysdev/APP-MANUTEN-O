/**
 * Script de Backup Diário Automático em Excel
 * Executado localmente no PC para gerar e guardar os ficheiros na pasta:
 * C:\Users\Quinta do Arrobe\Desktop\DOWNLOADS CHROME
 */

const fs = require('fs')
const path = require('path')
const ExcelJS = require('exceljs')

// Carregar JSONs de dados atualizados da app
const assetsPath = path.join(__dirname, 'import', 'assets.json')
const plansPath = path.join(__dirname, 'import', 'plans.json')
const tasksPath = path.join(__dirname, 'import', 'tasks.json')

const targetDir = 'C:\\Users\\Quinta do Arrobe\\Desktop\\DOWNLOADS CHROME'

async function runBackup() {
  console.log('🔄 A iniciar o backup diário em Excel...')

  const targetFolder = 'C:\\Users\\Quinta do Arrobe\\Desktop\\DOWNLOADS CHROME'
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true })
    console.log(`📁 Pasta criada: ${targetFolder}`)
  }

  const assets = fs.existsSync(assetsPath) ? JSON.parse(fs.readFileSync(assetsPath, 'utf8')) : []
  const plans = fs.existsSync(plansPath) ? JSON.parse(fs.readFileSync(plansPath, 'utf8')) : []
  const tasks = fs.existsSync(tasksPath) ? JSON.parse(fs.readFileSync(tasksPath, 'utf8')) : []

  const assetMap = new Map()
  assets.forEach(a => assetMap.set(a.id || a.tag, a))

  // 1. Gerar PL-MAN-01 PLANO MANUTENÇÃO_2026.xlsx
  const wbPlan = new ExcelJS.Workbook()
  const sheetPlan = wbPlan.addWorksheet('Plano de Manutenção', { views: [{ showGridLines: true }] })

  sheetPlan.mergeCells('A1:O1')
  const t1 = sheetPlan.getCell('A1')
  t1.value = 'PL-MAN-01 PLANO DE MANUTENÇÃO PREVENTIVA'
  t1.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
  t1.alignment = { vertical: 'middle', horizontal: 'center' }
  sheetPlan.getRow(1).height = 35

  sheetPlan.mergeCells('A2:O2')
  const s1 = sheetPlan.getCell('A2')
  s1.value = `RG MAINTENANCE OS — BACKUP AUTOMÁTICO EM: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT')} | TOTAL DE PLANOS: ${plans.length}`
  s1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF333333' } }
  s1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } }
  s1.alignment = { vertical: 'middle', horizontal: 'center' }
  sheetPlan.getRow(2).height = 20

  sheetPlan.addRow([])

  const planHeaders = [
    'ÁREA', 'TAG', 'SISTEMA', 'EQUIPAMENTO', 'AÇÃO / TAREFA', 'PERIODICIDADE',
    'CRITICIDADE', 'EXECUTOR', 'OBRIGATÓRIA (LEGAL)', 'REGRAS DE SEGURANÇA (EPIs)',
    'FOLHAS DE REGISTO (FR)', 'INSTRUÇÕES DE TRABALHO (IT)', 'TÉCNICO ATRIBUÍDO',
    'AGENDADO NO CALENDÁRIO', 'ESTADO'
  ]

  const hrPlan = sheetPlan.getRow(4)
  hrPlan.values = planHeaders
  hrPlan.height = 28
  hrPlan.eachCell(c => {
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  plans.forEach((p, idx) => {
    const ast = p.assetId ? assetMap.get(p.assetId) : null
    const row = sheetPlan.addRow([
      p.area || ast?.area || '—',
      p.tag || ast?.tag || '—',
      p.system || ast?.system || '—',
      ast?.name || p.equipamento || 'Vários / Geral',
      p.title || p.acao || p.description || '—',
      p.periodicidadeLabel || p.periodicidade || '—',
      p.criticidade || 'Média',
      (p.executor || 'interno').toUpperCase(),
      p.legal ? 'SIM' : 'NÃO',
      p.safetyRules ? p.safetyRules.map(r => r.title || r.id).join('; ') : '—',
      p.requiredFRs ? p.requiredFRs.join('; ') : '—',
      p.requiredITs ? p.requiredITs.join('; ') : '—',
      p.assignedTo || 'Não Atribuído',
      p.showInCalendar ? 'SIM' : 'NÃO',
      p.active !== false ? 'ATIVO' : 'INATIVO'
    ])
    row.height = 22
  })

  sheetPlan.columns.forEach(col => {
    let maxLen = 12
    col.eachCell?.({ includeEmpty: false }, c => {
      const len = String(c.value || '').length
      if (len > maxLen && len < 60) maxLen = len
    })
    col.width = Math.max(maxLen + 4, 12)
  })

  const planFilePath = path.join(targetFolder, 'PL-MAN-01 PLANO MANUTENÇÃO_2026.xlsx')
  await wbPlan.xlsx.writeFile(planFilePath)
  console.log(`✅ Ficheiro guardado: ${planFilePath}`)

  // 2. Gerar FR-MAN-09 MANUTENÇÃO_DD_MM_YYYY.xlsx
  const wbTasks = new ExcelJS.Workbook()
  const sheetTasks = wbTasks.addWorksheet('Histórico e OTs em Aberto', { views: [{ showGridLines: true }] })

  sheetTasks.mergeCells('A1:O1')
  const t2 = sheetTasks.getCell('A1')
  t2.value = 'FR-MAN-09 FOLHA DE REGISTO DE ORDENS DE TRABALHO (HISTÓRICO E EM ABERTO)'
  t2.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
  t2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheetTasks.getRow(1).height = 35

  sheetTasks.mergeCells('A2:O2')
  const s2 = sheetTasks.getCell('A2')
  const pendingCount = tasks.filter(t => t.status !== 'done' && t.status !== 'completed').length
  s2.value = `RG MAINTENANCE OS — BACKUP AUTOMÁTICO EM: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT')} | TOTAL OTs: ${tasks.length} (EM ABERTO: ${pendingCount})`
  s2.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF333333' } }
  s2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } }
  s2.alignment = { vertical: 'middle', horizontal: 'center' }
  sheetTasks.getRow(2).height = 20

  sheetTasks.addRow([])

  const taskHeaders = [
    'Nº OT', 'DATA CRIAÇÃO', 'TIPO', 'ÁREA', 'TAG', 'EQUIPAMENTO',
    'TÍTULO DA TAREFA / TRABALHO', 'CRITICIDADE', 'TÉCNICO / ATRIBUÍDO',
    'ESTADO', 'PRAZO / DATA CONCLUSÃO', 'REGRAS DE SEGURANÇA',
    'CONSUMÍVEIS / PEÇAS', 'TEMPO ESTIMADO', 'CUSTO TOTAL (€)'
  ]

  const hrTask = sheetTasks.getRow(4)
  hrTask.values = taskHeaders
  hrTask.height = 28
  hrTask.eachCell(c => {
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  tasks.forEach((t, idx) => {
    const ast = t.assetId ? assetMap.get(t.assetId) : null
    const row = sheetTasks.addRow([
      t.id || `OT-${idx+1}`,
      t.createdAt || t.data || '—',
      t.tipo || 'curativa',
      t.area || ast?.area || '—',
      t.tag || ast?.tag || '—',
      ast?.name || t.equipamento || 'Vários / Geral',
      t.title || t.description || '—',
      t.criticidade || 'Média',
      t.assignedTo || 'Não Atribuído',
      t.status === 'done' || t.status === 'completed' ? 'Concluída' : 'Pendente',
      t.dueDate || t.prazo || '—',
      t.safetyRules ? t.safetyRules.map(r => r.title || r.id).join('; ') : '—',
      t.materials ? t.materials.map(m => `${m.name} (${m.quantity}x)`).join('; ') : '—',
      t.estimatedHours ? `${t.estimatedHours}h` : '—',
      t.totalCost != null ? `${t.totalCost.toFixed(2)} €` : '0.00 €'
    ])
    row.height = 22
  })

  sheetTasks.columns.forEach(col => {
    let maxLen = 12
    col.eachCell?.({ includeEmpty: false }, c => {
      const len = String(c.value || '').length
      if (len > maxLen && len < 60) maxLen = len
    })
    col.width = Math.max(maxLen + 4, 12)
  })

  const now = new Date()
  const dateFormatted = `${String(now.getDate()).padStart(2, '0')}_${String(now.getMonth()+1).padStart(2, '0')}_${now.getFullYear()}`
  const tasksFilePath = path.join(targetFolder, `FR-MAN-09 MANUTENÇÃO_${dateFormatted}_8.xlsx`)
  await wbTasks.xlsx.writeFile(tasksFilePath)
  console.log(`✅ Ficheiro guardado: ${tasksFilePath}`)
  console.log('🎉 Backup concluído com sucesso!')
}

runBackup().catch(err => {
  console.error('❌ Erro no backup:', err)
})
