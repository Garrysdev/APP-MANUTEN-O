import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Load fallback tasks
const raw = readFileSync('scripts/import/tasks.json', 'utf-8');
const json = JSON.parse(raw);

const filtered = json
  .filter((item) => {
    if (item.source === 'excel_ur' || item.id?.startsWith('task_excel_ur_')) return true;
    const isScheduledPM = Boolean(
      item.source === 'pm_agendamento_2026' ||
      item.source === 'pm_anual_paragem_verao_2026' ||
      item.source === 'plan' ||
      (item.title && (item.title.startsWith('[PM]') || item.title.startsWith('[MP]'))) ||
      item.maintenancePlanId
    );
    return !isScheduledPM;
  });

console.log(`Total tasks after filter: ${filtered.length}`);
const excelUrCount = filtered.filter(t => t.source === 'excel_ur').length;
console.log(`excel_ur tasks: ${excelUrCount}`);
console.log(`First task:`, filtered[0].title);
console.log(`Last task:`, filtered[filtered.length - 1].title);
