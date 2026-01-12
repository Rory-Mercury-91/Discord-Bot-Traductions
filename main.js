const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || null;
  if(devUrl){
    // En dev, charger le serveur Vite
    win.loadURL(devUrl).catch(err=>{
      console.error('Failed to load dev server:', err);
    });
  } else {
    // production : charger le build front
    const prodIndex = path.join(__dirname, 'dist', 'frontend', 'index.html');
    if(require('fs').existsSync(prodIndex)){
      win.loadFile(prodIndex);
    } else {
      console.error('Frontend build not found. Run: npm run build');
    }
  }
  // win.webContents.openDevTools(); // décommenter pour debug
}

app.whenReady().then(async () => {
  // Create images directory
  const imagesDir = path.join(app.getPath('userData'), 'images');
  await fsp.mkdir(imagesDir, { recursive: true });
  
  createWindow();
});

// --- Publisher IPC & simple config persistence ---
const CONFIG_FILE = path.join(app.getPath('userData'), 'publisher_config.json');
const DEFAULT_PUBLISHER = { apiUrl: '', apiKey: '' };

function readPublisherConfig(){
  try{
    if(fs.existsSync(CONFIG_FILE)){
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw || '{}');
    }
  }catch(e){}
  return DEFAULT_PUBLISHER;
}
function writePublisherConfig(cfg){
  try{ fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg||{})); return true; }catch(e){ return false; }
}

ipcMain.handle('publisher:get-config', () => {
  return readPublisherConfig();
});
ipcMain.handle('publisher:set-config', (ev, cfg) => {
  const cur = readPublisherConfig();
  const next = Object.assign({}, cur, cfg || {});
  writePublisherConfig(next);
  return next;
});

ipcMain.handle('publisher:test-connection', async (ev, config) => {
  const apiUrl = config?.apiUrl || '';
  const apiKey = config?.apiKey || '';
  
  if(!apiUrl) return { ok:false, error:'URL API manquante' };

  try{
    const headers = {};
    if(apiKey) headers['X-API-KEY'] = apiKey;

    // Simple GET request to test if API is reachable
    const resp = await fetch(apiUrl, { method: 'GET', headers });
    
    if(resp.ok || resp.status === 404 || resp.status === 405) {
      // 200 OK, 404 Not Found, or 405 Method Not Allowed all indicate the server is reachable
      return { ok:true, status: resp.status };
    }
    
    return { ok:false, error: `HTTP ${resp.status}`, status: resp.status };
  }catch(e){
    return { ok:false, error: String(e?.message || e) };
  }
});

ipcMain.handle('publisher:publish', async (ev, payload) => {
  const cfg = readPublisherConfig();
  if(!cfg || !cfg.apiUrl) return { ok:false, error:'missing_api_url' };

  try{
    // Check if this is an update (PATCH) or new post (POST)
    const isUpdate = payload.isUpdate && payload.threadId && payload.messageId;
    const method = isUpdate ? 'PATCH' : 'POST';
    const url = isUpdate 
      ? `${cfg.apiUrl}/${payload.threadId}/${payload.messageId}`
      : cfg.apiUrl;

    // Build FormData (Node 18+ provides global FormData / Blob)
    const form = new FormData();
    form.append('title', payload.title || 'Publication');
    form.append('content', payload.content || '');
    form.append('tags', payload.tags || '');
    form.append('template', payload.template || '');

    // Handle multiple images
    if(payload.images && Array.isArray(payload.images) && payload.images.length > 0) {
      for(let i = 0; i < payload.images.length; i++) {
        const img = payload.images[i];
        if(!img.dataUrl) continue;
        
        const parts = img.dataUrl.split(',');
        const meta = parts[0] || '';
        const data = parts[1] || '';
        const m = meta.match(/data:([^;]+);/);
        const contentType = m ? m[1] : 'application/octet-stream';
        const buffer = Buffer.from(data || '', 'base64');
        const blob = new Blob([buffer], { type: contentType });
        form.append(`image_${i}`, blob, img.filename || `image_${i}.png`);
        
        // Mark which image is main
        if(img.isMain) {
          form.append('main_image_index', String(i));
        }
      }
    }
    // Legacy support for single image (backwards compatibility)
    else if(payload.imageDataUrl) {
      const parts = payload.imageDataUrl.split(',');
      const meta = parts[0] || '';
      const data = parts[1] || '';
      const m = meta.match(/data:([^;]+);/);
      const contentType = m ? m[1] : 'application/octet-stream';
      const buffer = Buffer.from(data || '', 'base64');
      const blob = new Blob([buffer], { type: contentType });
      form.append('image_0', blob, payload.imageFilename || 'image.png');
      form.append('main_image_index', '0');
    }

    const headers = {};
    if(cfg.apiKey) headers['X-API-KEY'] = cfg.apiKey;

    const resp = await fetch(url, { method, body: form, headers });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok) return { ok:false, error: data?.error || JSON.stringify(data), status: resp.status };
    return { ok:true, data };
  }catch(e){
    return { ok:false, error: String(e?.message || e) };
  }
});

// Export config to file (native dialog)
ipcMain.handle('config:export', async (ev, config) => {
  try{
    const result = await dialog.showSaveDialog({ title: 'Exporter la configuration', defaultPath: 'publisher_config.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if(result.canceled || !result.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2));
    return { ok:true, path: result.filePath };
  }catch(e){
    return { ok:false, error: String(e?.message || e) };
  }
});

// Import config from file (native dialog)
ipcMain.handle('config:import', async () => {
  try{
    const result = await dialog.showOpenDialog({ title: 'Importer la configuration', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    if(result.canceled || !result.filePaths || !result.filePaths[0]) return { ok:false, canceled:true };
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    return { ok:true, config: parsed };
  }catch(e){
    return { ok:false, error: String(e?.message || e) };
  }
});

// Export template to file (native dialog)
ipcMain.handle('template:export', async (ev, template) => {
  try{
    const safeName = (template.name || 'template').replace(/[^a-zA-Z0-9-_]/g, '_');
    const result = await dialog.showSaveDialog({ 
      title: 'Exporter le template', 
      defaultPath: `${safeName}.json`, 
      filters: [{ name: 'JSON', extensions: ['json'] }] 
    });
    if(result.canceled || !result.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(result.filePath, JSON.stringify(template, null, 2));
    return { ok:true, path: result.filePath };
  }catch(e){
    return { ok:false, error: String(e?.message || e) };
  }
});

// Import template from file (native dialog)
ipcMain.handle('template:import', async () => {
  try{
    const result = await dialog.showOpenDialog({ 
      title: 'Importer un template', 
      filters: [{ name: 'JSON', extensions: ['json'] }], 
      properties: ['openFile'] 
    });
    if(result.canceled || !result.filePaths || !result.filePaths[0]) return { ok:false, canceled:true };
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    return { ok:true, template: parsed };
  }catch(e){
    return { ok:false, error: String(e?.message || e) };
  }
});

// --- Images filesystem operations ---
const IMAGES_DIR = () => path.join(app.getPath('userData'), 'images');

// Save image: copy from source to userData/images with unique name
ipcMain.handle('images:save', async (ev, sourceFilePath) => {
  try{
    const fileName = `image_${Date.now()}_${path.basename(sourceFilePath)}`;
    const destPath = path.join(IMAGES_DIR(), fileName);
    await fsp.copyFile(sourceFilePath, destPath);
    return { ok: true, fileName };
  }catch(e){
    return { ok: false, error: String(e?.message || e) };
  }
});

// Read image: return buffer for display or publication
ipcMain.handle('images:read', async (ev, imagePath) => {
  try{
    const fullPath = path.join(IMAGES_DIR(), imagePath);
    const buffer = await fsp.readFile(fullPath);
    return { ok: true, buffer: Array.from(buffer) }; // Convert Buffer to array for IPC
  }catch(e){
    return { ok: false, error: String(e?.message || e) };
  }
});

// Delete image: remove file from filesystem
ipcMain.handle('images:delete', async (ev, imagePath) => {
  try{
    const fullPath = path.join(IMAGES_DIR(), imagePath);
    await fsp.unlink(fullPath);
    return { ok: true };
  }catch(e){
    return { ok: false, error: String(e?.message || e) };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});