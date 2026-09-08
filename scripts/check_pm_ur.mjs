import { readFileSync } from 'node:fs';

const raw = readFileSync('scripts/import/tasks.json', 'utf-8');
const tasks = JSON.parse(raw);

const excelUrTasks = tasks.filter(t => t.source === 'excel_ur');
const pmInTitle = excelUrTasks.filter(t => t.title && (t.title.startsWith('[PM]') || t.title.startsWith('[MP]') || t.title.includes('PM') || t.title.includes('MP')));

console.log('excel_ur with PM/MP:', pmInTitle.length);
pmInTitle.slice(0, 10).forEach(t => {
  console.log(`ID: ${t.id} | Title: ${t.title}`);
});
