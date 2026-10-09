'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { createWarehouse, updateWarehouse, deleteWarehouse, listWarehouses, DEFAULT_WAREHOUSE_IDS } from '@/lib/firebase/data'
import { LIMITS } from '@/lib/plans'
import type { PlanName } from '@/types/models'

export type WarehouseFormState = { error?: string; ok?: boolean; id?: string }

export async function createWarehouseAction(formData: FormData): Promise<WarehouseFormState> {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'O nome do armazém é obrigatório.' }

  const plan = (profile.company?.plan ?? 'free') as PlanName
  const { maxWarehouses } = LIMITS[plan] ?? LIMITS.free
  const current = (await listWarehouses(profile.companyId)).filter((w) => !DEFAULT_WAREHOUSE_IDS.has(w.id))
  if (current.length >= maxWarehouses) {
    return { error: `Limite de ${maxWarehouses} armazém(ns) atingido no plano ${plan}. Faz upgrade para adicionar mais.` }
  }

  try {
    const id = await createWarehouse(profile.companyId, {
      name,
      address: String(formData.get('address') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    })
    revalidatePath('/dashboard/warehouses')
    revalidatePath('/dashboard/stocks')
    return { ok: true, id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar armazém.' }
  }
}

export async function updateWarehouseAction(id: string, formData: FormData): Promise<WarehouseFormState> {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'O nome do armazém é obrigatório.' }

  try {
    await updateWarehouse(profile.companyId, id, {
      name,
      address: String(formData.get('address') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    })
    revalidatePath('/dashboard/warehouses')
    revalidatePath('/dashboard/stocks')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar armazém.' }
  }
}

export async function deleteWarehouseAction(id: string): Promise<WarehouseFormState> {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    await deleteWarehouse(profile.companyId, id)
    revalidatePath('/dashboard/warehouses')
    revalidatePath('/dashboard/stocks')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar armazém.' }
  }
}
