/**
 * Importador Completo dos Dados Reais da Empresa UR para o Firestore.
 *
 * Importa:
 * 1. Planos de Manutenção Preventiva (do Ficheiro 1: PL-MAN-01 -> maintenance_plans)
 * 2. Equipamentos / Cadastro (do Ficheiro 2: CADASTRO_UR -> assets)
 * 3. Histórico de OTs por Equipamento (do Ficheiro 2: UR -> tasks)
 * 4. OTs de Projetos / Paragens (do Ficheiro 2: PROJECTOS_UR -> tasks)
 *
 * Executar:
 *   node --env-file=.env.local scripts/import/import-complete-real-data.mjs --commit
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
const COMPANY_ID = 'rjHNaSUbLm4qTMyKP0oX' // Empresa "UR"

// Init Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Variáveis FIREBASE_* em falta no .env.local')
  process.exit(1)
}

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const now = () => new Date().toISOString()
const shortHash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8)
const slug = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'x'

const RECUR = {
  semanal: ['weekly', 1], mensal: ['monthly', 1], trimestral: ['quarterly', 1],
  bianual: ['monthly', 6], anual: ['annual', 1], bienal: ['annual', 2],
  trianual: ['annual', 3], horas: ['monthly', 1], pontual: ['annual', 1],
}

const CAT_TO_CRIT = { A: 'urgente', B: 'alta', C: 'media' }

async function commitBatched(ops) {
  let written = 0
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch()
    for (const { ref, data } of ops.slice(i, i + 400)) {
      batch.set(ref, data, { merge: true })
    }
    await batch.commit()
    written += Math.min(400, ops.length - i)
    process.stdout.write(`\r  Processados: ${written}/${ops.length}`)
  }
  if (ops.length) process.stdout.write('\n')
}

async function main() {
  console.log('=== IMPORTAÇÃO COMPLETA DE DADOS DA EMPRESA UR ===')
  console.log('Empresa ID:', COMPANY_ID)

  // 0. Atualizar plano da empresa para Enterprise para desbloquear todos os módulos
  await db.collection('companies').doc(COMPANY_ID).set({
    name: 'UR - Manutenção Industrial',
    plan: 'enterprise',
    maxTechnicians: 100,
    active: true,
    updatedAt: now(),
  }, { merge: true })
  console.log('✓ Empresa configurada com plano Enterprise.')

  // Carregar JSONs gerados pelo parser
  const assets = JSON.parse(readFileSync(join(HERE, 'assets.json'), 'utf-8'))
  const plans = JSON.parse(readFileSync(join(HERE, 'plans.json'), 'utf-8'))
  const tasksUr = JSON.parse(readFileSync(join(HERE, 'tasks_ur.json'), 'utf-8'))
  const tasksProj = JSON.parse(readFileSync(join(HERE, 'tasks_projects.json'), 'utf-8'))

  // 1. Mapeamento de Equipamentos (assets)
  const tagToAssetId = new Map()
  const assetOps = assets.map((a) => {
    const hash = shortHash(`${a.area ?? ''}|${a.tag ?? ''}|${a.name ?? ''}`)
    const id = `${COMPANY_ID}__a-${slug(a.tag || a.name)}-${hash}`
    if (a.tag && !tagToAssetId.has(a.tag.trim())) {
      tagToAssetId.set(a.tag.trim(), id)
    }
    return {
      ref: db.collection('assets').doc(id),
      data: {
        companyId: COMPANY_ID,
        name: a.name,
        area: a.area ?? null,
        tag: a.tag ?? null,
        system: a.system ?? null,
        manufacturer: a.manufacturer ?? null,
        characteristics: a.characteristics ?? null,
        notes: a.notes ?? null,
        criticidadeABC: a.criticidadeABC ?? null,
        location: a.area ? `Área ${a.area}` : 'Instalação Principal',
        active: true,
        createdAt: now(),
        updatedAt: now(),
      },
    }
  })

  // 2. Mapeamento de Planos de Manutenção (maintenance_plans)
  let planOrphans = 0
  const planOps = plans.map((p, i) => {
    const [recurrence, recurrenceValue] = RECUR[p.periodicidade] ?? ['monthly', 1]
    const assetId = p.tag ? (tagToAssetId.get(p.tag.trim()) ?? null) : null
    if (!assetId) planOrphans++
    const id = `${COMPANY_ID}__p-${slug(p.tag)}-${slug(p.title).slice(0, 24)}-${i}`

    return {
      ref: db.collection('maintenance_plans').doc(id),
      data: {
        companyId: COMPANY_ID,
        title: p.title,
        description: p.equipamento ? `Equipamento: ${p.equipamento}` : null,
        assetId,
        criticidade: p.criticidade || 'media',
        tipo: 'plano',
        recurrence,
        recurrenceValue,
        periodicidade: p.periodicidade,
        periodicidadeLabel: p.periodicidadeLabel ?? null,
        executor: p.executor ?? 'interno',
        legal: !!p.legal,
        months: p.months ?? null,
        tag: p.tag ?? null,
        area: p.area ?? null,
        system: p.system ?? null,
        active: true,
        createdBy: 'sistema-importacao',
        createdAt: now(),
        updatedAt: now(),
      },
    }
  })

  // 3. Mapeamento do Histórico de OTs por Equipamento (tasks de UR)
  let taskOrphans = 0
  const taskUrOps = tasksUr.map((t, i) => {
    const assetId = t.tag ? (tagToAssetId.get(t.tag.trim()) ?? null) : null
    if (!assetId) taskOrphans++
    const id = `${COMPANY_ID}__t-ur-${t.sourceId || i}-${slug(t.tag || 'ot')}`

    // Mapeamento de estado para histórico: se rawStatus for concluído ou vazio com ID antigo, colocar done
    let status = t.status || 'pending'
    if (!t.rawStatus && t.sourceId && parseInt(t.sourceId) < 240000) {
      status = 'done'
    } else if (t.rawStatus && t.rawStatus.toUpperCase().includes('CONCLU')) {
      status = 'done'
    }

    return {
      ref: db.collection('tasks').doc(id),
      data: {
        companyId: COMPANY_ID,
        title: t.title,
        description: `OT de Origem: #${t.sourceId || 'S/N'} | Técnicos: ${t.technicians || 'N/D'}`,
        assetId,
        tipo: t.tipo || 'curativa',
        criticidade: 'media',
        status,
        tag: t.tag ?? null,
        area: t.area ?? null,
        source: 'folha_ur_historico',
        createdAt: now(),
        updatedAt: now(),
        ...(status === 'done' ? { endedAt: now() } : {}),
      },
    }
  })

  // 4. Mapeamento de Projetos e Trabalhos de Paragem (tasks de PROJECTOS_UR)
  const taskProjOps = tasksProj.map((p, i) => {
    const assetId = p.tag ? (tagToAssetId.get(p.tag.trim()) ?? null) : null
    const id = `${COMPANY_ID}__t-proj-${i}-${slug(p.tag || 'proj')}`

    return {
      ref: db.collection('tasks').doc(id),
      data: {
        companyId: COMPANY_ID,
        title: `[${p.section || 'PROJETO'}] ${p.title}`,
        description: `Seção: ${p.section || 'Projetos'} | Técnicos: ${p.technicians || 'N/D'}`,
        assetId,
        tipo: p.tipo || 'melhoria',
        criticidade: p.section && p.section.includes('URGENTE') ? 'urgente' : 'alta',
        status: 'pending',
        tag: p.tag ?? null,
        area: p.area ?? null,
        source: 'folha_projectos_ur',
        createdAt: now(),
        updatedAt: now(),
      },
    }
  })

  console.log(`\nResumo dos Dados Preparados:`)
  console.log(`- Equipamentos (CADASTRO_UR) : ${assetOps.length}`)
  console.log(`- Planos de Manutenção (PM) : ${planOps.length} (Órfãos sem equipamento: ${planOrphans})`)
  console.log(`- Histórico de OTs (UR)      : ${taskUrOps.length} (Órfãos sem equipamento: ${taskOrphans})`)
  console.log(`- Projetos e Paragens       : ${taskProjOps.length}`)

  if (!COMMIT) {
    console.log('\n[DRY-RUN] Nenhuma alteração gravada. Executa com --commit para gravar no Firestore.')
    return
  }

  console.log('\n→ A gravar Equipamentos (Assets)...')
  await commitBatched(assetOps)

  console.log('→ A gravar Planos de Manutenção (Maintenance Plans)...')
  await commitBatched(planOps)

  console.log('→ A gravar Histórico de OTs (Tasks)...')
  await commitBatched(taskUrOps)

  console.log('→ A gravar Projetos e Trabalhos de Paragem (Tasks)...')
  await commitBatched(taskProjOps)

  console.log('\n✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO PARA A EMPRESA UR!')
}

main().catch((e) => {
  console.error('❌ Erro na importação:', e)
  process.exit(1)
})
