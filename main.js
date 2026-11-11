const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const express = require('express');
const fs = require('fs');

// Start embedded Express server for state sync
const expressApp = express();
const PORT = 3030;
const STATE_FILE = path.join(__dirname, 'state.json');

expressApp.use(express.json());
expressApp.get('/api/state', (req, res) => {
  if (fs.existsSync(STATE_FILE)) {
    res.json(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } else {
    res.json({ agents: [], activityLog: [] });
  }
});

expressApp.listen(PORT, () => {
  console.log(`Dashboard state API running on http://localhost:${PORT}`);
});

let mainWindow;
let ptyProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Initialize PTY terminal
  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME || process.cwd(),
    env: process.env
  });

  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-output', data);
    }
  });

  ipcMain.on('terminal-input', (event, data) => {
    ptyProcess.write(data);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (ptyProcess) ptyProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
