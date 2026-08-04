import { NextRequest, NextResponse } from 'next/server'
import { listTasks, listMaintenancePlans } from '@/lib/firebase/data'

export const runtime = 'nodejs'

function formatICalDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}T090000Z`
}

function escapeICalText(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') || 'rjHNaSUbLm4qTMyKP0oX'

  try {
    const [tasks, plans] = await Promise.all([
      listTasks(companyId),
      listMaintenancePlans(companyId),
    ])

    const events: string[] = []

    // Add active Tasks with due dates
    tasks.forEach((t) => {
      if (!t.dueDate || t.status === 'done' || t.status === 'cancelled') return
      const dt = formatICalDate(t.dueDate)
      if (!dt) return
      events.push([
        'BEGIN:VEVENT',
        `UID:task-${t.id}@rgmaintenance.pt`,
        `DTSTAMP:${formatICalDate(new Date().toISOString())}`,
        `DTSTART:${dt}`,
        `DTEND:${dt}`,
        `SUMMARY:${escapeICalText(`[OT-${t.id}] ${t.title}`)}`,
        `DESCRIPTION:${escapeICalText(`Equipamento/TAG: ${t.tag || 'N/A'}\nCriticidade: ${t.criticidade}\nEstado: ${t.status}`)}`,
        'END:VEVENT'
      ].join('\r\n'))
    })

    // Add Maintenance Plans marked showInCalendar === true
    plans.filter((p) => p.active && p.showInCalendar === true).forEach((p) => {
      const dates = p.calendarDates && p.calendarDates.length > 0
        ? p.calendarDates
        : p.calendarStartDate
          ? [p.calendarStartDate]
          : []

      dates.forEach((dStr, idx) => {
        const dt = formatICalDate(dStr)
        if (!dt) return
        events.push([
          'BEGIN:VEVENT',
          `UID:plan-${p.id}-${idx}@rgmaintenance.pt`,
          `DTSTAMP:${formatICalDate(new Date().toISOString())}`,
          `DTSTART:${dt}`,
          `DTEND:${dt}`,
          `SUMMARY:${escapeICalText(`[PLANO] ${p.title}`)}`,
          `DESCRIPTION:${escapeICalText(`TAG: ${p.tag || 'N/A'}\nPeriodicidade: ${p.periodicidade || 'mensal'}\nExecutor: ${p.executor || 'interno'}`)}`,
          'END:VEVENT'
        ].join('\r\n'))
      })
    })

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RG Maintenance//Maintenance Calendar//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:RG Maintenance - Calendário de OTs',
      'X-WR-TIMEZONE:Europe/Lisbon',
      ...events,
      'END:VCALENDAR'
    ].join('\r\n')

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="rg_maintenance.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[iCal Feed] Error generating calendar feed:', err)
    return new NextResponse('Erro ao gerar feed do calendário', { status: 500 })
  }
}
