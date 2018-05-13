// External modules
const {app, BrowserWindow} = require('electron');
const ipcMain = require('electron').ipcMain;
const path = require('path');
const url = require('url');

// Global reference to window object
let win;

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({width: 800, height: 600});

  // Load index.html
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Open the DevTools
  // win.webContents.openDevTools();

  // Maximise
  win.maximize();

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object to allow the gc to destroy it
    win = null;
  });
}

// Initialisation complete, create the window
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

ipcMain.on('reload', () => {
  // Set app to re-launch after exit
  app.relaunch();

  // Quit the app
  app.quit();
});
