import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/firebase/session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  return NextResponse.redirect(new URL('/login', request.url))
}
