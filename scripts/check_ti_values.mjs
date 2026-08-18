import xlsx from 'xlsx'

const filePath = 'G:\\_CLAUDE 2026\\02. RG MAINTENANCE\\FR-MAN-09 MANUTENÇÃO_05_01_2026_8.xlsb'
const workbook = xlsx.readFile(filePath)
const sheet = workbook.Sheets['UR']
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 })

const tiValues = new Set()
const tiSamples = {}

for (let i = 2; i < rows.length; i++) {
  const row = rows[i]
  if (!row) continue
  const ti = row[6] ? String(row[6]).trim() : null
  if (ti) {
    tiValues.add(ti)
    if (!tiSamples[ti]) tiSamples[ti] = []
    if (tiSamples[ti].length < 3) {
      tiSamples[ti].push({ id: row[0], tag: row[5], title: row[7] })
    }
  }
}

console.log('--- VALORES ENCONTRADOS NA COLUNA TI ---')
console.log(Array.from(tiValues))
console.log('\nExemplos por valor TI:', JSON.stringify(tiSamples, null, 2))
