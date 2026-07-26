import { adminDb } from '../src/lib/firebase/admin'

async function check() {
  const db = adminDb()
  const usersSnap = await db.collection('users').get()
  console.log('=== LISTA COMPLETA DE UTILIZADORES ===')
  for (const doc of usersSnap.docs) {
    const u = doc.data()
    let cName = 'Sem empresa'
    if (u.companyId) {
      const cDoc = await db.collection('companies').doc(u.companyId).get()
      if (cDoc.exists) cName = cDoc.data()?.name ?? u.companyId
    }
    console.log(`UID: ${doc.id} | Email: "${u.email}" | Nome: "${u.name}" | Empresa: "${cName}" (${u.companyId})`)
  }
}

check().catch(console.error)
