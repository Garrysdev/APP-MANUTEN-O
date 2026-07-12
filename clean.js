const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src', 'lib', 'firebase', 'data.ts');
let lines = fs.readFileSync(p, 'utf8').split('\n');
lines.splice(106, 44); // 0-indexed, so line 107 is index 106. Remove 44 lines (107 to 150).
fs.writeFileSync(p, lines.join('\n'));
console.log('Cleaned');
