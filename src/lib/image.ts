/**
 * Compressão de imagens no cliente antes do upload (tarefa 06).
 * Reduz a resolução e recodifica em JPEG para minimizar o espaço ocupado no Firebase.
 */

const MAX_DIMENSION = 1600 // px (lado maior)
const JPEG_QUALITY = 0.72

/**
 * Comprime uma imagem: redimensiona para caber em MAX_DIMENSION e recodifica em JPEG.
 * Se não for imagem ou falhar, devolve o ficheiro original.
 */
export async function compressImage(
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  // GIFs animados perderiam a animação — não comprimir
  if (file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const escala = Math.min(1, maxDimension / Math.max(width, height))
    const w = Math.round(width * escala)
    const h = Math.round(height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    )
    if (!blob) return file
    // Se a compressão não ajudou, manter o original
    if (blob.size >= file.size) return file

    const novoNome = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], novoNome, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
