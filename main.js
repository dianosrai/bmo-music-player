const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
function createWindow() {
  const win = new BrowserWindow({
    width: 320,
    height: 500,
    icon: path.join(__dirname, 'icon.ico'),
    frame: false,
    transparent: true,
    skipTaskbar: false,
    resizable: true,
    minWidth: 320,
    minHeight: 500,
    maxWidth: 320,
    maxHeight: 500,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setMenu(null);
  Menu.setApplicationMenu(null);
  win.loadFile('index.html');

  ipcMain.on('minimize-window', () => win.minimize());
  ipcMain.on('close-window', () => win.close());

  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose Music File',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('read-metadata', async (event, filePath) => {
    try {
      const { parseFile } = await import('music-metadata');
      const metadata = await parseFile(filePath);
      const common = metadata.common;

      let artworkDataUrl = null;
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        // Ensure data is a proper Buffer
        const data = Buffer.isBuffer(pic.data) ? pic.data : Buffer.from(pic.data);
        const base64 = data.toString('base64');
        // Normalize MIME type (some tags return 'jpeg' instead of 'image/jpeg')
        let format = pic.format || 'image/jpeg';
        if (!format.includes('/')) {
          format = `image/${format.toLowerCase()}`;
        }
        artworkDataUrl = `data:${format};base64,${base64}`;
      }

      return {
        title: common.title || path.basename(filePath, path.extname(filePath)),
        artist: common.artist || '',
        artwork: artworkDataUrl,
        duration: metadata.format.duration || 0
      };
    } catch (e) {
      console.error('Metadata read error:', e);
      return {
        title: path.basename(filePath, path.extname(filePath)),
        artist: '',
        artwork: null,
        duration: 0
      };
    }
  });

  ipcMain.handle('get-folder-songs', async (event, filePath) => {
    const AUDIO_EXTS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'];
    const folder = path.dirname(filePath);
    try {
      const files = fs.readdirSync(folder)
        .filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map(f => path.join(folder, f));
      return files;
    } catch (e) {
      console.error('Folder scan error:', e);
      return [filePath];
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
