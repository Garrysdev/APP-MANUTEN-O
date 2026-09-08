import { readFileSync } from 'node:fs';

const raw = readFileSync('scripts/import/tasks.json', 'utf-8');
const tasks = JSON.parse(raw);

console.log(`Total tasks in tasks.json: ${tasks.length}`);

const sources = {};
const statuses = {};
let countWithPlan = 0;
let countScheduledPM = 0;
let countExcelUr = 0;

tasks.forEach(t => {
  sources[t.source || 'none'] = (sources[t.source || 'none'] || 0) + 1;
  statuses[t.status || 'none'] = (statuses[t.status || 'none'] || 0) + 1;
  if (t.maintenancePlanId) countWithPlan++;
  if (t.source === 'pm_agendamento_2026' || (t.title && (t.title.startsWith('[PM]') || t.title.startsWith('[MP]')))) {
    countScheduledPM++;
  }
  if (t.source === 'excel_ur') countExcelUr++;
});

console.log('Sources:', sources);
console.log('Statuses:', statuses);
console.log('With maintenancePlanId:', countWithPlan);
console.log('Scheduled PMs:', countScheduledPM);
console.log('excel_ur count:', countExcelUr);
