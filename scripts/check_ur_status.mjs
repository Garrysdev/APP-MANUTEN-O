import { readFileSync } from 'node:fs';

const raw = readFileSync('scripts/import/tasks.json', 'utf-8');
const tasks = JSON.parse(raw);

const excelUrTasks = tasks.filter(t => t.source === 'excel_ur');
console.log(`excel_ur count: ${excelUrTasks.length}`);
const stCount = {};
excelUrTasks.forEach(t => {
  stCount[t.status] = (stCount[t.status] || 0) + 1;
});
console.log('excel_ur status breakdown:', stCount);

// Sample done vs pending
console.log('Sample pending:');
console.log(excelUrTasks.filter(t => t.status === 'pending').slice(0, 3).map(t => ({ id: t.id, title: t.title, tag: t.tag })));
console.log('Sample done:');
console.log(excelUrTasks.filter(t => t.status === 'done').slice(0, 3).map(t => ({ id: t.id, title: t.title, tag: t.tag })));
