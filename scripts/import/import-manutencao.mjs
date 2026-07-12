/**
 * Importador do cadastro + plano de manutencao para o Firestore.
 *
 * Le os JSON gerados por parse-manutencao.py (assets.json + plans.json) e escreve
 * nas coleccoes `assets` e `maintenance_plans`, ligando cada plano ao equipamento
 * pela TAG. IDs deterministicos -> idempotente (re-correr nao duplica).
 *
 * Uso:
 *   node --env-file=.env.local scripts/import/import-manutencao.mjs                 # dry-run + lista empresas
 *   node --env-file=.env.local scripts/import/import-manutencao.mjs --company=<id>  # dry-run para essa empresa
 *   node --env-file=.env.local scripts/import/import-manutencao.mjs --company=<id> --commit   # ESCREVE
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const COMMIT = args.includes('--commit')
const WIPE = args.includes('--wipe')
const companyArg = args.find((a) => a.startsWith('--company='))
const COMPANY_ID = companyArg ? companyArg.split('=')[1] : null

// ── Init firebase-admin (mesmo padrao do seed-test.mjs) ───────────────────────
const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Variaveis FIREBASE_* em falta. Corre com --env-file=.env.local')
  process.exit(1)
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

// ── Helpers ───────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString()
const slug = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'x'

// periodicidade -> motor de recorrencia (espelha models.ts: periodicidadeToRecurrence)
const RECUR = {
  semanal: ['weekly', 1], mensal: ['monthly', 1], trimestral: ['quarterly', 1],
  bianual: ['monthly', 6], anual: ['annual', 1], bienal: ['annual', 2],
  trianual: ['annual', 3], horas: ['monthly', 1], pontual: ['annual', 1],
}

const shortHash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8)

function assetDocId(companyId, a) {
  // hash de (area|tag|name) garante unicidade — o parser ja deduplica por esta combinacao.
  const h = shortHash(`${a.area ?? ''}|${a.tag ?? ''}|${a.name ?? ''}`)
  return `${companyId}__a-${slug(a.tag || a.name)}-${h}`
}
function planDocId(companyId, p, idx) {
  return `${companyId}__p-${slug(p.tag)}-${slug(p.title).slice(0, 24)}-${idx}`
}

async function listCompanies() {
  const snap = await db.collection('companies').get()
  return snap.docs.map((d) => ({ id: d.id, name: d.data().name }))
}

async function wipeCompany(companyId, collection) {
  let total = 0
  while (true) {
    const snap = await db.collection(collection).where('companyId', '==', companyId).limit(450).get()
    if (snap.empty) break
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    total += snap.size
    process.stdout.write(`\r  ${collection}: apagados ${total}`)
  }
  if (total) process.stdout.write('\n')
  return total
}

async function commitBatched(ops) {
  // Firestore: max 500 escritas/batch
  let written = 0
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch()
    for (const { ref, data } of ops.slice(i, i + 450)) batch.set(ref, data, { merge: true })
    await batch.commit()
    written += Math.min(450, ops.length - i)
    process.stdout.write(`\r  escritas: ${written}/${ops.length}`)
  }
  if (ops.length) process.stdout.write('\n')
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const assets = JSON.parse(readFileSync(join(HERE, 'assets.json'), 'utf-8'))
  const plans = JSON.parse(readFileSync(join(HERE, 'plans.json'), 'utf-8'))

  if (!COMPANY_ID) {
    const companies = await listCompanies()
    console.log('Dados a importar: %d equipamentos + %d planos.', assets.length, plans.length)
    console.log('\nFalta --company=<id>. Empresas disponiveis:')
    companies.forEach((c) => console.log(`  ${c.id}  →  ${c.name}`))
    console.log('\nEx.: node --env-file=.env.local scripts/import/import-manutencao.mjs --company=<id> [--commit]')
    return
  }

  // mapa TAG -> assetId
  const tagToAsset = new Map()
  const assetOps = assets.map((a) => {
    const id = assetDocId(COMPANY_ID, a)
    if (a.tag && !tagToAsset.has(a.tag)) tagToAsset.set(a.tag, id) // 1.ª ocorrencia = canonica
    return {
      ref: db.collection('assets').doc(id),
      data: {
        companyId: COMPANY_ID, name: a.name, area: a.area ?? null, tag: a.tag ?? null,
        system: a.system ?? null, manufacturer: a.manufacturer ?? null,
        characteristics: a.characteristics ?? null, notes: a.notes ?? null,
        criticidadeABC: a.criticidadeABC ?? null, tags: a.tag ? [a.tag] : null,
        location: a.area ?? null, active: true, createdAt: now(),
      },
    }
  })

  let orphans = 0
  const planOps = plans.map((p, i) => {
    const [recurrence, recurrenceValue] = RECUR[p.periodicidade] ?? ['monthly', 1]
    const assetId = tagToAsset.get(p.tag) ?? null
    if (!assetId) orphans++
    return {
      ref: db.collection('maintenance_plans').doc(planDocId(COMPANY_ID, p, i)),
      data: {
        companyId: COMPANY_ID, title: p.title, description: p.equipamento ?? null,
        assetId, assignedTo: null, criticidade: p.criticidade, tipo: 'plano',
        recurrence, recurrenceValue,
        periodicidade: p.periodicidade, periodicidadeLabel: p.periodicidadeLabel ?? null,
        executor: p.executor ?? 'interno', legal: !!p.legal, months: p.months ?? null,
        tag: p.tag ?? null, area: p.area ?? null, system: p.system ?? null,
        safetyRules: null, active: true, createdBy: 'import-script',
        createdAt: now(), updatedAt: now(),
      },
    }
  })

  console.log('Empresa alvo: %s', COMPANY_ID)
  console.log('Equipamentos: %d  | Planos: %d  (orfaos sem equipamento: %d)', assetOps.length, planOps.length, orphans)

  if (!COMMIT) {
    console.log('\n[DRY-RUN] nada foi escrito. Adiciona --commit para gravar no Firestore.')
    return
  }
  if (WIPE) {
    console.log('\n→ A limpar dados existentes da empresa (--wipe)…')
    await wipeCompany(COMPANY_ID, 'maintenance_plans')
    await wipeCompany(COMPANY_ID, 'assets')
  }
  console.log('\n→ A escrever equipamentos…')
  await commitBatched(assetOps)
  console.log('→ A escrever planos…')
  await commitBatched(planOps)
  console.log('✓ Importacao concluida.')
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
