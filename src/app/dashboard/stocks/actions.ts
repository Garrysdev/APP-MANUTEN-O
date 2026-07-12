'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { createStockItem, updateStockItem, deleteStockItem } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'

export type StockFormState = { error?: string; ok?: boolean }

export async function createStockItemAction(
  _prev: StockFormState,
  formData: FormData
): Promise<StockFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'stocks')) return { error: 'Funcionalidade não disponível no plano atual.' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Nome obrigatório.' }

  const quantity = Number(formData.get('quantity') ?? 0)
  const unitCostRaw = Number(formData.get('unitCost') ?? '')
  const minQtyRaw = Number(formData.get('minQuantity') ?? '')

  try {
    await createStockItem(profile.companyId, {
      name,
      reference: String(formData.get('reference') ?? '').trim() || null,
      category: String(formData.get('category') ?? '').trim() || null,
      quantity: isNaN(quantity) ? 0 : quantity,
      unit: String(formData.get('unit') ?? '').trim() || null,
      unitCost: unitCostRaw > 0 ? unitCostRaw : null,
      minQuantity: minQtyRaw > 0 ? minQtyRaw : null,
      location: String(formData.get('location') ?? '').trim() || null,
    })
    revalidatePath('/dashboard/stocks')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar item.' }
  }
}

export async function updateStockItemAction(
  id: string,
  _prev: StockFormState,
  formData: FormData
): Promise<StockFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'stocks')) return { error: 'Funcionalidade não disponível no plano atual.' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Nome obrigatório.' }

  const quantity = Number(formData.get('quantity') ?? 0)
  const unitCostRaw = Number(formData.get('unitCost') ?? '')
  const minQtyRaw = Number(formData.get('minQuantity') ?? '')

  try {
    await updateStockItem(profile.companyId, id, {
      name,
      reference: String(formData.get('reference') ?? '').trim() || null,
      category: String(formData.get('category') ?? '').trim() || null,
      quantity: isNaN(quantity) ? 0 : quantity,
      unit: String(formData.get('unit') ?? '').trim() || null,
      unitCost: unitCostRaw > 0 ? unitCostRaw : null,
      minQuantity: minQtyRaw > 0 ? minQtyRaw : null,
      location: String(formData.get('location') ?? '').trim() || null,
    })
    revalidatePath('/dashboard/stocks')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar.' }
  }
}

export async function createStockPurchaseAction(stockItemId: string, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  
  const quantity = parseFloat(String(formData.get('quantity') ?? '0'))
  if (quantity <= 0) return { error: 'Quantidade inválida.' }
  
  const unitCostRaw = String(formData.get('unitCost') ?? '')
  const unitCost = unitCostRaw ? parseFloat(unitCostRaw) : null
  
  const description = String(formData.get('description') ?? '').trim() || 'Reposição manual'

  try {
    const { createStockMovement, incrementStockQuantity } = await import('@/lib/firebase/data')
    await createStockMovement(profile.companyId, profile.id, {
      stockItemId,
      quantity,
      type: 'in',
      cost: unitCost != null ? unitCost * quantity : null, // Store total cost or whatever is appropriate
      description
    })
    
    await incrementStockQuantity(profile.companyId, stockItemId, quantity)
    
    revalidatePath(`/dashboard/stocks/${stockItemId}`)
    revalidatePath('/dashboard/stocks')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao registar compra.' }
  }
}

export async function deleteStockItemAction(id: string): Promise<StockFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    await deleteStockItem(profile.companyId, id)
    revalidatePath('/dashboard/stocks')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar item.' }
  }
}
