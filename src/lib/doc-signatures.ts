// Assinatura das Folhas de Registo e das Instruções de Trabalho de uma OT: quem preencheu a
// FR / tomou conhecimento da IT é sempre o utilizador com sessão iniciada no servidor —
// nunca um nome enviado pelo browser. Os campos de assinatura que venham do cliente são
// descartados e recalculados aqui.
//
// Onde fica gravado (sem mudar o esquema offline das OTs):
// - FR: dentro de completedFRs[frId] → _signedById, _signedByName, _signedAt
// - IT: completedFRs._itAcks[itId] → { byId, byName, at }

export type Signer = { id: string; name: string }
export type ItAck = { byId: string; byName: string; at: string }

export const IT_ACKS_KEY = '_itAcks'
const SIGNATURE_KEYS = ['_signedById', '_signedByName', '_signedAt'] as const

type Entry = Record<string, unknown>

function content(entry: unknown): string {
  if (!entry || typeof entry !== 'object') return ''
  const rest = Object.entries(entry as Entry)
    .filter(([k]) => !k.startsWith('_'))
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(rest)
}

function stripSignature(entry: Entry): Entry {
  return Object.fromEntries(Object.entries(entry).filter(([k]) => !(SIGNATURE_KEYS as readonly string[]).includes(k)))
}

/**
 * completedFRs a gravar: FR com conteúdo novo/alterado ficam assinadas por `signer`; as que
 * não mudaram mantêm a assinatura que já tinham; _itAcks é recalculado a partir de
 * acknowledgedITs (as ITs já confirmadas mantêm quem as confirmou).
 */
export function signCompletedFRs(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
  signer: Signer,
  now: string,
  acknowledgedITs?: { prev: string[]; next: string[] }
): Record<string, unknown> | null {
  const before = (prev || {}) as Record<string, Entry>
  const out: Record<string, unknown> = {}

  for (const [frId, raw] of Object.entries(next || {})) {
    if (frId === IT_ACKS_KEY || !raw || typeof raw !== 'object') continue
    const entry = stripSignature(raw as Entry)
    const old = before[frId]
    const unchanged = old && content(old) === content(entry)
    out[frId] = unchanged
      ? { ...entry, ...Object.fromEntries(SIGNATURE_KEYS.map((k) => [k, old[k] ?? null])) }
      : { ...entry, _signedById: signer.id, _signedByName: signer.name, _signedAt: now }
  }

  const prevAcks = (before[IT_ACKS_KEY] || {}) as Record<string, ItAck>
  const ackIds = acknowledgedITs ? acknowledgedITs.next : Object.keys(prevAcks)
  const acks: Record<string, ItAck> = {}
  for (const itId of ackIds) {
    acks[itId] = prevAcks[itId] ?? { byId: signer.id, byName: signer.name, at: now }
  }
  if (Object.keys(acks).length > 0) out[IT_ACKS_KEY] = acks

  return Object.keys(out).length > 0 ? out : null
}

/** Assinatura de uma FR preenchida, para mostrar. */
export function frSignature(entry: unknown): { name: string; at: string } | null {
  const e = entry as Entry | null | undefined
  if (!e || typeof e._signedByName !== 'string') return null
  return { name: e._signedByName, at: String(e._signedAt ?? e._savedAt ?? '') }
}

/** Assinatura de uma IT confirmada, para mostrar. */
export function itSignature(completedFRs: Record<string, unknown> | null | undefined, itId: string): ItAck | null {
  const acks = (completedFRs?.[IT_ACKS_KEY] || {}) as Record<string, ItAck>
  return acks[itId] ?? null
}
