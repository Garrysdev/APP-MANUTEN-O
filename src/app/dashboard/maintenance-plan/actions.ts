'use server'

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { getCurrentProfile } from '@/lib/firebase/session'
import {
  createMaintenancePlan,
  updateMaintenancePlan,
  deleteMaintenancePlan,
  listAssets,
} from '@/lib/firebase/data'
import type { TaskCriticidade, TipoTarefa, Periodicidade, Executor } from '@/types/models'
import { periodicidadeToRecurrence, CRITICIDADE_LABELS, PERIODICIDADE_LABELS } from '@/types/models'

export type PlanFormState = { error?: string; ok?: boolean; id?: string }

const CRITICIDADES: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']
const TIPOS: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'inspecao', 'lubrificacao', 'calibracao', 'outro']
const PERIODICIDADES: Periodicidade[] = ['semanal', 'mensal', 'trimestral', 'bianual', 'anual', 'bienal', 'trianual', 'horas', 'pontual']
const EXECUTORES: Executor[] = ['interno', 'externo']

function parsePlan(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) throw new Error('O título é obrigatório.')

  const criticidade = String(formData.get('criticidade') ?? 'verde') as TaskCriticidade
  const tipo = String(formData.get('tipo') ?? 'preventiva') as TipoTarefa
  const periodicidade = String(formData.get('periodicidade') ?? 'mensal') as Periodicidade
  const periodOk: Periodicidade = PERIODICIDADES.includes(periodicidade) ? periodicidade : 'mensal'
  const executor = String(formData.get('executor') ?? 'interno') as Executor
  const legal = formData.get('legal') === 'on' || formData.get('legal') === 'true'
  const { recurrence, recurrenceValue } = periodicidadeToRecurrence(periodOk)

  let safetyRules: string[] | null = null
  try {
    const raw = String(formData.get('safetyRules') ?? '').trim()
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((r) => typeof r === 'string' && r.length <= 500)) {
        safetyRules = parsed.map((r) => String(r).trim()).filter(Boolean).slice(0, 20)
      }
    }
  } catch { safetyRules = null }

  return {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    assetId: String(formData.get('assetId') ?? '').trim() || null,
    assignedTo: String(formData.get('assignedTo') ?? '').trim() || null,
    criticidade: CRITICIDADES.includes(criticidade) ? criticidade : 'verde',
    tipo: TIPOS.includes(tipo) ? tipo : 'preventiva',
    periodicidade: periodOk,
    executor: EXECUTORES.includes(executor) ? executor : 'interno',
    legal,
    recurrence,
    recurrenceValue,
    safetyRules,
    active: true,
  }
}

export async function createMaintenancePlanAction(
  _prev: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    const id = await createMaintenancePlan(profile.companyId, profile.id, parsePlan(formData))
    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard/calendar')
    return { ok: true, id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar plano.' }
  }
}

export type ImportPlansState = { error?: string; created?: number; skipped?: number }

function normalizeHeader(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
}

function matchEnum<T extends string>(raw: string, labels: Record<T, string>, fallback: T): T {
  const norm = normalizeHeader(raw)
  if (!norm) return fallback
  const keys = Object.keys(labels) as T[]
  if (keys.includes(norm.toLowerCase() as T)) return norm.toLowerCase() as T
  // match exact label, or label's leading word/phrase before any "(" annotation (ex: "Bianual (2x/ano)")
  const byExactLabel = keys.find((k) => normalizeHeader(labels[k]) === norm)
  if (byExactLabel) return byExactLabel
  const byLeadingLabel = keys.find((k) => normalizeHeader(labels[k].split('(')[0]) === norm)
  if (byLeadingLabel) return byLeadingLabel
  const byPrefix = keys.find((k) => {
    const labelNorm = normalizeHeader(labels[k].split('(')[0])
    return labelNorm && norm.startsWith(labelNorm)
  })
  return byPrefix ?? fallback
}

const PLAN_COLUMN_MAP: Record<string, string> = {
  TAG: 'tag',
  AREA: 'area',
  SISTEMA: 'system',
  SYSTEM: 'system',
  TAREFA: 'title',
  TITULO: 'title',
  DESIGNACAO: 'title',
  DESCRICAO: 'description',
  EQUIPAMENTO: 'assetName',
  PERIODICIDADE: 'periodicidade',
  EXECUTOR: 'executor',
  LEGAL: 'legal',
  MESES: 'months',
  MES: 'months',
  CRITICIDADE: 'criticidade',
  ESTADO: 'active',
}

/** Importa planos de manutenção em massa a partir de um ficheiro Excel: TAG, ÁREA, SISTEMA, TAREFA, EQUIPAMENTO, PERIODICIDADE, EXECUTOR, LEGAL, MESES, CRITICIDADE, ESTADO. */
export async function importMaintenancePlansAction(formData: FormData): Promise<ImportPlansState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Ficheiro em falta.' }

  try {
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) return { error: 'Folha de cálculo vazia.' }

    const headerRow = sheet.getRow(1)
    const colByField = new Map<string, number>()
    headerRow.eachCell((cell, colNumber) => {
      const field = PLAN_COLUMN_MAP[normalizeHeader(String(cell.value ?? ''))]
      if (field) colByField.set(field, colNumber)
    })
    if (!colByField.has('title')) {
      return { error: 'Coluna "TAREFA" (ou "TÍTULO") não encontrada no ficheiro.' }
    }

    const assets = await listAssets(profile.companyId)
    const assetByName = new Map(assets.map((a) => [normalizeHeader(a.name), a.id]))
    const assetByTag = new Map(assets.filter((a) => a.tag).map((a) => [normalizeHeader(a.tag ?? ''), a.id]))

    const MAX_ROWS = 2000
    if (sheet.rowCount - 1 > MAX_ROWS) {
      return { error: `Ficheiro com demasiadas linhas (máx. ${MAX_ROWS}).` }
    }

    let created = 0
    let skipped = 0
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      const cellText = (field: string) => {
        const col = colByField.get(field)
        if (!col) return ''
        return String(row.getCell(col).value ?? '').trim()
      }
      const title = cellText('title')
      if (!title) { skipped++; continue }

      const tag = cellText('tag') || null
      const assetId = (tag && assetByTag.get(normalizeHeader(tag)))
        || assetByName.get(normalizeHeader(cellText('assetName')))
        || null

      const periodOk = matchEnum(cellText('periodicidade') || 'mensal', PERIODICIDADE_LABELS, 'mensal' as Periodicidade)
      const criticidadeOk = matchEnum(cellText('criticidade') || 'verde', CRITICIDADE_LABELS, 'verde' as TaskCriticidade)
      const executorRaw = normalizeHeader(cellText('executor'))
      const executor: Executor = executorRaw === 'EXTERNO' ? 'externo' : 'interno'
      const legalRaw = normalizeHeader(cellText('legal'))
      const legal = legalRaw === 'SIM' || legalRaw === 'TRUE' || legalRaw === '1' || legalRaw === 'X'
      const estadoRaw = normalizeHeader(cellText('active'))
      const active = estadoRaw !== 'INATIVO' && estadoRaw !== 'FALSE' && estadoRaw !== '0'
      const { recurrence, recurrenceValue } = periodicidadeToRecurrence(periodOk)

      await createMaintenancePlan(profile.companyId, profile.id, {
        title,
        description: cellText('description') || null,
        assetId,
        assignedTo: null,
        criticidade: criticidadeOk,
        tipo: 'plano',
        recurrence,
        recurrenceValue,
        safetyRules: null,
        active,
        periodicidade: periodOk,
        periodicidadeLabel: cellText('periodicidade') || null,
        executor,
        legal,
        months: cellText('months') || null,
        tag,
        area: cellText('area') || null,
        system: cellText('system') || null,
      })
      created++
    }

    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard/calendar')
    return { created, skipped }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao importar ficheiro.' }
  }
}

export async function updateMaintenancePlanAction(
  _prev: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'ID em falta.' }
  try {
    await updateMaintenancePlan(profile.companyId, id, parsePlan(formData))
    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard/calendar')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar plano.' }
  }
}

export async function deleteMaintenancePlanAction(id: string): Promise<PlanFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    await deleteMaintenancePlan(profile.companyId, id)
    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard/calendar')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar plano.' }
  }
}

export async function toggleMaintenancePlanActiveAction(
  id: string,
  active: boolean
): Promise<PlanFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    await updateMaintenancePlan(profile.companyId, id, { active })
    revalidatePath('/dashboard/maintenance-plan')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar estado.' }
  }
}
