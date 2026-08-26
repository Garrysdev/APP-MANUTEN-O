'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssets, listUsers, createTask } from '@/lib/firebase/data'
import ExcelJS from 'exceljs'
import type { TipoTarefa } from '@/types/models'

export type ImportHistoryState = { error?: string; created?: number; skipped?: number }

function normalizeHeader(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

const HISTORY_COLUMN_MAP: Record<string, string> = {
  ID: 'rawId',
  DATA: 'data',
  DATAINTERVENCAO: 'data',
  DATACRIACAO: 'data',
  AREA: 'area',
  TAG: 'tag',
  EQUIPAMENTO: 'assetName',
  EQUIPAMENTOTAG: 'tag',
  TI: 'ti',
  TIPO: 'ti',
  AVARIA: 'avaria',
  AVARIADESCRICAO: 'avaria',
  TAREFA: 'avaria',
  TITULO: 'avaria',
  DESCRICAO: 'avaria',
  TECNICOS: 'tecnicos',
  TECNICO: 'tecnicos',
  INICIO: 'inicio',
  FIM: 'fim',
  CAUSA: 'causa',
  CAUSAOBS: 'causa',
  OBSERVACOES: 'causa',
  OBS: 'causa',
}

function parseTiCode(raw?: string): TipoTarefa {
  if (!raw) return 'curativa'
  const lower = raw.toLowerCase().trim()
  if (lower === 'mc' || lower.includes('curat')) return 'curativa'
  if (lower === 'mp' || lower.includes('prev')) return 'preventiva'
  if (lower === 'pm' || lower.includes('plan')) return 'plano'
  if (lower === 'ins' || lower.includes('insp')) return 'inspecao'
  if (lower === 'lub' || lower.includes('lubr')) return 'lubrificacao'
  if (lower === 'cal' || lower.includes('calib')) return 'calibracao'
  return 'curativa'
}

/** Importa histórico de intervenções em massa a partir de um ficheiro Excel (.xls ou .xlsx) */
export async function importHistoryAction(formData: FormData): Promise<ImportHistoryState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão para importar histórico.' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Ficheiro em falta.' }

  try {
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) return { error: 'Folha de cálculo vazia.' }

    // Encontrar linha de cabeçalho (geralmente linha 1 ou linha 4 se for modelo oficial FR-MAN-09)
    let headerRowIndex = 1
    let colByField = new Map<string, number>()

    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r)
      const map = new Map<string, number>()
      row.eachCell((cell, colNumber) => {
        const norm = normalizeHeader(String(cell.value ?? ''))
        const field = HISTORY_COLUMN_MAP[norm]
        if (field) map.set(field, colNumber)
      })
      if (map.has('avaria') || map.has('data') || map.has('tag')) {
        headerRowIndex = r
        colByField = map
        break
      }
    }

    if (colByField.size === 0) {
      return { error: 'Não foi possível reconhecer o formato das colunas do ficheiro Excel.' }
    }

    const assets = await listAssets(profile.companyId)
    const assetByName = new Map(assets.map((a) => [normalizeHeader(a.name), a.id]))
    const assetByTag = new Map(assets.filter((a) => a.tag).map((a) => [normalizeHeader(a.tag ?? ''), a.id]))

    const users = await listUsers(profile.companyId)
    const userByAbbr = new Map(users.filter((u) => u.abbreviation).map((u) => [normalizeHeader(u.abbreviation ?? ''), u.id]))
    const userByName = new Map(users.map((u) => [normalizeHeader(u.name), u.id]))

    const MAX_ROWS = 3000
    if (sheet.rowCount - headerRowIndex > MAX_ROWS) {
      return { error: `Ficheiro com demasiadas linhas (máx. ${MAX_ROWS}).` }
    }

    let created = 0
    let skipped = 0

    for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      const cellText = (field: string) => {
        const col = colByField.get(field)
        if (!col) return ''
        const val = row.getCell(col).value
        if (val instanceof Date) return val.toISOString().slice(0, 10)
        return String(val ?? '').trim()
      }

      const avaria = cellText('avaria') || cellText('causa')
      const rawDataStr = cellText('data')
      const tagStr = cellText('tag')
      const assetNameStr = cellText('assetName')

      // Ignorar linhas vazias
      if (!avaria && !rawDataStr && !tagStr && !assetNameStr) {
        skipped++
        continue
      }

      const assetId = (tagStr && assetByTag.get(normalizeHeader(tagStr)))
        || (assetNameStr && assetByName.get(normalizeHeader(assetNameStr)))
        || tagStr
        || cellText('area')
        || 'Geral'

      const techStr = cellText('tecnicos')
      const assignedTo = (techStr && userByAbbr.get(normalizeHeader(techStr)))
        || (techStr && userByName.get(normalizeHeader(techStr)))
        || null

      const tipo = parseTiCode(cellText('ti'))
      const excelData = rawDataStr
      const excelInicio = cellText('inicio')
      const excelFim = cellText('fim')

      const dataStr = excelData || excelInicio || new Date().toISOString().slice(0, 10)
      const inicio = excelInicio || dataStr
      const fim = excelFim || inicio

      await createTask(profile.companyId, profile.id, {
        title: avaria || 'Intervenção Importada',
        description: cellText('causa') || avaria || null,
        assetId,
        tag: tagStr || null,
        area: cellText('area') || null,
        tipo,
        criticidade: 'verde',
        status: 'done',
        createdAt: dataStr,
        plannedStartDate: inicio,
        completedAt: fim,
        dueDate: fim,
        assignedTo,
        source: 'folha_ur_historico',
      })
      created++
    }

    revalidatePath('/dashboard/history')
    return { created, skipped }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao importar ficheiro de histórico.' }
  }
}
