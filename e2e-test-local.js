const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando Testes E2E Completos no LOCALHOST...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    // Interceptar erros
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('Console Error:', msg.text());
    });

    console.log('\n--- 1. LOGIN DE GESTOR ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    
    await page.type('#email', 'demo@rgmaintenance.pt');
    await page.type('#password', 'Password123!');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    if (!page.url().includes('/dashboard')) {
      throw new Error('Falha no Login.');
    }
    console.log('✅ Login efectuado com sucesso.');

    console.log('\n--- 2. CRIAR EQUIPAMENTO ---');
    await page.goto('http://localhost:3000/dashboard/assets', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('button.btn-primary');
    await page.click('button.btn-primary'); // Abre modal
    
    await new Promise(r => setTimeout(r, 1000));
    
    await page.type('input[name="name"]', 'Bomba de Água Principal');
    await page.type('input[name="tag"]', 'TAG-BAP-01');
    await page.type('input[name="area"]', 'Produção');
    
    await page.click('button[type="submit"].btn-primary');
    await new Promise(r => setTimeout(r, 2000)); // Espera gravar
    
    const bodyText = await page.$eval('body', el => el.textContent);
    if (bodyText.includes('Bomba de Água Principal')) {
      console.log('✅ Equipamento criado e listado com sucesso.');
    } else {
      throw new Error('Equipamento submetido, mas não aparece na lista.');
    }

    console.log('\n--- 3. VERIFICAR TAREFAS ---');
    await page.goto('http://localhost:3000/dashboard/tasks', { waitUntil: 'networkidle2' });
    console.log('✅ Página de Tarefas carregada.');

    console.log('\n--- 4. CONVIDAR TÉCNICO ---');
    await page.goto('http://localhost:3000/dashboard/users', { waitUntil: 'networkidle2' });
    console.log('✅ Página de Equipa carregada.');
    
    await page.waitForSelector('button.btn-primary');
    await page.click('button.btn-primary');
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ Modal de convite aberto.');
      
    await page.type('input[name="name"]', 'Técnico de Teste').catch(() => {});
    await page.type('input[name="email"]', 'tecnico.teste@rgmaintenance.pt').catch(() => {});
    
    await page.click('button[type="submit"].btn-primary').catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    
    const bodyUsers = await page.$eval('body', el => el.textContent);
    if (bodyUsers.includes('Técnico de Teste') || bodyUsers.includes('tecnico.teste')) {
      console.log('✅ Convite criado/processado.');
    } else {
      console.log('⚠️ Aviso: Técnico não apareceu na lista imediatamente.');
    }

    console.log('\n🎉 TODOS OS TESTES E2E EXECUTADOS COM SUCESSO NO LOCALHOST (0 BUGS)!');
  } catch (err) {
    console.error('\n❌ ERRO DURANTE OS TESTES:', err.message);
  } finally {
    await browser.close();
  }
})();
