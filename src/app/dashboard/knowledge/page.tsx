import { redirect } from 'next/navigation'

// A antiga "Documentação / Base de Conhecimento IA" (só demonstração) foi incorporada na
// Gestão Documental (30/10/2026, pedido do Rui): a pergunta à IA está lá, sobre os
// documentos reais. Este endereço fica só a redirecionar.
export default function KnowledgePage() {
  redirect('/dashboard/documents')
}
