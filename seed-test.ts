import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from './src/lib/firebase/admin'

// Loads .env or .env.local


const db = adminDb()
const auth = adminAuth()

const ACCOUNTS = [
  { label: 'Free',       email: 'free@teste.rg',       password: 'Teste123!', role: 'manager', plan: 'free' },
  { label: 'Starter',    email: 'starter@teste.rg',    password: 'Teste123!', role: 'manager', plan: 'starter' },
  { label: 'Pro',        email: 'pro@teste.rg',        password: 'Teste123!', role: 'manager', plan: 'pro' },
  { label: 'Business',   email: 'business@teste.rg',   password: 'Teste123!', role: 'manager', plan: 'business' },
  { label: 'Enterprise', email: 'enterprise@teste.rg', password: 'Teste123!', role: 'manager', plan: 'enterprise' },
  { label: 'Técnico',    email: 'tecnico@teste.rg',    password: 'Teste123!', role: 'technician', plan: 'pro' },
]

async function run() {
  const now = new Date().toISOString()
  let proCompanyId = null;

  for (const acc of ACCOUNTS) {
    console.log(`Processing ${acc.email}...`)
    let uid = ''
    try {
      const user = await auth.getUserByEmail(acc.email)
      uid = user.uid
      console.log(`- User already exists in Auth: ${uid}`)
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        const user = await auth.createUser({
          email: acc.email,
          password: acc.password,
          displayName: acc.label,
        })
        uid = user.uid
        console.log(`- Created user in Auth: ${uid}`)
      } else {
        throw err
      }
    }

    // Handle Firestore
    const userDocRef = db.collection('users').doc(uid)
    const userSnap = await userDocRef.get()

    if (acc.role === 'manager') {
      if (!userSnap.exists) {
        const companyRef = db.collection('companies').doc()
        await companyRef.set({
          name: `Empresa ${acc.label}`,
          slug: `empresa-${acc.label.toLowerCase()}`,
          plan: acc.plan,
          maxTechnicians: 10,
          createdAt: now,
        })
        
        await userDocRef.set({
          companyId: companyRef.id,
          email: acc.email,
          name: acc.label,
          role: 'manager',
          active: true,
          createdAt: now,
        })
        console.log(`- Created Company & Manager profile.`)
        
        if (acc.plan === 'pro') {
          proCompanyId = companyRef.id
        }
      } else {
        const userData = userSnap.data()
        await db.collection('companies').doc(userData!.companyId).update({ plan: acc.plan })
        console.log(`- Updated existing company to plan ${acc.plan}.`)
        if (acc.plan === 'pro') {
          proCompanyId = userData!.companyId
        }
      }
    } else if (acc.role === 'technician') {
      if (!userSnap.exists) {
        if (!proCompanyId) {
           // We need to fetch the pro company if it wasn't created in this run
           const proUserSnap = await auth.getUserByEmail('pro@teste.rg')
           const pUserDoc = await db.collection('users').doc(proUserSnap.uid).get()
           proCompanyId = pUserDoc.data()?.companyId
        }

        await userDocRef.set({
          companyId: proCompanyId,
          email: acc.email,
          name: acc.label,
          role: 'technician',
          active: true,
          createdAt: now,
        })
        console.log(`- Created Technician profile attached to Pro Company.`)
      } else {
        console.log(`- Technician profile already exists.`)
      }
    }
  }

  console.log('Done!')
  process.exit(0)
}

run().catch(console.error)
