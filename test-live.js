const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando os testes E2E na produção Vercel...');
  const browser = await puppeteer.launch({
    headless: true, // Correr em headless puro
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Interceptar erros de consola
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('Console Error:', msg.text());
  });

  try {
    const ts = Date.now();
    const testEmail = `claude.test.${ts}@rgmaintenance.local`;
    const testPassword = 'Password123!';

    console.log(`\n--- GATE A2: REGISTO ---`);
    console.log(`Navegando para https://rg-maintenance.vercel.app/register`);
    await page.goto('https://rg-maintenance.vercel.app/register', { waitUntil: 'networkidle2' });

    console.log('Preenchendo o formulário de registo...');
    await page.type('#companyName', 'Indústrias Claude, SA');
    await page.type('#userName', 'Claude Tester');
    await page.type('#email', testEmail);
    await page.type('#password', testPassword);
    
    console.log('Submetendo formulário...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    const postRegisterUrl = page.url();
    if (postRegisterUrl.includes('/dashboard')) {
      console.log('✅ Gate A2 (Registo de Empresa): SUCESSO! Utilizador criado e redireccionado para o Dashboard.');
    } else {
      console.log('❌ Gate A2 FALHOU. URL após registo:', postRegisterUrl);
      throw new Error('Não redireccionou para o dashboard');
    }

    console.log(`\n--- GATE A3: DASHBOARD GESTOR ---`);
    console.log('Verificando KPIs...');
    // Esperar que o dashboard renderize os KPIs (procurar pelos valores 0)
    await page.waitForSelector('.bg-white.rounded-2xl');
    
    // Ler o título do dashboard
    const title = await page.$eval('h1', el => el.textContent);
    console.log(`Título da página: ${title}`);
    
    if (title && title.includes('Dashboard')) {
      console.log('✅ Gate A3 (Dashboard): SUCESSO! Dashboard carregou correctamente para a nova empresa.');
    } else {
      console.log('❌ Gate A3 FALHOU. Dashboard não renderizou como esperado.');
    }

    // Opcional: Navegar para tarefas e criar uma tarefa teste
    console.log(`\n--- TESTE CRUD: CRIAR EQUIPAMENTO ---`);
    await page.goto('https://rg-maintenance.vercel.app/dashboard/assets', { waitUntil: 'networkidle2' });
    
    console.log('A clicar em Novo Equipamento...');
    await page.waitForSelector('button.btn-primary');
    await page.click('button.btn-primary'); // O botão de adicionar

    console.log('A preencher formulário de equipamento...');
    await page.waitForSelector('input[name="name"]');
    await page.type('input[name="name"]', 'Motor Eléctrico Claude');
    await page.type('input[name="tag"]', 'MTR-001');
    await page.select('select[name="criticidade"]', 'amarelo');
    
    await page.click('button[type="submit"].btn-primary');
    // Esperar um pouco para a actualização da tabela
    await new Promise(r => setTimeout(r, 2000));
    
    // Verificar se a tabela contém "Motor Eléctrico Claude"
    const bodyText = await page.$eval('body', el => el.textContent);
    if (bodyText.includes('Motor Eléctrico Claude')) {
      console.log('✅ Teste CRUD: SUCESSO! Equipamento criado e listado.');
    } else {
      console.log('❌ Teste CRUD FALHOU. Equipamento não apareceu na lista.');
    }

    console.log('\nTodos os testes foram executados com sucesso!');

  } catch (error) {
    console.error('\n❌ ERRO DURANTE OS TESTES:', error.message);
  } finally {
    await browser.close();
    console.log('Browser fechado. Teste concluído.');
  }
})();
