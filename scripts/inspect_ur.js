const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const directPath = path.join(__dirname, '..', 'FR-MAN-09 MANUTENÇÃO_05_01_2026_8.xlsb');

try {
  console.log('Reading:', directPath);
  const workbook = XLSX.readFile(directPath);
  console.log('Sheet names:', workbook.SheetNames);
  
  const sheetName = workbook.SheetNames.find(s => s.toLowerCase().trim() === 'ur') || 'UR';
  console.log('Using sheet:', sheetName);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error('Sheet UR not found!');
    process.exit(1);
  }
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('Total rows in sheet UR:', data.length);
  console.log('Row 0 (Header?):', JSON.stringify(data[0]));
  console.log('Row 1:', JSON.stringify(data[1]));
  console.log('Row 2:', JSON.stringify(data[2]));
  console.log('Row 3:', JSON.stringify(data[3]));
  console.log('Last row:', JSON.stringify(data[data.length - 1]));

  // Count non-empty rows
  const validRows = data.filter(r => r && r.length > 0 && r.some(c => c !== null && c !== undefined && c !== ''));
  console.log('Valid non-empty rows:', validRows.length);
} catch (err) {
  console.error('Error reading xlsb:', err);
}
