import { adminDb } from '../src/lib/firebase/admin'

async function check() {
  const db = adminDb()
  const usersSnap = await db.collection('users').get()
  console.log('=== TODOS OS UTILIZADORES ===')
  usersSnap.docs.forEach(d => {
    const u = d.data()
    console.log(`ID: ${d.id} | Email: ${u.email} | Nome: ${u.name} | CompanyId: ${u.companyId}`)
  })

  const compSnap = await db.collection('companies').get()
  console.log('\n=== CONTAGEM DE DADOS POR EMPRESA ===')
  for (const cDoc of compSnap.docs) {
    const cId = cDoc.id
    const cName = cDoc.data().name
    const aSnap = await db.collection('assets').where('companyId', '==', cId).count().get()
    const pSnap = await db.collection('maintenance_plans').where('companyId', '==', cId).count().get()
    const tSnap = await db.collection('tasks').where('companyId', '==', cId).count().get()
    console.log(`Empresa: ${cName} (${cId}) -> Ativos: ${aSnap.data().count}, Planos: ${pSnap.data().count}, Tasks: ${tSnap.data().count}`)
  }
}

check().catch(console.error)
