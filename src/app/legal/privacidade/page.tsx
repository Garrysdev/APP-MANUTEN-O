import type { Metadata } from 'next'
import LegalLayout from '../LegalLayout'
import LegalSection from '../LegalSection'

export const metadata: Metadata = {
  title: 'Política de Privacidade — RG Maintenance',
  description: 'Como a RG Maintenance trata os seus dados pessoais.',
}

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="[A CONFIRMAR — data de publicação]">
      <LegalSection title="1. Responsável pelo tratamento">
        <p>
          O responsável pelo tratamento dos dados pessoais recolhidos através do RG Maintenance é{' '}
          <strong>[A CONFIRMAR — nome legal da empresa]</strong>, com sede em{' '}
          <strong>[A CONFIRMAR — morada]</strong>, NIF <strong>[A CONFIRMAR]</strong>, contactável
          através de <a href="mailto:info@rgmaintenance.pt" className="text-[#1B4F72] font-semibold hover:underline">info@rgmaintenance.pt</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Que dados tratamos">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Dados de conta:</strong> nome, email, função (gestor/técnico), empresa a que pertence.</li>
          <li><strong>Dados operacionais introduzidos pelo Cliente:</strong> ordens de trabalho, equipamentos, planos de manutenção, inventário, fotos anexadas a intervenções, mensagens internas.</li>
          <li><strong>Dados de faturação:</strong> tratados diretamente pela Stripe (não armazenamos números de cartão).</li>
          <li><strong>Dados técnicos:</strong> registos de acesso e utilização para fins de segurança e diagnóstico de problemas.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Para que usamos os dados">
        <ul className="list-disc pl-5 space-y-2">
          <li>Prestar o Serviço (autenticação, gestão de OTs, notificações, relatórios).</li>
          <li>Processar pagamentos e faturação das subscrições.</li>
          <li>Comunicar atualizações importantes do Serviço.</li>
          <li>Melhorar a plataforma e diagnosticar problemas técnicos.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Com quem partilhamos dados">
        <p>Recorremos aos seguintes subcontratantes para prestar o Serviço:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Google Cloud / Firebase</strong> — alojamento da base de dados e autenticação.</li>
          <li><strong>Stripe</strong> — processamento de pagamentos e faturação.</li>
          <li><strong>Cloudinary</strong> — alojamento de imagens anexadas a ordens de trabalho.</li>
          <li><strong>Vercel</strong> — alojamento da aplicação web.</li>
        </ul>
        <p>
          Não vendemos dados pessoais a terceiros nem os usamos para publicidade. Os dados
          operacionais de uma Empresa cliente (OTs, equipamentos) nunca são partilhados com outras
          Empresas clientes da plataforma.
        </p>
      </LegalSection>

      <LegalSection title="5. Durante quanto tempo guardamos os dados">
        <p>
          Os dados são guardados durante a vigência da conta. Após o cancelamento, os dados são
          conservados por um período de <strong>[A CONFIRMAR — ex.: 90 dias]</strong> para permitir
          reativação ou exportação, sendo depois eliminados ou anonimizados, salvo obrigação legal
          de conservação mais longa (ex.: faturas).
        </p>
      </LegalSection>

      <LegalSection title="6. Os seus direitos (RGPD)">
        <p>Nos termos do Regulamento Geral sobre a Proteção de Dados, tem direito a:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Aceder aos dados pessoais que tratamos sobre si;</li>
          <li>Solicitar a sua rectificação, caso estejam incorretos;</li>
          <li>Solicitar o apagamento dos seus dados, quando aplicável;</li>
          <li>Solicitar a portabilidade dos seus dados num formato estruturado;</li>
          <li>Opor-se a determinados tratamentos ou retirar o consentimento, quando aplicável;</li>
          <li>Apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD).</li>
        </ul>
        <p>
          Para exercer qualquer destes direitos, contacte-nos em{' '}
          <a href="mailto:info@rgmaintenance.pt" className="text-[#1B4F72] font-semibold hover:underline">info@rgmaintenance.pt</a>.
        </p>
      </LegalSection>

      <LegalSection title="7. Segurança">
        <p>
          A plataforma aplica medidas técnicas de segurança, incluindo encriptação em trânsito,
          autenticação por conta individual e regras de acesso que impedem que uma Empresa cliente
          veja dados de outra. Os acessos de escrita à base de dados são feitos exclusivamente por
          via de funções de servidor autenticadas, nunca diretamente pelo browser do utilizador.
        </p>
      </LegalSection>

      <LegalSection title="8. Alterações a esta política">
        <p>
          Podemos atualizar esta Política periodicamente. A data da última atualização está
          indicada no topo desta página.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
