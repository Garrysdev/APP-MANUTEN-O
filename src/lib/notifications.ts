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

export async function sendOTClosureEmailNotification({
  toEmail,
  taskTitle,
  taskId,
  tag,
  area,
  closureNotes,
  closedByName,
}: {
  toEmail: string
  taskTitle: string
  taskId: string
  tag?: string | null
  area?: string | null
  closureNotes?: string | null
  closedByName?: string | null
}) {
  const subject = `[RG Maintenance] Resolução do Pedido de Intervenção: ${taskTitle}`

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="background-color: #1e293b; padding: 16px 20px; border-radius: 8px; text-align: center;">
        <h2 style="color: #38bdf8; margin: 0; font-size: 20px;">RG Maintenance — Conclusão de Intervenção</h2>
      </div>
      <div style="padding: 20px 0;">
        <p style="font-size: 15px; color: #334155;">Estimado(a) Solicitante,</p>
        <p style="font-size: 15px; color: #334155;">Informamos que a Ordem de Trabalho relativa ao seu <strong>Pedido de Intervenção (PI)</strong> foi concluída com sucesso.</p>

        <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #0284c7; border-radius: 6px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a;">Detalhes da OT:</h4>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Título:</strong> ${taskTitle}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Equipamento / TAG:</strong> ${tag || 'Geral'}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Área / Localização:</strong> ${area || 'Geral'}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Data de Conclusão:</strong> ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        ${closureNotes ? `
        <div style="background-color: #f0fdf4; padding: 16px; border-left: 4px solid #16a34a; border-radius: 6px; margin: 20px 0;">
          <h4 style="margin: 0 0 8px 0; color: #166534;">Relatório da Intervenção (O que foi feito):</h4>
          <p style="margin: 0; font-size: 14px; color: #15803d; white-space: pre-line;">${closureNotes}</p>
        </div>
        ` : ''}

        <p style="font-size: 13px; color: #64748b; margin-top: 30px;">
          Técnico Responsável / Encerrado por: <strong>${closedByName || 'Equipa de Manutenção'}</strong>
        </p>
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 12px; color: #94a3b8;">
        RG Maintenance System • Notificação Automática
      </div>
    </div>
  `

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'RG Maintenance <notificacoes@rgmaintenance.pt>',
          to: [toEmail],
          subject,
          html: htmlContent,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('[RESEND EMAIL ERROR]', errText)
      } else {
        console.log(`[RESEND EMAIL SUCCESS] Enviado para ${toEmail}`)
      }
    } catch (err) {
      console.error('[RESEND FETCH EXCEPTION]', err)
    }
  } else {
    console.log(`\n--- A ENVIAR E-MAIL DE FECHO DE PI ---`)
    console.log(`Para: ${toEmail}`)
    console.log(`Assunto: ${subject}`)
    console.log(`Relatório: ${closureNotes || 'Sem observações'}`)
    console.log(`--- FIM DO E-MAIL DE FECHO ---\n`)
  }
}
