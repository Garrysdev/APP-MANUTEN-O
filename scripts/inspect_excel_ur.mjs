import xlsx from 'xlsx'
import path from 'path'
import fs from 'fs'

const filePath = 'G:\\_CLAUDE 2026\\02. RG MAINTENANCE\\FR-MAN-09 MANUTENÇÃO_05_01_2026_8.xlsb'

if (!fs.existsSync(filePath)) {
  console.error('Ficheiro não encontrado:', filePath)
  process.exit(1)
}

console.log('A ler ficheiro Excel:', filePath)
const workbook = xlsx.readFile(filePath)
console.log('Folhas disponíveis:', workbook.SheetNames)

for (const sheetName of workbook.SheetNames) {
  if (sheetName.toUpperCase().includes('UR') || sheetName.toUpperCase().includes('OT')) {
    console.log(`\n--- Folha: ${sheetName} ---`)
    const sheet = workbook.Sheets[sheetName]
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 })
    console.log(`Linhas: ${data.length}`)
    if (data.length > 0) {
      console.log('Cabeçalho (linha 1-5):')
      for (let i = 0; i < Math.min(5, data.length); i++) {
        console.log(`Linha ${i + 1}:`, data[i])
      }
    }
  }
}
