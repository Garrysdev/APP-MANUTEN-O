import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(req: Request) {
  try {
    const { username } = await req.json()
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Utilizador inválido' }, { status: 400 })
    }

    const trimmed = username.trim().toLowerCase()
    if (trimmed.includes('@')) {
      return NextResponse.json({ email: trimmed })
    }

    // 1. Tentar resolver no Firestore por abreviatura, email prefix ou nome
    try {
      const snap = await adminDb().collection('users').get()
      const match = snap.docs.find(d => {
        const u = d.data()
        return (
          u.abbreviation?.toLowerCase() === trimmed ||
          u.email?.toLowerCase().startsWith(trimmed + '@') ||
          u.email?.toLowerCase() === trimmed ||
          u.name?.toLowerCase().replace(/\s+/g, '') === trimmed
        )
      })
      if (match && match.data().email) {
        return NextResponse.json({ email: match.data().email })
      }
    } catch (err) {
      console.error('[resolve-email] Firestore lookup error:', err)
    }

    // 2. Mapeamentos conhecidos para utilizadores da empresa UR
    const knownMap: Record<string, string> = {
      'garrido.rui': 'garrido.rui@gmail.com',
      'garrido': 'garrido.rui@gmail.com',
      'rui': 'garrido.rui@gmail.com',
      'rg': 'garrido.rui@gmail.com',
      'rug': 'garrido.rui@gmail.com',
      'lm': 'lm@rgmaintenance.pt',
      'leandro': 'lm@rgmaintenance.pt',
      'li': 'li@rgmaintenance.pt',
      'luis': 'li@rgmaintenance.pt',
      'mc': 'mc@rgmaintenance.pt',
      'manuel': 'mc@rgmaintenance.pt',
      'jc': 'jc@rgmaintenance.pt',
      'joao': 'jc@rgmaintenance.pt',
      'ms': 'ms@rgmaintenance.pt',
      'mario': 'ms@rgmaintenance.pt',
      'cb': 'cb@rgmaintenance.pt',
      'carlos': 'cb@rgmaintenance.pt',
      'ox2': 'ox2@rgmaintenance.pt',
      'blk': 'blockcontrol@rgmaintenance.pt',
      'blockcontrol': 'blockcontrol@rgmaintenance.pt',
      'car': 'carrier@rgmaintenance.pt',
      'carrier': 'carrier@rgmaintenance.pt',
      'sch': 'schindler@rgmaintenance.pt',
      'schindler': 'schindler@rgmaintenance.pt',
      'hel': 'helenos@rgmaintenance.pt',
      'helenos': 'helenos@rgmaintenance.pt',
    }

    const email = knownMap[trimmed] || `${trimmed}@rgmaintenance.pt`
    return NextResponse.json({ email })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao resolver utilizador' }, { status: 500 })
  }
}
