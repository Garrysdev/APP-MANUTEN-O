const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('G:/rg-maintenance/src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Exact UI text replacements
  content = content.replace(/>Tarefas</g, '>Ordens de Trabalho (OTs)<');
  content = content.replace(/>Tarefa</g, '>Ordem de Trabalho (OT)<');
  content = content.replace(/'Tarefas'/g, "'Ordens de Trabalho (OTs)'");
  content = content.replace(/"Tarefas"/g, '"Ordens de Trabalho (OTs)"');
  content = content.replace(/'Tarefa'/g, "'Ordem de Trabalho (OT)'");
  content = content.replace(/"Tarefa"/g, '"Ordem de Trabalho (OT)"');
  
  content = content.replace(/>Nova Tarefa</g, '>Nova OT<');
  content = content.replace(/'Nova Tarefa'/g, "'Nova OT'");
  content = content.replace(/"Nova Tarefa"/g, '"Nova OT"');

  content = content.replace(/Gestão de Tarefas/g, 'Gestão de OTs');
  content = content.replace(/Gestão de Tarefa/g, 'Gestão de OT');
  
  content = content.replace(/>Sem tarefas/gi, '>Sem OTs');
  content = content.replace(/Nenhuma tarefa/gi, 'Nenhuma OT');
  content = content.replace(/existem tarefas/gi, 'existem OTs');
  
  content = content.replace(/Histórico de Tarefas/g, 'Histórico de OTs');
  content = content.replace(/Volume de Tarefas/g, 'Volume de OTs');
  content = content.replace(/Novas Tarefas/g, 'Novas OTs');
  
  content = content.replace(/ID Tarefa/g, 'ID da OT');
  
  content = content.replace(/tarefa concluída/gi, 'OT concluída');
  content = content.replace(/tarefas em atraso/gi, 'OTs em atraso');
  
  // Specific sentences from dashboard or lists
  content = content.replace(/Ainda não existem tarefas/gi, 'Ainda não existem OTs');
  content = content.replace(/Tens <strong>\{critical\} tarefa/g, 'Tens <strong>{critical} OT');

  if (original !== content) {
    fs.writeFileSync(file, content);
    console.log('Updated:', file);
  }
});
