import sharp from 'sharp'
import path from 'path'

const SRC = path.join(process.cwd(), 'public', 'logo-rg.png')
const OUT_DIR = path.join(process.cwd(), 'public', 'icons')

async function run() {
  // 1. Isolar apenas o monograma "RG" (cortar a parte de baixo com o texto "Maintenance",
  //    que fica ilegível num ícone pequeno) e aparar a margem transparente à volta.
  const rawCrop = await sharp(SRC)
    .extract({ left: 0, top: 0, width: 1024, height: 440 })
    .toBuffer()
  const markCrop = await sharp(rawCrop)
    .trim({ threshold: 10 })
    .toBuffer()

  const markMeta = await sharp(markCrop).metadata()
  console.log('Mark trimmed size:', markMeta.width, 'x', markMeta.height)

  // 2. Compor num canvas quadrado com fundo branco e margem equilibrada (~14%),
  //    para preencher bem o ícone em vez de sobrar espaço vazio.
  async function makeIcon(size, background) {
    const innerSize = Math.round(size * 0.72)
    const resizedMark = await sharp(markCrop)
      .resize({ width: innerSize, height: innerSize, fit: 'inside' })
      .toBuffer()
    const resizedMeta = await sharp(resizedMark).metadata()

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background,
      },
    })
      .composite([
        {
          input: resizedMark,
          left: Math.round((size - resizedMeta.width) / 2),
          top: Math.round((size - resizedMeta.height) / 2),
        },
      ])
      .png()
      .toBuffer()
  }

  const white = { r: 255, g: 255, b: 255, alpha: 1 }

  const icon512 = await makeIcon(512, white)
  const icon192 = await makeIcon(192, white)
  await sharp(icon512).toFile(path.join(OUT_DIR, 'icon-512.png'))
  await sharp(icon192).toFile(path.join(OUT_DIR, 'icon-192.png'))

  // 3. Versão "maskable" (mais margem interna -- 60% em vez de 72% -- para sobreviver
  //    ao corte circular/arredondado que o Android aplica aos ícones adaptativos).
  async function makeMaskable(size, background) {
    const innerSize = Math.round(size * 0.55)
    const resizedMark = await sharp(markCrop)
      .resize({ width: innerSize, height: innerSize, fit: 'inside' })
      .toBuffer()
    const resizedMeta = await sharp(resizedMark).metadata()
    return sharp({
      create: { width: size, height: size, channels: 4, background },
    })
      .composite([
        {
          input: resizedMark,
          left: Math.round((size - resizedMeta.width) / 2),
          top: Math.round((size - resizedMeta.height) / 2),
        },
      ])
      .png()
      .toBuffer()
  }
  const iconMaskable512 = await makeMaskable(512, white)
  await sharp(iconMaskable512).toFile(path.join(OUT_DIR, 'icon-maskable-512.png'))

  // 4. Apple touch icon (180x180, sem alpha -- iOS não suporta transparência bem).
  const appleIcon = await makeIcon(180, white)
  await sharp(appleIcon).flatten({ background: white }).toFile(path.join(OUT_DIR, 'apple-touch-icon.png'))

  console.log('Icons generated in', OUT_DIR)
}

run().catch((e) => { console.error(e); process.exit(1) })
