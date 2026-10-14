import { NextResponse } from 'next/server'
import { uploadImage } from '@/lib/upload'

// Runtime Edge (não o Node.js serverless padrão): o limite de tamanho de pedido do
// runtime serverless da Vercel é ~4,5 MB, fixo, sem forma de o aumentar por configuração
// — uma foto de câmara em alta resolução (comum em telemóveis recentes) ultrapassa-o
// facilmente e a Vercel rejeita o pedido antes sequer de chegar a este código (erro 413
// "FUNÇÃO_CARGA_MUITO_GRANDE"). O runtime Edge não tem este teto. uploadImage() só usa
// fetch/FormData/File — compatível com Edge, sem precisar de nenhuma API só de Node.
export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const photo = formData.get('photo') as File | null

    let photoUrl = ''
    if (photo && photo.size > 0) {
      try {
        photoUrl = await uploadImage(photo, 'shared_photos')
      } catch (err) {
        console.error('Erro ao guardar foto partilhada:', err)
      }
    }

    const redirectUrl = new URL('/dashboard/tasks', request.url)
    redirectUrl.searchParams.set('create', 'true')
    if (photoUrl) {
      redirectUrl.searchParams.set('sharedPhotoUrl', photoUrl)
    }

    return NextResponse.redirect(redirectUrl, { status: 303 })
  } catch (err) {
    console.error('Share Target Error:', err)
    return NextResponse.redirect(new URL('/dashboard/tasks?create=true', request.url), { status: 303 })
  }
}
