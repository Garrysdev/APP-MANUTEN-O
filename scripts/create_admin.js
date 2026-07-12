const fs = require('fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Simple dotenv parser
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2];
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[match[1]] = val;
  }
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

async function createAdmin() {
  const auth = getAuth();
  const db = getFirestore();
  
  const email = 'demo@rgmaintenance.pt';
  const password = 'Password123!';
  const name = 'Admin Demo';
  
  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      await auth.updateUser(userRecord.uid, { password });
      console.log('User password updated');
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: name,
        });
        console.log('User created');
      } else {
        throw e;
      }
    }
    
    // Check if profile exists
    const profileDoc = await db.collection('profiles').doc(userRecord.uid).get();
    if (!profileDoc.exists) {
      // Create company
      const companyRef = db.collection('companies').doc();
      await companyRef.set({
        name: 'RG Maintenance Demo',
        plan: 'enterprise',
        createdAt: new Date()
      });
      
      // Create profile
      await db.collection('profiles').doc(userRecord.uid).set({
        userId: userRecord.uid,
        companyId: companyRef.id,
        email,
        name,
        role: 'manager',
        createdAt: new Date(),
        status: 'active'
      });
      console.log('Profile created with full access!');
    } else {
       await db.collection('profiles').doc(userRecord.uid).update({
        role: 'manager'
      });
      console.log('Profile already existed, role updated to manager!');
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}
createAdmin();
