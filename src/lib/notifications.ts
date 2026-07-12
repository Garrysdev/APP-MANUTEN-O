import type { Task, User } from '@/types/models'
import { sendWebPush } from './webpush-server'

/**
 * Módulo de Notificações
 * Inclui Web Push Nativo e Mock de E-mails.
 */

export async function sendTaskAssignedEmail(user: Partial<User>, task: Pick<Task, 'title' | 'id'>) {
  // 1. Tentar Web Push Nativo
  if (user.pushSubscription) {
    await sendWebPush(user.pushSubscription, {
      title: 'Nova Tarefa Atribuída',
      message: `Foste alocado à Tarefa: ${task.title}`,
      url: `/dashboard/tasks/${task.id}`,
    })
    console.log(`[PUSH NOTIFICATION] Enviada para ${user.name}`)
  }

  // 2. Fallback Mock E-mail
  const emailContent = `
    [MOCK EMAIL]
    Para: ${user.name} <${user.email}>
    Assunto: Nova Ordem de Trabalho Atribuída
    
    Olá ${user.name},
    
    Foi-te atribuída a seguinte Tarefa (OT):
    - ${task.title}
    
    Por favor, verifica o teu Dashboard na plataforma RG Maintenance.
    Link: /dashboard/tasks/${task.id}
  `
  console.log('\n--- A ENVIAR E-MAIL ---', emailContent, '--- FIM DO E-MAIL ---\n')
}

export async function sendUrgentTaskEmail(task: Pick<Task, 'title' | 'id' | 'companyId'>) {
  // Num cenário real, aqui procuraríamos os Managers da empresa para enviar o Web Push ou E-mail.
  const emailContent = `
    [MOCK EMAIL URGENTE]
    Para: Gestores da Empresa ${task.companyId}
    Assunto: 🚨 TAREFA URGENTE DETETADA 🚨
    
    Uma tarefa marcada como URGENTE foi adicionada ao sistema:
    - ${task.title}
    
    Por favor, verificar e atribuir o mais rapidamente possível!
    Link: /dashboard/tasks/${task.id}
  `
  console.log('\n--- A ENVIAR ALERTA URGENTE ---', emailContent, '--- FIM DO ALERTA ---\n')
}
