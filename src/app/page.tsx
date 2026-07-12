import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getSessionUser } from '@/lib/firebase/session'
import {
  CheckCircle, Wrench, FileBarChart, Users, MapPin,
  Package, ArrowRight, Star, Shield, Zap, PlayCircle,
  BarChart3, Clock, TrendingDown, Target
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const features = [
  {
    icon: Wrench,
    title: 'Ordens de Trabalho',
    desc: 'Cria, atribui e acompanha intervenções em tempo real com histórico completo.',
  },
  {
    icon: Package,
    title: 'Gestão de Equipamentos',
    desc: 'Inventário de ativos com histórico detalhado de manutenções por máquina.',
  },
  {
    icon: FileBarChart,
    title: 'Relatórios PDF',
    desc: 'KPIs e plano de manutenção preventiva gerados automaticamente.',
  },
  {
    icon: Users,
    title: 'Equipa & Convites',
    desc: 'Adiciona técnicos por link de convite sem burocracia administrativa.',
  },
  {
    icon: MapPin,
    title: 'Multi-localização',
    desc: 'Gere instalações em diferentes geografias numa única conta.',
  },
  {
    icon: Shield,
    title: 'Materiais & Stock',
    desc: 'Regista consumíveis e peças utilizados em cada intervenção.',
  },
]

const plans = [
  {
    name: 'Starter',
    price: 'Grátis',
    period: '',
    desc: 'Para pequenas equipas',
    plan: null,
    features: [
      'Até 2 técnicos + 1 gestor',
      '50 intervenções/mês',
      'Gestão de equipamentos',
      'Dashboard básico',
    ],
    cta: 'Começar grátis',
    href: '/register',
    popular: false,
  },
  {
    name: 'Pro',
    price: '29€',
    period: '/mês',
    desc: 'Para equipas em crescimento',
    plan: 'pro',
    features: [
      'Até 5 técnicos + 2 gestores',
      'Intervenções ilimitadas',
      'Relatórios PDF & Excel',
      'Notificações por email',
      'Histórico completo',
    ],
    cta: 'Experimentar 14 dias',
    href: '/register?plan=pro',
    popular: true,
  },
  {
    name: 'Business',
    price: '79€',
    period: '/mês',
    desc: 'Para operações maiores',
    plan: 'business',
    features: [
      'Até 15 técnicos + 3 gestores',
      'Multi-localização',
      'Gestão de stock avançada',
      'API de integração',
      'Suporte prioritário',
    ],
    cta: 'Experimentar 14 dias',
    href: '/register?plan=business',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 'Personalizado',
    period: '',
    desc: 'Para grandes empresas',
    plan: null,
    features: [
      'Utilizadores ilimitados',
      'White-label disponível',
      'API dedicada',
      'SLA garantido',
      'Suporte dedicado 24/7',
    ],
    cta: 'Falar com Especialista',
    href: 'mailto:info@rgmaintenance.pt',
    popular: false,
  },
]

const metrics = [
  { icon: Target, value: "1,500+", label: "Intervenções Geridas Mensalmente" },
  { icon: TrendingDown, value: "-35%", label: "Redução de Tempo de Paragem" },
  { icon: Clock, value: "+12h", label: "Poupadas em Administração por Mês" },
  { icon: BarChart3, value: "100%", label: "Digitalização e Rastreabilidade" },
]

export default async function LandingPage() {
  const session = await getSessionUser()
  if (session) redirect('/dashboard')

  return (
    <div className="bg-white min-h-screen font-sans selection:bg-[#1B4F72]/20">
      
      {/* Nav - Glassmorphism */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-20">
          <div className="flex items-center gap-2">
            <Image src="/logo-rg.png" alt="RG Maintenance" width={140} height={78} className="h-12 w-auto" priority />
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#solucao" className="text-sm font-semibold text-gray-600 hover:text-[#1B4F72] transition-colors">A Solução</a>
            <a href="#funcionalidades" className="text-sm font-semibold text-gray-600 hover:text-[#1B4F72] transition-colors">Funcionalidades</a>
            <a href="#precos" className="text-sm font-semibold text-gray-600 hover:text-[#1B4F72] transition-colors">Preços</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex text-sm font-bold text-gray-600 hover:text-[#1B4F72] px-4 py-2 transition-colors">
              Entrar
            </Link>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#1B4F72]/30 hover:shadow-xl hover:shadow-[#1B4F72]/40 hover:-translate-y-0.5 transition-all">
              Começar Agora
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Gradient Background & Video Placeholder */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50">
        {/* Background glow effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#2E86C1]/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#1B4F72]/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#1B4F72] shadow-sm mb-8 border border-gray-100 ring-1 ring-black/5 animate-fade-in-up">
            <Zap className="h-4 w-4 text-[#F59E0B]" />
            A Plataforma Nº1 de Manutenção Industrial
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-tight mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            Transforme o caos em <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1B4F72] to-[#3498DB]">
              controlo absoluto
            </span>
          </h1>
          
          <p className="text-lg lg:text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl mx-auto font-medium animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            A RG Maintenance é o software inteligente que digitaliza as suas ordens de trabalho, previne avarias de equipamentos e poupa horas de relatórios manuais.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1B4F72] to-[#2874A6] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#1B4F72]/30 hover:shadow-2xl hover:shadow-[#1B4F72]/40 hover:-translate-y-1 transition-all">
              Experimentar Grátis 14 Dias <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#video-demo" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white border border-gray-200 px-8 py-4 text-base font-bold text-slate-700 shadow-sm hover:bg-gray-50 hover:-translate-y-1 transition-all">
              <PlayCircle className="h-5 w-5 text-[#2E86C1]" /> Ver Vídeo Demo
            </a>
          </div>
          <p className="mt-5 text-sm text-slate-500 font-medium animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            Sem necessidade de cartão de crédito. Configuração em 2 minutos.
          </p>
        </div>

        {/* Video / Dashboard Mockup Hero Image */}
        <div id="video-demo" className="max-w-6xl mx-auto px-4 sm:px-6 mt-20 relative animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <div className="relative rounded-[2rem] border border-gray-200/50 bg-white shadow-2xl p-2 lg:p-4 overflow-hidden group cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent z-10 rounded-[1.5rem]" />
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="w-20 h-20 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-white transition-all duration-300">
                <PlayCircle className="h-10 w-10 text-[#1B4F72] ml-1" />
              </div>
            </div>
            {/* The generated Dashboard Mockup */}
            <div className="relative rounded-[1.5rem] overflow-hidden bg-gray-100 aspect-[16/9] w-full">
               <Image 
                 src="/mockup-dashboard.png" 
                 alt="Dashboard RG Maintenance" 
                 fill
                 className="object-cover object-top"
                 priority
               />
            </div>
          </div>
        </div>
      </section>

      {/* Metrics / Social Proof Section */}
      <section className="bg-white py-16 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-center text-sm font-bold text-gray-400 uppercase tracking-widest mb-10">O impacto da nossa plataforma nos nossos clientes</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 divide-x divide-gray-100">
            {metrics.map((metric, i) => (
              <div key={i} className="text-center px-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF4FB] mb-4">
                  <metric.icon className="h-6 w-6 text-[#2E86C1]" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-black text-slate-900 mb-2">{metric.value}</h3>
                <p className="text-sm font-semibold text-slate-500 leading-snug">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Zig Zag Sections */}
      <section id="solucao" className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-32">
          
          {/* Feature 1 */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#1B4F72]/10 to-[#3498DB]/10 transform -rotate-3 rounded-3xl" />
              <div className="relative rounded-3xl border border-gray-200 bg-white shadow-xl overflow-hidden aspect-[4/3] transform hover:scale-[1.02] transition-transform duration-500">
                <Image 
                  src="/mockup-dashboard.png" 
                  alt="Gestão de Equipamentos" 
                  fill
                  className="object-cover object-left"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#EAF4FB] px-3 py-1.5 text-sm font-bold text-[#1B4F72] mb-6">
                <Package className="h-4 w-4" /> Gestão de Ativos
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-6 leading-tight">
                Domine o ciclo de vida<br/>de cada equipamento
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Deixe de procurar manuais em pastas de papel. Tenha a ficha técnica, o histórico de intervenções, e o plano preventivo de cada máquina à distância de um clique.
              </p>
              <ul className="space-y-4">
                {[
                  'Histórico digital 100% pesquisável.',
                  'Associação por TAGs e códigos QR.',
                  'Alertas de manutenção preventiva automática.'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-[#2E86C1] flex-shrink-0" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FDF2E9] px-3 py-1.5 text-sm font-bold text-[#D35400] mb-6">
                <Wrench className="h-4 w-4" /> Ordens de Trabalho
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-6 leading-tight">
                Intervenções rápidas e<br/>sem perdas de informação
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Os seus técnicos recebem as tarefas diretamente no telemóvel. Eles registam os materiais usados, o tempo gasto, e fecham a ordem no momento. Sem mais papéis perdidos ou caligrafia ilegível.
              </p>
              <ul className="space-y-4">
                {[
                  'Registo em tempo real pelo telemóvel/tablet.',
                  'Controlo de consumíveis e peças.',
                  'Geração de PDF imediata no fecho da tarefa.'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-[#D35400] flex-shrink-0" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative pl-10">
              <div className="absolute inset-0 bg-gradient-to-tl from-[#E67E22]/10 to-[#F39C12]/10 transform rotate-3 rounded-3xl" />
              <div className="relative rounded-3xl border border-gray-200 bg-white shadow-2xl overflow-hidden aspect-[3/4] sm:aspect-square lg:aspect-[4/5] transform hover:-translate-y-2 transition-transform duration-500 w-3/4 mx-auto">
                <Image 
                  src="/mockup-mobile.png" 
                  alt="App Mobile Técnico" 
                  fill
                  className="object-cover object-top"
                />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Grid Features */}
      <section id="funcionalidades" className="bg-slate-50 py-24 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
              Tudo o que uma equipa moderna precisa
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Desenhado especificamente para a realidade do chão de fábrica, combinando poder técnico com uma facilidade de uso extrema.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EAF4FB] to-[#D6EAF8] mb-6 group-hover:scale-110 transition-transform">
                  <Icon className="h-6 w-6 text-[#1B4F72]" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-base text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial / Quote */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-8 w-8 text-[#F1C40F] fill-[#F1C40F]" />
            ))}
          </div>
          <blockquote className="text-2xl md:text-4xl font-bold text-slate-900 leading-tight mb-8">
            &quot;A RG Maintenance mudou completamente a forma como a nossa fábrica opera. Acabou o papel, acabou a desorganização. Temos tudo centralizado e os nossos diretores adoram os relatórios automáticos em PDF.&quot;
          </blockquote>
          <div className="flex items-center justify-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-200 overflow-hidden">
               <Image src="/logo-rg.png" alt="User" width={48} height={48} className="object-cover h-full w-full opacity-50" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900 text-lg">Diretor de Operações</div>
              <div className="text-slate-500 font-medium">Indústria Transformadora, PT</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="py-24 bg-slate-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
              Preços simples e transparentes
            </h2>
            <p className="text-slate-500 text-lg">
              Sem surpresas escondidas. Escala o plano à medida que a tua equipa cresce.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-3xl bg-white p-8 flex flex-col ${
                  plan.popular
                    ? 'border-2 border-[#2E86C1] shadow-2xl scale-105 z-10'
                    : 'border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] px-4 py-1.5 text-sm font-bold text-white shadow-md">
                      <Star className="h-3.5 w-3.5 fill-white" /> O Mais Escolhido
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-black text-slate-900 text-2xl">{plan.name}</h3>
                  <p className="text-sm font-medium text-slate-500 mt-1">{plan.desc}</p>
                  <div className="mt-6 flex items-end gap-1">
                    <span className={`font-black text-slate-900 ${plan.price === 'Personalizado' ? 'text-2xl' : 'text-5xl tracking-tight'}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-base font-semibold text-slate-400 pb-1">{plan.period}</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-4 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-base text-slate-600 font-medium">
                      <CheckCircle className="h-5 w-5 text-[#2E86C1] flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`text-center py-4 text-base rounded-xl font-bold transition-all ${
                    plan.popular
                      ? 'bg-[#1B4F72] text-white hover:bg-[#154360] shadow-lg hover:shadow-xl'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner Modern */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B4F72] via-[#2874A6] to-[#154360]" />
        {/* Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#3498DB] rounded-full mix-blend-multiply filter blur-[128px] opacity-70" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#2ECC71] rounded-full mix-blend-multiply filter blur-[128px] opacity-20" />
        
        <div className="max-w-4xl mx-auto text-center px-4 relative z-10">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">Pronto para digitalizar a sua manutenção?</h2>
          <p className="text-[#AED6F1] text-xl font-medium mb-10 max-w-2xl mx-auto">
            Junte-se às dezenas de fábricas e empresas de serviços que já otimizaram as suas operações connosco. Comece hoje mesmo.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-black text-[#1B4F72] hover:bg-gray-50 hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]"
            >
              Criar Conta Gratuita <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
          <p className="mt-6 text-sm text-[#AED6F1] font-medium opacity-80">
            Acesso completo durante 14 dias. Não é necessário cartão de crédito.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white pt-16 pb-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
            <Image src="/logo-rg.png" alt="RG Maintenance" width={120} height={67} className="h-10 w-auto" />
            <div className="flex gap-8 text-sm font-semibold text-slate-500">
              <a href="#" className="hover:text-[#1B4F72] transition-colors">Funcionalidades</a>
              <a href="#" className="hover:text-[#1B4F72] transition-colors">Preços</a>
              <a href="#" className="hover:text-[#1B4F72] transition-colors">Termos & Privacidade</a>
              <a href="mailto:info@rgmaintenance.pt" className="hover:text-[#1B4F72] transition-colors">Contacto</a>
            </div>
          </div>
          <div className="text-center md:text-left border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm font-medium text-slate-400">
              © {new Date().getFullYear()} RG Maintenance. Todos os direitos reservados.
            </p>
            <div className="text-sm font-medium text-slate-400">
              Feito com tecnologia e eficiência para a Indústria.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
