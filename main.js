const { app, BrowserWindow, screen } = require('electron')

function createWindow () {
  const primaryDisplay = screen.getPrimaryDisplay()
  const screenHeight = primaryDisplay.size.height
  
  const overlayWidth = 260
  const windowHeight = 420 // Chiều cao cố định (bao gồm bar 40px và popup)

  const win = new BrowserWindow({
    width: overlayWidth,
    height: windowHeight,
    x: 0,
    y: screenHeight - windowHeight,
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

  win.setAlwaysOnTop(true, 'screen-saver')

  win.on('blur', () => {
    win.setAlwaysOnTop(true, 'screen-saver')
  })

  setInterval(() => {
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver')
    }
  }, 10000)

  win.loadFile('index.html')
}

app.whenReady().then(() => {
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



