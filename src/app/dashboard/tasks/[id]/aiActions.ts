'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { adminDb } from '@/lib/firebase/admin'
import { listTasksByAsset } from '@/lib/firebase/data'

export async function askTaskConsultantAction(taskId: string, contextData: any) {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  const aiCredits = profile.company?.aiCredits || 0
  if (aiCredits <= 0) {
    return { error: 'Não tens créditos de IA suficientes. Podes adquirir mais na Loja de Módulos.' }
  }

  try {
    const db = adminDb()
    const { FieldValue } = await import('firebase-admin/firestore')
    
    // Deduct 1 credit
    await db.collection('companies').doc(profile.companyId).update({
      aiCredits: FieldValue.increment(-1)
    })

    // Simulate AI thinking
    await new Promise(r => setTimeout(r, 2000))

    let pastTasksInfo = ''
    let failurePrediction = ''
    if (contextData.assetId) {
      const pastTasks = await listTasksByAsset(profile.companyId, contextData.assetId)
      const pastCompleted = pastTasks.filter(t => t.status === 'done' && t.id !== taskId)
      
      if (pastCompleted.length > 0) {
        pastTasksInfo = `Analisei o histórico do equipamento "${contextData.assetName}". Existem ${pastCompleted.length} intervenções passadas. `
        // Simulated prediction logic
        const curativaCount = pastCompleted.filter(t => t.tipo === 'curativa').length
        if (curativaCount >= 2) {
          failurePrediction = 'Atenção: Este equipamento tem um histórico elevado de falhas curativas. Segundo a norma **NP EN 13306** (Terminologia da Manutenção), deves considerar a substituição do ativo ou implementar um plano de manutenção preventiva mais rigoroso para reduzir o MTBF (Mean Time Between Failures). '
        } else {
          failurePrediction = 'O histórico mostra boa fiabilidade. Continua a seguir as diretrizes da **ISO 9001** garantindo a rastreabilidade das peças substituídas. '
        }
      } else {
        pastTasksInfo = `O equipamento "${contextData.assetName}" não tem histórico de intervenções concluídas registadas. `
      }
    }

    const numInterventions = contextData.interventionsCount
    let answer = ''
    
    if (numInterventions === 0) {
      answer = `A analisar a OT "${contextData.title}"... Não existem registos de intervenção ainda. ${pastTasksInfo}${failurePrediction}Como sugestão preliminar, recomendo rever o histórico do equipamento e garantir que o técnico tem as peças necessárias antes de se deslocar ao local.`
    } else {
      answer = `A analisar a OT "${contextData.title}" e os seus ${numInterventions} registos... ${pastTasksInfo}${failurePrediction}Com base nos materiais utilizados e no tempo gasto, recomendo atualizar a periodicidade de manutenção preventiva para evitar reincidência, em conformidade com as exigências de melhoria contínua da **ISO 9001**.`
    }

    revalidatePath(`/dashboard/tasks/${taskId}`)
    
    return { answer, remainingCredits: aiCredits - 1 }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao contactar o Consultor IA.' }
  }
}
