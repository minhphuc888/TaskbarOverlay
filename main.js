const { app, BrowserWindow, screen, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

const APP_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'DrinkWaterApp');
const CONFIG_FILE_PATH = path.join(APP_DIR, 'config.json');

let mainWindow = null;
let settingsWin = null;

function getInitialPosition() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
      return config.tabPositionX || 0;
    }
  } catch(e) {}
  return 0;
}

let currentX = getInitialPosition();

function createWindow () {
  const primaryDisplay = screen.getPrimaryDisplay()
  const screenWidth = primaryDisplay.size.width
  const screenHeight = primaryDisplay.size.height
  
  const overlayWidth = 480
  const collapsedHeight = 48 // Chiều cao thanh taskbar chuẩn Win 11

  mainWindow = new BrowserWindow({
    width: overlayWidth,
    height: collapsedHeight,
    x: currentX,
    y: screenHeight - collapsedHeight,
    icon: path.join(__dirname, 'icon.png'),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  mainWindow.on('blur', () => {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
  })

  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
    }
  }, 10000)

  mainWindow.loadFile('index.html')
}

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show()
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 780,
    height: 720,
    center: true,
    icon: path.join(__dirname, 'icon.png'),
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  settingsWin.loadFile('settings.html')
  settingsWin.on('closed', () => {
    settingsWin = null
    // Revert tab position and notify renderer to reload config in case of preview cancel
    currentX = getInitialPosition();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      mainWindow.setBounds({
        x: currentX,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      });
      mainWindow.webContents.send('config-updated')
    }
  })
}

ipcMain.on('open-settings', () => {
  openSettingsWindow()
})

ipcMain.on('close-settings', () => {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.close()
  }
})

ipcMain.on('config-updated', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('config-updated')
  }
})

ipcMain.on('expand-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const screenWidth = primaryDisplay.size.width
    const screenHeight = primaryDisplay.size.height
    const bounds = mainWindow.getBounds()
    mainWindow.setBounds({
      x: currentX,
      y: screenHeight - 420,
      width: bounds.width,
      height: 420
    })
  }
})

ipcMain.on('collapse-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const screenWidth = primaryDisplay.size.width
    const screenHeight = primaryDisplay.size.height
    const bounds = mainWindow.getBounds()
    mainWindow.setBounds({
      x: currentX,
      y: screenHeight - 48,
      width: bounds.width,
      height: 48
    })
  }
})

ipcMain.on('update-width', (event, newWidth) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const bounds = mainWindow.getBounds()
    if (bounds.width !== newWidth) {
      mainWindow.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: newWidth,
        height: bounds.height
      })
    }
  }
})

ipcMain.on('preview-config', (event, tempConfig) => {
  currentX = parseInt(tempConfig.tabPositionX) || 0;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: currentX,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
    mainWindow.webContents.send('preview-config', tempConfig)
  }
})

ipcMain.on('data-updated', () => {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('data-updated')
  }
})

app.whenReady().then(() => {
  // Set up auto-launch on startup
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    path: app.getPath('exe')
  })

  createWindow()
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
