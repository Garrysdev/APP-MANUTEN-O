import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listMaintenancePlans, listTasks, listAssets, listUsers } from '@/lib/firebase/data'
import { generateMaintenancePlanExcel, generateTasksHistoryExcel } from '@/lib/excel-backup'

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile()
    if (!profile) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    const [plans, tasks, assets, users] = await Promise.all([
      listMaintenancePlans(profile.companyId),
      listTasks(profile.companyId),
      listAssets(profile.companyId),
      listUsers(profile.companyId)
    ])

    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_')

    if (type === 'plan') {
      const buffer = await generateMaintenancePlanExcel(plans, assets, users)
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.ms-excel',
          'Content-Disposition': `attachment; filename="PL-MAN-01 PLANO MANUTENÇÃO_2026.xls"`
        }
      })
    }

    if (type === 'tasks') {
      const buffer = await generateTasksHistoryExcel(tasks, assets, users)
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.ms-excel',
          'Content-Disposition': `attachment; filename="FR-MAN-09 MANUTENÇÃO_${dateStr}.xls"`
        }
      })
    }

    return NextResponse.json({
      planUrl: `/api/backup/excel?type=plan`,
      tasksUrl: `/api/backup/excel?type=tasks`,
      timestamp: new Date().toISOString(),
      counts: {
        plans: plans.length,
        tasks: tasks.length
      }
    })
  } catch (err) {
    console.error('Erro na API de Backup Excel:', err)
    return NextResponse.json({ error: 'Erro ao gerar ficheiros de backup Excel.' }, { status: 500 })
  }
}
