import { NextResponse } from 'next/server'
import { uploadImage } from '@/lib/upload'

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
