/**
 * Compressão de imagens no cliente antes do upload (tarefa 06).
 * Reduz a resolução e recodifica em JPEG leve para otimizar espaço e velocidade.
 */

const MAX_DIMENSION = 1200 // px (lado maior)
const JPEG_QUALITY = 0.70

/**
 * Comprime uma imagem: redimensiona para caber em maxDimension e recodifica em JPEG.
 * Suporta fallback HTMLImageElement para fotos tiradas no telemóvel (ex. iOS/Android).
 */
export async function compressImage(
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif') return file

  try {
    let w = 0
    let h = 0
    let drawSource: CanvasImageSource | null = null

    if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file)
        w = bitmap.width
        h = bitmap.height
        drawSource = bitmap
      } catch {
        drawSource = null
      }
    }

    if (!drawSource) {
      const img = document.createElement('img')
      const url = URL.createObjectURL(file)
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
        img.src = url
      })
      URL.revokeObjectURL(url)
      w = img.width
      h = img.height
      drawSource = img
    }

    const escala = Math.min(1, maxDimension / Math.max(w, h))
    const finalW = Math.max(1, Math.round(w * escala))
    const finalH = Math.max(1, Math.round(h * escala))

    const canvas = document.createElement('canvas')
    canvas.width = finalW
    canvas.height = finalH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(drawSource, 0, 0, finalW, finalH)
    if ('close' in drawSource && typeof (drawSource as any).close === 'function') {
      ;(drawSource as any).close()
    }

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    )
    if (!blob) return file

    const novoNome = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], novoNome, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
