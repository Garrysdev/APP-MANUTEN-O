/**
 * Leitura mínima de ficheiros .zip no browser (sem bibliotecas): lê o diretório central
 * e devolve cada entrada como stream descomprimida (DecompressionStream 'deflate-raw').
 * Usado para importar exportações de vibração zipadas (85 MB de .csv → ~2,5 MB em .zip).
 */

export interface ZipEntry {
  name: string
  size: number // tamanho descomprimido
  open: () => ReadableStream<Uint8Array>
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true)
const u32 = (v: DataView, o: number) => v.getUint32(o, true)

export async function listZipEntries(file: Blob): Promise<ZipEntry[]> {
  // Fim do diretório central (EOCD): nos últimos 64 KB + 22 bytes.
  const tailStart = Math.max(0, file.size - 65_557)
  const tail = new DataView(await file.slice(tailStart).arrayBuffer())
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Ficheiro .zip inválido.')
  const count = u16(tail, eocd + 10)
  const cdSize = u32(tail, eocd + 12)
  const cdOffset = u32(tail, eocd + 16)
  if (cdOffset === 0xffffffff) throw new Error('Ficheiro .zip demasiado grande (ZIP64 não suportado).')

  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer())
  const entries: ZipEntry[] = []
  let p = 0
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (u32(cd, p) !== 0x02014b50) break
    const method = u16(cd, p + 10)
    const compSize = u32(cd, p + 20)
    const size = u32(cd, p + 24)
    const nameLen = u16(cd, p + 28)
    const extraLen = u16(cd, p + 30)
    const commentLen = u16(cd, p + 32)
    const localOffset = u32(cd, p + 42)
    const nameBytes = new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen)
    const utf8 = (u16(cd, p + 8) & 0x800) !== 0
    const name = new TextDecoder(utf8 ? 'utf-8' : 'latin1').decode(nameBytes)
    p += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/')) continue

    entries.push({
      name,
      size,
      open: () => {
        // O cabeçalho local tem o seu próprio comprimento de nome/extra — lê-se ao abrir.
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              const lh = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer())
              if (u32(lh, 0) !== 0x04034b50) throw new Error('Entrada .zip inválida.')
              const dataStart = localOffset + 30 + u16(lh, 26) + u16(lh, 28)
              let body = file.slice(dataStart, dataStart + compSize).stream() as ReadableStream<Uint8Array>
              if (method === 8) body = body.pipeThrough(new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
              else if (method !== 0) throw new Error('Compressão .zip não suportada.')
              const reader = body.getReader()
              for (;;) {
                const { done, value } = await reader.read()
                if (done) break
                controller.enqueue(value)
              }
              controller.close()
            } catch (e) {
              controller.error(e)
            }
          },
        })
        return stream
      },
    })
  }
  return entries
}
