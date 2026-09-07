import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: any = {}
  try {
    results.projectId = process.env.FIREBASE_PROJECT_ID
    results.clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    results.hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY

    // Test write to internal_messages
    const testMsg = {
      test: true,
      content: 'debug test message',
      createdAt: new Date().toISOString(),
    }
    const msgRef = await adminDb().collection('internal_messages').add(testMsg)
    results.msgWrite = { ok: true, id: msgRef.id }

    // Test read from internal_messages
    const msgSnap = await adminDb().collection('internal_messages').doc(msgRef.id).get()
    results.msgRead = { ok: msgSnap.exists, data: msgSnap.data() }

    // Test write to warehouses
    const whRef = await adminDb().collection('warehouses').add({
      name: 'Armazém Teste Debug',
      createdAt: new Date().toISOString(),
    })
    results.whWrite = { ok: true, id: whRef.id }

    // Clean up test docs
    await msgRef.delete()
    await whRef.delete()
    results.cleanup = true
  } catch (err: any) {
    results.error = {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      details: err?.details,
    }
  }
  return NextResponse.json(results)
}
