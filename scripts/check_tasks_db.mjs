import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const companyId = 'rjHNaSUbLm4qTMyKP0oX';

async function checkTasks() {
  const snap = await db.collection('tasks').where('companyId', '==', companyId).get();
  console.log(`Total tasks in Firestore for company: ${snap.size}`);
  
  let urCount = 0;
  let doneCount = 0;
  let pendingCount = 0;
  let inProgressCount = 0;
  let pmCount = 0;

  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.source === 'folha_ur_historico' || doc.id.includes('t-ur-') || data.source === 'excel_ur') urCount++;
    if (data.source === 'pm_agendamento_2026' || (data.title && (data.title.startsWith('[PM]') || data.title.startsWith('[MP]')))) pmCount++;
    if (data.status === 'done') doneCount++;
    if (data.status === 'pending') pendingCount++;
    if (data.status === 'in_progress') inProgressCount++;
  });

  console.log(`UR Tasks: ${urCount}`);
  console.log(`PM Tasks: ${pmCount}`);
  console.log(`Status done: ${doneCount}`);
  console.log(`Status pending: ${pendingCount}`);
  console.log(`Status in_progress: ${inProgressCount}`);

  // Sample of first 5 tasks:
  console.log('--- Sample 5 tasks ---');
  snap.docs.slice(0, 5).forEach(d => {
    const dt = d.data();
    console.log(`ID: ${d.id} | Status: ${dt.status} | Source: ${dt.source} | Title: ${dt.title?.slice(0, 40)}`);
  });
}

checkTasks().catch(console.error);
