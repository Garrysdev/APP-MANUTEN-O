const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
  }
  return { projectId, clientEmail, privateKey };
}

function getAdminApp() {
  if (getApps().length) return getApp();
  const { projectId, clientEmail, privateKey } = getServiceAccount();
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const app = getAdminApp();
const auth = getAuth(app);
const db = getFirestore(app);

const ACCOUNTS = [
  { label: 'Free',       email: 'free@teste.rg',       password: 'Teste123!', role: 'manager', plan: 'free' },
  { label: 'Starter',    email: 'starter@teste.rg',    password: 'Teste123!', role: 'manager', plan: 'starter' },
  { label: 'Pro',        email: 'pro@teste.rg',        password: 'Teste123!', role: 'manager', plan: 'pro' },
  { label: 'Business',   email: 'business@teste.rg',   password: 'Teste123!', role: 'manager', plan: 'business' },
  { label: 'Enterprise', email: 'enterprise@teste.rg', password: 'Teste123!', role: 'manager', plan: 'enterprise' },
  { label: 'Técnico',    email: 'tecnico@teste.rg',    password: 'Teste123!', role: 'technician', plan: 'pro' },
];

async function run() {
  const now = new Date().toISOString();
  let proCompanyId = null;

  for (const acc of ACCOUNTS) {
    console.log(`Processing ${acc.email}...`);
    let uid = '';
    try {
      const user = await auth.getUserByEmail(acc.email);
      uid = user.uid;
      console.log(`- User already exists in Auth: ${uid}`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const user = await auth.createUser({
          email: acc.email,
          password: acc.password,
          displayName: acc.label,
        });
        uid = user.uid;
        console.log(`- Created user in Auth: ${uid}`);
      } else {
        throw err;
      }
    }

    const userDocRef = db.collection('users').doc(uid);
    const userSnap = await userDocRef.get();

    if (acc.role === 'manager') {
      if (!userSnap.exists) {
        const companyRef = db.collection('companies').doc();
        await companyRef.set({
          name: `Empresa ${acc.label}`,
          slug: `empresa-${acc.label.toLowerCase()}`,
          plan: acc.plan,
          maxTechnicians: 10,
          createdAt: now,
        });
        
        await userDocRef.set({
          companyId: companyRef.id,
          email: acc.email,
          name: acc.label,
          role: 'manager',
          active: true,
          createdAt: now,
        });
        console.log(`- Created Company & Manager profile.`);
        
        if (acc.plan === 'pro') {
          proCompanyId = companyRef.id;
        }
      } else {
        const userData = userSnap.data();
        await db.collection('companies').doc(userData.companyId).update({ plan: acc.plan });
        console.log(`- Updated existing company to plan ${acc.plan}.`);
        if (acc.plan === 'pro') {
          proCompanyId = userData.companyId;
        }
      }
    } else if (acc.role === 'technician') {
      if (!userSnap.exists) {
        if (!proCompanyId) {
           const proUserSnap = await auth.getUserByEmail('pro@teste.rg');
           const pUserDoc = await db.collection('users').doc(proUserSnap.uid).get();
           proCompanyId = pUserDoc.data().companyId;
        }

        await userDocRef.set({
          companyId: proCompanyId,
          email: acc.email,
          name: acc.label,
          role: 'technician',
          active: true,
          createdAt: now,
        });
        console.log(`- Created Technician profile attached to Pro Company.`);
      } else {
        console.log(`- Technician profile already exists.`);
      }
    }
  }

  console.log('Done!');
  process.exit(0);
}

run().catch(console.error);
