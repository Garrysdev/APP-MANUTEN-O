/**
 * Seed script — cria utilizadores de teste no Firebase.
 * Executar: node --env-file=.env.local scripts/seed-test.mjs
 *
 * Contas criadas:
 *   rgb@teste.rg  — gestor, plano Business  (empresa "RG Business Test")
 *   rgp@teste.rg  — gestor, plano Pro       (empresa "RG Pro Test")
 *   tc@teste.rg   — técnico                 (empresa de RGB)
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// ── Init ────────────────────────────────────────────────────────────────────
const projectId    = process.env.FIREBASE_PROJECT_ID
const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL
const privateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌  Variáveis FIREBASE_* em falta. Executa com --env-file=.env.local')
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

const auth = getAuth()
const db   = getFirestore()

// ── Helpers ─────────────────────────────────────────────────────────────────
async function upsertAuthUser(email, password, displayName) {
  try {
    const existing = await auth.getUserByEmail(email)
    await auth.updateUser(existing.uid, { password, displayName })
    console.log(`  ↻  Auth já existe: ${email} — password actualizada`)
    return existing.uid
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err
    const u = await auth.createUser({ email, password, displayName })
    console.log(`  ✓  Auth criado: ${email}  uid=${u.uid}`)
    return u.uid
  }
}

async function upsertCompany(id, name, plan) {
  const ref = db.collection('companies').doc(id)
  const doc = await ref.get()
  if (doc.exists) {
    console.log(`  ↻  Empresa já existe: ${name}`)
  } else {
    await ref.set({ name, plan, createdAt: new Date().toISOString() })
    console.log(`  ✓  Empresa criada: ${name}  id=${id}`)
  }
  return id
}

async function upsertUserDoc(uid, { name, email, role, companyId }) {
  const ref = db.collection('users').doc(uid)
  const doc = await ref.get()
  if (doc.exists) {
    await ref.update({ name, email, role, companyId, updatedAt: new Date().toISOString() })
    console.log(`  ↻  Firestore user actualizado: ${email}`)
  } else {
    await ref.set({
      name, email, role, companyId,
      active: true,
      createdAt: new Date().toISOString(),
    })
    console.log(`  ✓  Firestore user criado: ${email}`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const PASS = 'Teste123!'

console.log('\n🌱  Seed de utilizadores de teste\n')

// ── Empresa Business (RGB)
const bizId = 'company-rgb-business'
await upsertCompany(bizId, 'RG Business Test', 'business')

const rgbUid = await upsertAuthUser('rgb@teste.rg', PASS, 'RGB Gestor')
await upsertUserDoc(rgbUid, {
  name: 'RGB Gestor',
  email: 'rgb@teste.rg',
  role: 'manager',
  companyId: bizId,
})

// ── Técnico TC (mesma empresa que RGB)
const tcUid = await upsertAuthUser('tc@teste.rg', PASS, 'TC Técnico')
await upsertUserDoc(tcUid, {
  name: 'TC Técnico',
  email: 'tc@teste.rg',
  role: 'technician',
  companyId: bizId,
})

// ── Empresa Pro (RGP)
const proId = 'company-rgp-pro'
await upsertCompany(proId, 'RG Pro Test', 'pro')

const rgpUid = await upsertAuthUser('rgp@teste.rg', PASS, 'RGP Gestor')
await upsertUserDoc(rgpUid, {
  name: 'RGP Gestor',
  email: 'rgp@teste.rg',
  role: 'manager',
  companyId: proId,
})

console.log('\n✅  Seed concluído!\n')
console.log('  Contas criadas (password: Teste123!)')
console.log('  rgb@teste.rg  — Gestor · Business')
console.log('  rgp@teste.rg  — Gestor · Pro')
console.log('  tc@teste.rg   — Técnico · Business\n')
