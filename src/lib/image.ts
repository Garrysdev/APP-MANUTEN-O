/**
 * Compressão de imagens no cliente otimizada para dispositivos móveis (iOS / Android).
 * Reduz fotos de câmaras de 48MP+ para max 1200px e recodifica em JPEG leve (~150KB-250KB),
 * prevenindo picos de memória e fechamento inesperado (crash) da aplicação no telemóvel.
 */

const MAX_DIMENSION = 1200 // px (lado maior)
const JPEG_QUALITY = 0.75

export async function compressImage(
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY,
): Promise<File> {
  if (!file || !file.type.startsWith('image/')) return file
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file

  // Se o ficheiro já for extremamente pequeno (< 150KB), devolve diretamente
  if (file.size < 150 * 1024) return file

  return new Promise((resolve) => {
    try {
      const reader = new FileReader()
      reader.onerror = () => resolve(file)
      reader.onload = (e) => {
        const img = new Image()
        img.onerror = () => resolve(file)
        img.onload = () => {
          try {
            let w = img.width
            let h = img.height

            if (w > maxDimension || h > maxDimension) {
              if (w > h) {
                h = Math.round((h * maxDimension) / w)
                w = maxDimension
              } else {
                w = Math.round((w * maxDimension) / h)
                h = maxDimension
              }
            }

            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              resolve(file)
              return
            }

            ctx.drawImage(img, 0, 0, w, h)

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  resolve(file)
                  return
                }
                const novoNome = file.name.replace(/\.[^/.]+$/, '') + '.jpg'
                const compressedFile = new File([blob], novoNome, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                })
                resolve(compressedFile)
              },
              'image/jpeg',
              quality
            )
          } catch {
            resolve(file)
          }
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    } catch {
      resolve(file)
    }
  })
}
