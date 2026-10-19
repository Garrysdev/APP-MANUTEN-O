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

    // 1. Tentar resolver no Firestore por abreviatura ou prefixo do email. Consultas exatas
    // (antes lia TODOS os utilizadores de todas as empresas a cada tentativa de login —
    // gastava quota e permitia percorrer a lista). Só aceita uma correspondência única.
    try {
      const users = adminDb().collection('users')
      const [byAbbr, byPrefix] = await Promise.all([
        users.where('abbreviation', '==', trimmed.toUpperCase()).limit(2).get(),
        // Intervalo [prefixo@, prefixoA): 'A' é o carácter a seguir a '@' — apanha
        // qualquer "prefixo@dominio".
        users.where('email', '>=', `${trimmed}@`).where('email', '<', `${trimmed}A`).limit(2).get(),
      ])
      const matches = byAbbr.size === 1 ? byAbbr.docs : byPrefix.size === 1 ? byPrefix.docs : []
      const email = matches[0]?.data()?.email
      if (email) {
        return NextResponse.json({ email })
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
