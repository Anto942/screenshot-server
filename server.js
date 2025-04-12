const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
app.use(express.json());

// Configuration Puppeteer
const launchOptions = {
  headless: "new",
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1920, height: 1080 }
};

// Endpoint de capture
app.post('/api/capture', async (req, res) => {
  const { url, coordinates, captureType, commune, address, postalCode } = req.body;
  
  try {
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    let targetUrl = url;
    
    // Déterminer l'URL en fonction du type de capture
    if (captureType === 'cadastre' && coordinates) {
      targetUrl = `https://cadastre.data.gouv.fr/map?lat=${coordinates.lat}&lon=${coordinates.lon}&zoom=19`;
    } else if (captureType === 'radon' && commune) {
      targetUrl = `https://www.irsn.fr/carte-radon/commune/${commune}`;
    } else if (captureType === 'georisques' && address && postalCode) {
      targetUrl = `https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi`;
    } else if (captureType === 'aerial' && coordinates) {
      targetUrl = `https://www.google.com/maps/@${coordinates.lat},${coordinates.lon},18z/data=!3m1!1e3`;
    }
    
    if (!targetUrl) {
      throw new Error('URL de destination non spécifiée');
    }
    
    console.log(`Navigating to: ${targetUrl}`);
    
    // Navigation et interactions
    await page.goto(targetUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Gérer les cas spécifiques selon le type
    if (captureType === 'cadastre') {
      await page.waitForSelector('.leaflet-layer', { timeout: 15000 });
    } else if (captureType === 'georisques' && address && postalCode) {
      // Remplir le formulaire Georisques
      await page.waitForSelector('input[placeholder*="adresse"]', { timeout: 10000 });
      await page.type('input[placeholder*="adresse"]', address);
      await page.waitForTimeout(1000);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }
    
    // Attendre pour être sûr que tout est chargé
    await page.waitForTimeout(3000);
    
    // Capture
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
      encoding: 'binary'
    });

    await browser.close();

    // Réponse
    res.set('Content-Type', 'image/png');
    res.send(screenshotBuffer);

  } catch (error) {
    console.error(`Erreur Puppeteer : ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Démarrage serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
