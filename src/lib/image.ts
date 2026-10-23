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
  // Algumas apps de câmara entregam a foto sem tipo (''): tenta-se comprimir na mesma.
  if (!file || (file.type && !file.type.startsWith('image/'))) return file
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file

  // Se o ficheiro já for extremamente pequeno (< 150KB), devolve diretamente
  if (file.size < 150 * 1024) return file

  return new Promise((resolve) => {
    try {
      // Endereço temporário do ficheiro em vez de o ler como texto base64: uma foto de
      // 48 MP+ em base64 ocupava muito mais memória e o telemóvel podia falhar a
      // descodificação, ficando a foto original (> 10 MB, recusada pelo serviço de imagens).
      const src = URL.createObjectURL(file)
      const img = new Image()
      const done = (f: File) => { URL.revokeObjectURL(src); resolve(f) }
      img.onerror = () => done(file)
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
            done(file)
            return
          }

          ctx.drawImage(img, 0, 0, w, h)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                done(file)
                return
              }
              const novoNome = (file.name || 'foto').replace(/\.[^/.]+$/, '') + '.jpg'
              const compressedFile = new File([blob], novoNome, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              done(compressedFile)
            },
            'image/jpeg',
            quality
          )
        } catch {
          done(file)
        }
      }
      img.src = src
    } catch {
      resolve(file)
    }
  })
}
