import type { Metadata } from 'next'
import LegalLayout from '../LegalLayout'
import LegalSection from '../LegalSection'

export const metadata: Metadata = {
  title: 'Termos & Condições — RG Maintenance',
  description: 'Termos e condições de utilização da plataforma RG Maintenance.',
}

export default function TermosPage() {
  return (
    <LegalLayout title="Termos & Condições de Utilização" updatedAt="[A CONFIRMAR — data de publicação]">
      <LegalSection title="1. Identificação do serviço">
        <p>
          A plataforma RG Maintenance (&quot;o Serviço&quot;) é operada por{' '}
          <strong>[A CONFIRMAR — nome legal da empresa]</strong>, com sede em{' '}
          <strong>[A CONFIRMAR — morada]</strong> e número de identificação fiscal{' '}
          <strong>[A CONFIRMAR — NIF]</strong> (&quot;nós&quot;, &quot;a RG Maintenance&quot;). Ao criar
          uma conta ou utilizar o Serviço, aceita estes Termos.
        </p>
      </LegalSection>

      <LegalSection title="2. O que é o Serviço">
        <p>
          O RG Maintenance é um software de gestão de manutenção industrial (CMMS) disponibilizado
          como serviço (SaaS), que permite a empresas clientes (&quot;Cliente&quot;, &quot;Empresa&quot;) gerir
          ordens de trabalho, equipamentos, planos de manutenção, inventário e equipas técnicas.
        </p>
      </LegalSection>

      <LegalSection title="3. Conta e responsabilidades do Cliente">
        <ul className="list-disc pl-5 space-y-2">
          <li>O Cliente é responsável por manter as credenciais de acesso confidenciais.</li>
          <li>O Cliente é responsável pela exatidão dos dados introduzidos na plataforma (equipamentos, OTs, utilizadores).</li>
          <li>O Cliente garante que tem o direito de convidar os utilizadores (técnicos, gestores) que adiciona à sua conta.</li>
          <li>É proibido utilizar o Serviço para fins ilícitos ou para armazenar dados de terceiros sem base legal para tal.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Planos, preços e faturação">
        <p>
          O Serviço é disponibilizado em diferentes planos (Free, Starter, Pro, Business), com
          funcionalidades e limites próprios, descritos na página de preços. Os planos pagos são
          faturados de forma recorrente (mensal ou anual, conforme escolhido) através do nosso
          processador de pagamentos, a Stripe. Os preços apresentados não incluem IVA, que será
          acrescentado quando aplicável. O Cliente pode cancelar a subscrição em qualquer momento;
          o acesso ao plano pago mantém-se até ao final do período já pago.
        </p>
      </LegalSection>

      <LegalSection title="5. Período de teste (trial)">
        <p>
          Quando aplicável, novos Clientes nos planos Pro e Business podem beneficiar de um período
          de teste gratuito de 14 dias. Findo esse período, a subscrição é automaticamente cobrada ao
          método de pagamento associado, salvo cancelamento prévio.
        </p>
      </LegalSection>

      <LegalSection title="6. Disponibilidade do serviço">
        <p>
          Procuramos manter o Serviço disponível de forma contínua, mas não garantimos
          disponibilidade ininterrupta. Podem ocorrer períodos de manutenção programada ou
          indisponibilidade não planeada. Em caso de falha prolongada imputável a nós, avaliaremos
          caso a caso compensações adequadas.
        </p>
      </LegalSection>

      <LegalSection title="7. Propriedade dos dados">
        <p>
          Os dados introduzidos pelo Cliente (ordens de trabalho, equipamentos, ficheiros, fotos)
          pertencem ao Cliente. Não vendemos nem partilhamos esses dados com terceiros para fins
          comerciais próprios. Ao terminar a conta, o Cliente pode solicitar a exportação ou
          eliminação dos seus dados — ver a <a href="/legal/privacidade" className="text-[#1B4F72] font-semibold hover:underline">Política de Privacidade</a>.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitação de responsabilidade">
        <p>
          O Serviço é fornecido &quot;tal como está&quot;. Na máxima medida permitida por lei, não nos
          responsabilizamos por danos indiretos, perda de lucros ou perda de dados resultantes da
          utilização do Serviço, exceto nos casos de dolo ou negligência grosseira.
        </p>
      </LegalSection>

      <LegalSection title="9. Alterações aos Termos">
        <p>
          Podemos atualizar estes Termos periodicamente. Alterações materiais serão comunicadas aos
          Clientes com uma antecedência razoável, por email ou através da plataforma.
        </p>
      </LegalSection>

      <LegalSection title="10. Contacto">
        <p>
          Para questões sobre estes Termos, contacte-nos através de{' '}
          <a href="mailto:info@rgmaintenance.pt" className="text-[#1B4F72] font-semibold hover:underline">info@rgmaintenance.pt</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
