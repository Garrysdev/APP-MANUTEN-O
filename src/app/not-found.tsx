import AccessDenied from '@/components/ui/AccessDenied'

// notFound() em qualquer página (OT, equipamento, stock, relatório de outra empresa ou
// inexistente) e endereços desconhecidos mostram sempre a mesma mensagem.
export default function NotFound() {
  return <AccessDenied />
}
