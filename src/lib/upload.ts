/**
 * Upload de imagens para o Cloudinary (unsigned, a partir do browser).
 * Substitui o Firebase Storage — o plano Spark não permite Storage sem Blaze.
 *
 * Requer no ambiente:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET   (preset "unsigned")
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

/**
 * Faz upload de uma imagem e devolve o secure_url.
 * @param file   Ficheiro já comprimido (ver compressImage).
 * @param folder Pasta lógica no Cloudinary (ex.: 'assets', 'avatars').
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary não configurado (NEXT_PUBLIC_CLOUDINARY_*).')
  }

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', UPLOAD_PRESET)
  body.append('folder', folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Upload falhou (${res.status}). ${detail}`)
  }

  const data = (await res.json()) as { secure_url?: string }
  if (!data.secure_url) throw new Error('Resposta do Cloudinary sem secure_url.')
  return data.secure_url
}

/**
 * Faz upload de um ficheiro genérico (PDF, etc.) via o endpoint 'auto' do Cloudinary —
 * ao contrário de uploadImage() (endpoint 'image', só aceita imagens), este aceita
 * qualquer tipo. Usado na Gestão Documental para anexar manuais/normas/PDFs aos
 * documentos do tipo 'MANUAL'.
 */
// Limite por ficheiro do plano gratuito do Cloudinary (10 MB).
const MAX_FILE_BYTES = 10 * 1024 * 1024

export async function uploadFile(file: File, folder: string): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary não configurado (NEXT_PUBLIC_CLOUDINARY_*).')
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    throw new Error(`ficheiro com ${mb} MB — o máximo é 10 MB. Guarda-o em PDF (Ficheiro → Guardar como → PDF) e importa o PDF.`)
  }

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', UPLOAD_PRESET)
  body.append('folder', folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: 'POST', body },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Upload falhou (${res.status}). ${detail}`)
  }

  const data = (await res.json()) as { secure_url?: string }
  if (!data.secure_url) throw new Error('Resposta do Cloudinary sem secure_url.')
  return data.secure_url
}
