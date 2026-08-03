'use server'

import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssets, listTasks, listMaintenancePlans, listStockItems, listSafetyRules } from '@/lib/firebase/data'

export async function askAiConsultantAction(userMessage: string): Promise<{ response: string; error?: string }> {
  try {
    const profile = await getCurrentProfile()
    if (!profile) return { response: '', error: 'Sessão expirada. Inicie sessão novamente.' }

    const message = (userMessage || '').trim()
    if (!message) return { response: '', error: 'Por favor introduza uma mensagem.' }

    // Fetch real company context
    const [assets, tasks, plans, stocks, safetyRules] = await Promise.all([
      listAssets(profile.companyId),
      listTasks(profile.companyId),
      listMaintenancePlans(profile.companyId),
      listStockItems(profile.companyId),
      listSafetyRules(profile.companyId),
    ])

    const msgLower = message.toLowerCase()

    // Context metrics
    const activeAssets = assets.filter((a) => a.active)
    const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
    const correctiveOpen = openTasks.filter((t) => t.tipo === 'curativa' || t.tipo === 'pi')
    const lowStock = stocks.filter((s) => s.minQuantity != null && s.quantity <= s.minQuantity)
    const classAAssets = activeAssets.filter((a) => a.criticidadeABC === 'A')

    // If Gemini or OpenAI API Key is present in environment, call LLM
    const geminiKey = process.env.GEMINI_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    if (geminiKey) {
      try {
        const prompt = `És o Consultor IA da plataforma RG Maintenance (Especialista em Manutenção Industrial, ISO 9001 e NP EN 13306).
Contexto Atual da Empresa (${profile.company?.name ?? 'UR'}):
- Total Equipamentos: ${assets.length} (${activeAssets.length} ativos, ${classAAssets.length} de Classe A)
- OTs em Aberto: ${openTasks.length} (${correctiveOpen.length} corretivas/PI)
- Planos de Manutenção: ${plans.length}
- Artigos em Stock: ${stocks.length} (${lowStock.length} abaixo do stock mínimo)
- Regras de Segurança Registadas: ${safetyRules.length}

Pergunta do Utilizador: "${message}"

Responde em português europeu de forma profissional, clara, estruturada e prática.`

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        })
        const data = await res.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return { response: text }
      } catch (err) {
        console.error('[AiConsultant] Gemini error:', err)
      }
    }

    if (openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `És o Consultor IA da plataforma RG Maintenance. Responde em português de Portugal com base no contexto da fábrica. Total Equipamentos: ${assets.length}, OTs Abertas: ${openTasks.length}, Planos: ${plans.length}, Stock: ${stocks.length}.`,
              },
              { role: 'user', content: message },
            ],
          }),
        })
        const data = await res.json()
        const text = data?.choices?.[0]?.message?.content
        if (text) return { response: text }
      } catch (err) {
        console.error('[AiConsultant] OpenAI error:', err)
      }
    }

    // Built-in Expert Maintenance Knowledge Engine using real data
    if (msgLower.includes('equipamento') || msgLower.includes('crítico') || msgLower.includes('critico') || msgLower.includes('classe a')) {
      if (classAAssets.length > 0) {
        const listStr = classAAssets.slice(0, 8).map((a) => `• **${a.name}** (Área: ${a.area || '—'}, TAG: ${a.tag || '—'})`).join('\n')
        return {
          response: `### 🏭 Análise dos Equipamentos Mais Críticos (Classe A)\n\nAtualmente tens **${classAAssets.length} equipamentos de Classe A** cadastrados no sistema:\n\n${listStr}\n\n💡 **Recomendação NP EN 13306**: Os equipamentos de Classe A devem ter cobertura de **100% no Plano de Manutenção Preventiva** com inspeções periódicas rigorosas para evitar paragens não planeadas.`,
        }
      } else {
        return {
          response: `Atualmente tens **${assets.length} equipamentos** cadastrados no sistema. Para identificar a criticidade, podes atribuir a classificação A/B/C no cadastro de cada equipamento em *Equipamentos → Editar*.`,
        }
      }
    }

    if (msgLower.includes('stock') || msgLower.includes('rotura') || msgLower.includes('consumivel') || msgLower.includes('peça') || msgLower.includes('peca')) {
      if (lowStock.length > 0) {
        const listStr = lowStock.slice(0, 8).map((s) => `• **${s.name}** (Atual: ${s.quantity} ${s.unit ?? 'un'} | Mínimo: ${s.minQuantity})`).join('\n')
        return {
          response: `### 📦 Estado do Inventário & Sobresselentes\n\nTens **${lowStock.length} artigos com stock abaixo do nível mínimo**:\n\n${listStr}\n\n💡 **Recomendação**: Efetua a encomenda destes artigos junto dos fornecedores para garantir a rapidez de resposta em caso de intervenção corretiva.`,
        }
      } else {
        return {
          response: `### 📦 Estado do Inventário\n\nTodos os **${stocks.length} artigos** em stock encontram-se dentro dos níveis mínimos definidos. Não há registo de roturas neste momento!`,
        }
      }
    }

    if (msgLower.includes('iso') || msgLower.includes('norma') || msgLower.includes('qualidade') || msgLower.includes('13306') || msgLower.includes('9001')) {
      return {
        response: `### 📜 Orientações das Normas ISO 9001 & NP EN 13306\n\n1. **ISO 9001 (Secção 7.1.5 & 8.5.1)**: Exige rastreabilidade completa das intervenções, calibração de instrumentos de medição e evidências documentadas das manutenções executadas.\n2. **NP EN 13306 (Terminologia)**:\n   • **Manutenção Preventiva (MP)**: Executada a intervalos pré-determinados para reduzir a probabilidade de falha.\n   • **Manutenção Corretiva (MC)**: Executada após a deteção de uma avaria para repor a função requerida.\n   • **Manutenção de Investimentos (MI)**: Projetos e melhorias estruturais no ativo.`,
      }
    }

    if (msgLower.includes('tarefa') || msgLower.includes('ot') || msgLower.includes('ordem') || msgLower.includes('pendente') || msgLower.includes('aberto')) {
      return {
        response: `### 📋 Estado das Ordens de Trabalho (OTs)\n\nPresentemente existem **${openTasks.length} OTs em aberto** no sistema:\n• **Manutenção Corretiva / PI**: ${correctiveOpen.length} OTs\n• **Planos / Preventiva**: ${openTasks.length - correctiveOpen.length} OTs\n\n💡 Prioriza o encerramento das OTs corretivas de emergência para manter os indicadores de fiabilidade (MTBF) elevados.`,
      }
    }

    // Default expert response
    return {
      response: `### 🤖 Consultor de Manutenção Industrial RG Maintenance\n\nCom base nos dados em tempo real da tua empresa (**${assets.length} equipamentos**, **${openTasks.length} OTs ativas**, **${plans.length} planos** e **${stocks.length} artigos de stock**):\n\nComo posso ajudar especificamente?\n• **Análise de Equipamentos Críticos**: Pergunta por "equipamentos críticos" ou "classe A".\n• **Controlo de Stock & Sobresselentes**: Pergunta por "artigos em stock" ou "roturas".\n• **Normas & Conformidade**: Pergunta por "ISO 9001" ou "NP EN 13306".\n• **Gestão de OTs Pendentes**: Pergunta por "tarefas pendentes" ou "estado das OTs".`,
    }
  } catch (err) {
    console.error('[askAiConsultantAction] Error:', err)
    return { response: '', error: 'Ocorreu um erro ao processar a consulta do Consultor IA.' }
  }
}
