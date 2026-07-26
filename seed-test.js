const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// ── CARREGAR .ENV.LOCAL EM NODE.JS ──────────────────────────────────────────
try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').replace(/\r/g, '').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.error('Erro ao ler .env.local', e);
}

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltam variáveis FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY no .env.local');
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
  { label: 'Técnico',    email: 'tecnico@teste.rg',    password: 'Teste123!', role: 'technician', plan: 'pro' }, // Ligado ao plano Pro
];

// Helper para limpar documentos de uma coleção associados a uma empresa
async function clearCompanyData(collectionName, companyId) {
  const snap = await db.collection(collectionName).where('companyId', '==', companyId).get();
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function run() {
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  let proCompanyId = null;

  // 1. Criar ou Atualizar as Contas de Autenticação e Empresas
  const resolvedAccounts = [];
  for (const acc of ACCOUNTS) {
    console.log(`A processar conta: ${acc.email}...`);
    let uid = '';
    try {
      const user = await auth.getUserByEmail(acc.email);
      uid = user.uid;
      console.log(`- Utilizador já existe no Auth: ${uid}`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const user = await auth.createUser({
          email: acc.email,
          password: acc.password,
          displayName: acc.label,
        });
        uid = user.uid;
        console.log(`- Criado utilizador no Auth: ${uid}`);
      } else {
        throw err;
      }
    }

    const userDocRef = db.collection('users').doc(uid);
    const userSnap = await userDocRef.get();
    let companyId = '';

    if (acc.role === 'manager') {
      if (!userSnap.exists) {
        const companyRef = db.collection('companies').doc();
        companyId = companyRef.id;
        await companyRef.set({
          name: `Empresa ${acc.label}`,
          slug: `empresa-${acc.label.toLowerCase()}`,
          plan: acc.plan,
          maxTechnicians: 10,
          aiCredits: acc.plan === 'business' ? 100 : acc.plan === 'enterprise' ? 500 : 0,
          activeModules: acc.plan === 'free' ? [] :
                         acc.plan === 'starter' ? ['assets', 'stocks', 'calendar', 'reports'] :
                         acc.plan === 'pro' ? ['assets', 'stocks', 'calendar', 'reports', 'history', 'users', 'maintenance-plan', 'reliability'] :
                         acc.plan === 'business' ? ['assets', 'stocks', 'calendar', 'reports', 'history', 'users', 'maintenance-plan', 'reliability', 'finance', 'ai-consultant'] :
                         ['assets', 'stocks', 'calendar', 'reports', 'history', 'users', 'maintenance-plan', 'reliability', 'finance', 'ai-consultant', 'compliance'],
          createdAt: now,
        });
        
        await userDocRef.set({
          companyId,
          email: acc.email,
          name: `Gestor ${acc.label}`,
          role: 'manager',
          active: true,
          createdAt: now,
        });
        console.log(`- Criado Perfil de Gestor & Empresa.`);
      } else {
        const userData = userSnap.data();
        companyId = userData.companyId;
        await db.collection('companies').doc(companyId).update({
          plan: acc.plan,
          aiCredits: acc.plan === 'business' ? 100 : acc.plan === 'enterprise' ? 500 : 0,
          activeModules: acc.plan === 'free' ? [] :
                         acc.plan === 'starter' ? ['assets', 'stocks', 'calendar', 'reports'] :
                         acc.plan === 'pro' ? ['assets', 'stocks', 'calendar', 'reports', 'history', 'users', 'maintenance-plan', 'reliability'] :
                         acc.plan === 'business' ? ['assets', 'stocks', 'calendar', 'reports', 'history', 'users', 'maintenance-plan', 'reliability', 'finance', 'ai-consultant'] :
                         ['assets', 'stocks', 'calendar', 'reports', 'history', 'users', 'maintenance-plan', 'reliability', 'finance', 'ai-consultant', 'compliance'],
        });
        console.log(`- Empresa existente atualizada para o plano ${acc.plan}.`);
      }
      if (acc.plan === 'pro') {
        proCompanyId = companyId;
      }
    }

    resolvedAccounts.push({ ...acc, uid, companyId });
  }

  // 2. Ligar o Técnico à Empresa Pro
  const techAcc = resolvedAccounts.find(a => a.role === 'technician');
  if (techAcc) {
    if (!proCompanyId) {
      // Obter id da empresa pro a partir do gestor pro
      const proGestorAcc = resolvedAccounts.find(a => a.email === 'pro@teste.rg');
      proCompanyId = proGestorAcc.companyId;
    }
    techAcc.companyId = proCompanyId;
    const userDocRef = db.collection('users').doc(techAcc.uid);
    await userDocRef.set({
      companyId: proCompanyId,
      email: techAcc.email,
      name: 'Técnico Pro',
      role: 'technician',
      active: true,
      hourlyRate: 18, // 18€ por hora para demonstração de custos no Pro
      createdAt: now,
    }, { merge: true });
    console.log(`- Perfil de Técnico associado à Empresa Pro.`);
  }

  // 3. Limpar e Popular Dados Específicos por Empresa
  for (const acc of resolvedAccounts) {
    if (acc.role === 'technician') continue; // Os dados do técnico vivem na empresa Pro

    const cid = acc.companyId;
    console.log(`\nLimpando dados antigos para a empresa ${acc.label} (${cid})...`);
    await clearCompanyData('assets', cid);
    await clearCompanyData('tasks', cid);
    await clearCompanyData('interventions', cid);
    await clearCompanyData('materials', cid);
    await clearCompanyData('stock_items', cid);
    await clearCompanyData('stock_movements', cid);
    await clearCompanyData('maintenance_plans', cid);

    console.log(`Semeando dados para a empresa ${acc.label}...`);

    if (acc.plan === 'free') {
      // ── MOCK DATA: FREE ──
      // Criar 2 equipamentos (para que falte exatamente 1 para atingir o novo limite de 3)
      const a1 = await db.collection('assets').add({
        companyId: cid, name: 'Bomba de Água Principal', tag: 'BAP-01', location: 'Sala de Máquinas', type: 'Fluídos', active: true, createdAt: now
      });
      const a2 = await db.collection('assets').add({
        companyId: cid, name: 'Ar Condicionado Escritório', tag: 'AC-ESC-02', location: 'Escritório Geral', type: 'Climatização', active: true, createdAt: now
      });

      // Criar 3 OTs
      await db.collection('tasks').add({
        companyId: cid, title: 'Inspeção de fuga de óleo', description: 'Verificar junta da bomba principal e limpar vestígios.',
        assetId: a1.id, assignedTo: acc.uid, criticidade: 'amarelo', tipo: 'inspecao', status: 'in_progress', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
      await db.collection('tasks').add({
        companyId: cid, title: 'Ruído anormal no AC', description: 'AC faz ruído metálico ao arrancar. Verificar rolamento da ventoinha.',
        assetId: a2.id, assignedTo: null, criticidade: 'verde', tipo: 'curativa', status: 'pending', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
      await db.collection('tasks').add({
        companyId: cid, title: 'Limpeza do filtro do compressor', description: 'Limpar filtros conforme plano de manutenção básica.',
        assetId: a1.id, assignedTo: null, criticidade: 'verde', tipo: 'preventiva', status: 'pending', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
    }

    else if (acc.plan === 'starter') {
      // ── MOCK DATA: STARTER ──
      const a1 = await db.collection('assets').add({ companyId: cid, name: 'Torno Mecânico', tag: 'TM-01', location: 'Oficina Metal', type: 'Produção', active: true, createdAt: now });
      const a2 = await db.collection('assets').add({ companyId: cid, name: 'Prensa Hidráulica', tag: 'PH-02', location: 'Linha A', type: 'Produção', active: true, createdAt: now });

      // 3 Stock items
      await db.collection('stock_items').add({ companyId: cid, name: 'Óleo Lubrificante H4', quantity: 20, unit: 'L', unitCost: 5.5, minQuantity: 5, location: 'Prateleira A', createdAt: now, updatedAt: now });
      await db.collection('stock_items').add({ companyId: cid, name: 'Filtro Torno TM', quantity: 8, unit: 'un', unitCost: 12.0, minQuantity: 2, location: 'Gaveta B1', createdAt: now, updatedAt: now });

      // 3 OTs
      await db.collection('tasks').add({
        companyId: cid, title: 'Lubrificação das guias do torno', description: 'Aplicar óleo lubrificante H4 nas guias lineares.',
        assetId: a1.id, assignedTo: acc.uid, criticidade: 'verde', tipo: 'lubrificacao', status: 'pending', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
      await db.collection('tasks').add({
        companyId: cid, title: 'Fuga de óleo na prensa', description: 'Fuga na mangueira de alta pressão da prensa hidráulica.',
        assetId: a2.id, assignedTo: null, criticidade: 'vermelho', tipo: 'curativa', status: 'pending', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
    }

    else if (acc.plan === 'pro') {
      // ── MOCK DATA: PRO ──
      const tech = resolvedAccounts.find(a => a.role === 'technician');

      const a1 = await db.collection('assets').add({ companyId: cid, name: 'Compressor Central Atlas', tag: 'COMP-ATL-01', location: 'Central de Ar', type: 'Utilitários', active: true, createdAt: now });
      const a2 = await db.collection('assets').add({ companyId: cid, name: 'Gerador de Emergência', tag: 'GER-EM-02', location: 'Exterior', type: 'Energia', active: true, createdAt: now });

      // Stock
      const stock1 = await db.collection('stock_items').add({ companyId: cid, name: 'Filtro de Ar Compressor', quantity: 5, unit: 'un', unitCost: 25.0, minQuantity: 1, location: 'Armazém Geral', createdAt: now, updatedAt: now });

      // OTs normais
      await db.collection('tasks').add({
        companyId: cid, title: 'Revisão geral do compressor', description: 'Mudar óleo e substituir filtros de ar.',
        assetId: a1.id, assignedTo: tech.uid, criticidade: 'vermelho', tipo: 'preventiva', status: 'in_progress', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });

      // OTs concluídas pelo técnico para popular o Histórico
      const taskDone1 = await db.collection('tasks').add({
        companyId: cid, title: 'Verificação mensal do gerador', description: 'Verificar nível de gasóleo e bateria.',
        assetId: a2.id, assignedTo: tech.uid, criticidade: 'amarelo', tipo: 'preventiva', status: 'done', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
      const iv1 = await db.collection('interventions').add({
        companyId: cid, taskId: taskDone1.id, technicianId: tech.uid, startedAt: now, endedAt: now, observations: 'Bateria OK. Nível de combustível a 80%. Teste de arranque efetuado com sucesso.', checklist: [{label: 'Verificar bateria', done: true}, {label: 'Verificar combustível', done: true}], createdAt: now
      });

      // Planos de manutenção
      await db.collection('maintenance_plans').add({
        companyId: cid, title: 'Inspeção mecânica semestral', description: 'Revisão estrutural e aperto de parafusos.',
        assetId: a1.id, assignedTo: tech.uid, criticidade: 'verde', tipo: 'inspecao', recurrence: 'monthly', recurrenceValue: 6, active: true, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
    }

    else if (acc.plan === 'business') {
      // ── MOCK DATA: BUSINESS ──
      const a1 = await db.collection('assets').add({ companyId: cid, name: 'Robô de Soldadura Fanuc', tag: 'ROB-SOLD-01', location: 'Célula 3', type: 'Robótica', active: true, createdAt: now });
      
      const stock1 = await db.collection('stock_items').add({ companyId: cid, name: 'Ponteira de Cobre Soldar', quantity: 50, unit: 'un', unitCost: 4.5, minQuantity: 10, location: 'Gaveta R2', createdAt: now, updatedAt: now });

      // Criar OTs concluídas com custos reais de mão de obra + materiais aplicados
      const taskCost = await db.collection('tasks').add({
        companyId: cid, title: 'Substituição de ponteiras de solda', description: 'Substituir ponteiras desgastadas por novas.',
        assetId: a1.id, assignedTo: acc.uid, criticidade: 'amarelo', tipo: 'preventiva', status: 'done', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
      const iv = await db.collection('interventions').add({
        companyId: cid, taskId: taskCost.id, technicianId: acc.uid, startedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), endedAt: now, observations: 'Substituídas 4 ponteiras.', checklist: [], createdAt: now
      });
      await db.collection('materials').add({
        companyId: cid, interventionId: iv.id, name: 'Ponteira de Cobre Soldar', reference: 'P-COP-01', quantity: 4, unit: 'un', unitCost: 4.5, createdAt: now
      });
      
      // Calcular e atualizar os custos da OT (2h de mão de obra de gestor a 25€/h + 4 ponteiras a 4.5€)
      await db.collection('users').doc(acc.uid).update({ hourlyRate: 25 });
      const totalCost = (2 * 25) + (4 * 4.5);
      await db.collection('tasks').doc(taskCost.id).update({ totalCost });
    }

    else if (acc.plan === 'enterprise') {
      // ── MOCK DATA: ENTERPRISE ──
      const a1 = await db.collection('assets').add({ companyId: cid, name: 'Autoclave Farmacêutica', tag: 'AUTO-PH-01', location: 'Sala Estéril', type: 'Processo', active: true, createdAt: now });

      await db.collection('tasks').add({
        companyId: cid, title: 'Calibração anual do sensor de pressão', description: 'Requer certificado de calibração externa em conformidade.',
        assetId: a1.id, assignedTo: acc.uid, criticidade: 'vermelho', tipo: 'calibracao', status: 'pending', dueDate: todayStr, createdBy: acc.uid, createdAt: now, updatedAt: now
      });
    }
  }

  console.log('\n🎉 SEMENTES CRIADAS COM SUCESSO!');
  process.exit(0);
}

run().catch(console.error);
