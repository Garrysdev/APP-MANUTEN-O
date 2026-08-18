'use server'

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { getCurrentProfile } from '@/lib/firebase/session'
import { createAsset, updateAsset, deleteAsset } from '@/lib/firebase/data'
import type { Asset } from '@/types/models'

export type AssetFormState = { error?: string; ok?: boolean }

function parseAsset(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) throw new Error('O nome é obrigatório.')
  const tagsRaw = String(formData.get('tags') ?? '').trim()
  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : null
  return {
    name,
    location: String(formData.get('location') ?? '').trim() || null,
    type: String(formData.get('type') ?? '').trim() || null,
    serialNumber: String(formData.get('serialNumber') ?? '').trim() || null,
    tags,
    photoUrl: String(formData.get('photoUrl') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    active: formData.get('active') === 'true',
    area: String(formData.get('area') ?? '').trim() || null,
    tag: String(formData.get('tag') ?? '').trim() || null,
    manufacturer: String(formData.get('manufacturer') ?? '').trim() || null,
    characteristics: String(formData.get('characteristics') ?? '').trim() || null,
  }
}

export async function createAssetAction(
  _prev: AssetFormState,
  formData: FormData
): Promise<AssetFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    await createAsset(profile.companyId, parseAsset(formData))
    revalidatePath('/dashboard/assets')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar ativo.' }
  }
}

export async function updateAssetAction(
  _prev: AssetFormState,
  formData: FormData
): Promise<AssetFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'ID em falta.' }
  try {
    await updateAsset(profile.companyId, id, parseAsset(formData))
    revalidatePath('/dashboard/assets')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar ativo.' }
  }
}

export type ImportAssetsState = { error?: string; created?: number; skipped?: number }

function normalizeHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
}

const COLUMN_MAP: Record<string, keyof Pick<Asset, 'area' | 'tag' | 'name' | 'characteristics' | 'manufacturer' | 'notes'>> = {
  AREA: 'area',
  TAG: 'tag',
  DESIGNACAO: 'name',
  CARACTERISTICAS: 'characteristics',
  FORNECEDOR: 'manufacturer',
  OBS: 'notes',
  OBSERVACOES: 'notes',
}

/** Importa equipamentos em massa a partir de um ficheiro Excel (cadastro): AREA, TAG, DESIGNAÇÃO, CARACTERISTICAS, FORNECEDOR, OBS. */
export async function importAssetsAction(formData: FormData): Promise<ImportAssetsState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

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
      const field = COLUMN_MAP[normalizeHeader(String(cell.value ?? ''))]
      if (field) colByField.set(field, colNumber)
    })
    if (!colByField.has('name')) {
      return { error: 'Coluna "DESIGNAÇÃO" não encontrada no ficheiro.' }
    }

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
      const name = cellText('name')
      if (!name) { skipped++; continue }

      await createAsset(profile.companyId, {
        name,
        location: null,
        type: null,
        serialNumber: null,
        tags: null,
        photoUrl: null,
        notes: cellText('notes') || null,
        active: true,
        area: cellText('area') || null,
        tag: cellText('tag') || null,
        system: null,
        manufacturer: cellText('manufacturer') || null,
        characteristics: cellText('characteristics') || null,
        criticidadeABC: null,
      })
      created++
    }

    revalidatePath('/dashboard/assets')
    return { created, skipped }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao importar ficheiro.' }
  }
}

export async function deleteAssetAction(id: string): Promise<AssetFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    await deleteAsset(profile.companyId, id)
    revalidatePath('/dashboard/assets')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar ativo.' }
  }
}

export async function bulkDeleteAssetsAction(ids: string[]): Promise<AssetFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    await Promise.all(ids.map(id => deleteAsset(profile.companyId, id)))
    revalidatePath('/dashboard/assets')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar ativos.' }
  }
}

export async function bulkUpdateAssetsAction(ids: string[], updates: Partial<Pick<Asset, 'area' | 'tag'>>): Promise<AssetFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    await Promise.all(ids.map(id => updateAsset(profile.companyId, id, updates)))
    revalidatePath('/dashboard/assets')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar ativos.' }
  }
}
