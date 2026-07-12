const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    const testEmail = 'demo@rgmaintenance.pt';
    const testPassword = 'Password123!';

    console.log(`Navegando para https://rg-maintenance.vercel.app/register`);
    await page.goto('https://rg-maintenance.vercel.app/register', { waitUntil: 'networkidle2' });

    console.log(`Preenchendo formulário com email Fixo: ${testEmail}`);
    await page.type('#companyName', 'Empresa de Demonstração');
    await page.type('#userName', 'Rui (Demo)');
    await page.type('#email', testEmail);
    await page.type('#password', testPassword);
    
    console.log('A submeter...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    const url = page.url();
    if (url.includes('/dashboard')) {
      console.log('SUCESSO! Conta criada com sucesso.');
    } else {
      console.log('ERRO! O URL final foi: ' + url);
      // Pode ser que o email já exista
      const bodyText = await page.$eval('body', el => el.textContent);
      console.log('Conteúdo da página: ' + bodyText.substring(0, 200));
    }
  } catch (err) {
    console.error('Falhou:', err.message);
  } finally {
    await browser.close();
  }
})();
