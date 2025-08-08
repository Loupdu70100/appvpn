// main.js - Fichier principal de votre application Electron

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const ping = require('ping');
const pty = require('node-pty'); // Importation de node-pty pour les terminaux PTY
let mainWindow;

async function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  // Charge le fichier HTML de démarrage
  await mainWindow.loadFile('chargement.html');
  // ping renvoie une promesse
  var res = await ping.promise.probe('10.8.0.1');

  if (res.alive) {
    await mainWindow.loadFile('interface.html');
  } else {
    await mainWindow.loadFile('index.html');
  }

  //mainWindow.webContents.openDevTools();
}

ipcMain.handle('ping-ip', async (event, ip) => {
  try {
    const res = await ping.promise.probe(ip, {
      timeout: 2,
      extra: process.platform === 'win32' ? ['-n', '1'] : ['-c', '1']
    });
    console.log('Ping result:', res);
    return res.alive;
  } catch (error) {
    console.error('Erreur IPC ping:', error);
    return false;
  }
});



app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


// Fonction pour lancer SSH avec node-pty
let ptyProcess = null;

function startSSH(win, user, host) {
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }

  const sshCmd = process.platform === 'win32' 
    ? 'C:\\Windows\\System32\\OpenSSH\\ssh.exe'  // ou chemin ssh.exe adapté
    : 'ssh';

  ptyProcess = pty.spawn(sshCmd, [`${user}@${host}`], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || process.env.USERPROFILE,
    env: process.env
  });

  ptyProcess.onData(data => {
    win.webContents.send('ssh-data', data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    win.webContents.send('ssh-data', `\r\n[SSH terminé avec code ${exitCode}]\r\n`);
    ptyProcess = null;
    mainWindow.loadFile('option.html');
  });
}

ipcMain.on('start-ssh', (event, { user, host }) => {
  startSSH(BrowserWindow.fromWebContents(event.sender), user, host);
});

ipcMain.on('ssh-input', (event, input) => {
  if (ptyProcess) {
    ptyProcess.write(input);
  }
});

function startRDP(win, host, username, password) {
  // Prépare les arguments pour mstsc
  // Note : mstsc ne prend pas le mot de passe en paramètre par défaut
  // Il faut gérer ça via un fichier .rdp ou un outil tiers (attention sécurité)

  // Crée un fichier .rdp temporaire pour stocker les infos (optionnel)
  const rdpFileContent = `
full address:s:${host}
username:s:${username}
prompt for credentials:i:1
  `.trim();

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tmpRdpPath = path.join(os.tmpdir(), 'temp_connection.rdp');
  fs.writeFileSync(tmpRdpPath, rdpFileContent);

  const mstsc = spawn('mstsc', [tmpRdpPath], {
    detached: true,
    stdio: 'ignore'
  });
  mstsc.unref();

  // Tu peux aussi simplement faire spawn('mstsc', ['/v:' + host]) si tu préfères sans fichier
}

ipcMain.on('start-rdp', (event, { host, username, password }) => {
  startRDP(BrowserWindow.fromWebContents(event.sender), host, username, password);
});


ipcMain.on('run-vnc', (event, ip) => {
   pathvnc = '"C:\\Program Files\\RealVNC\\VNC Viewer\\vncviewer.exe"';
  exec(`${pathvnc} ${ip}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Erreur : ${error.message}`);
      return;
    }
    console.log(`VNC lancé vers ${ip}`);
  });
});

// Contrôles fenêtre
ipcMain.on('window-control', (event, action) => {
  if (action === 'minimize') mainWindow.minimize();
  else if (action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  else if (action === 'close') mainWindow.close();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});




// --- Gestion de la communication entre le processus de rendu (Renderer) et le processus principal (Main) ---

/**
 * @function getPythonExecutablePath
 * @description Détermine le chemin de l'exécutable Python pour le mode production.
 * @returns {string} Le chemin absolu de l'exécutable Python généré par PyInstaller.
 */
function getPythonExecutablePath() {
  // En mode production, l'exécutable PyInstaller (script.exe ou script)
  // est inclus dans le package Electron dans le dossier 'resources/python/'.
  // 'process.resourcesPath' pointe vers ce dossier 'resources'.
  const executableName = process.platform === 'win32' ? 'script.exe' : 'script';
  // Le chemin 'python/script.exe' (ou 'python/script') est celui que vous avez défini
  // dans la section 'extraFiles' de votre package.json avec "to": "python/script.exe".
  return path.join('python', executableName);
}

/**
 * @function ipcMain.handle('run-python-script')
 * @description Gère les requêtes 'run-python-script' envoyées par le processus de rendu.
 * Lance l'exécutable Python avec les arguments fournis et renvoie la sortie.
 */
ipcMain.handle('run-python-script', async (event, argsFromRenderer) => {
  return new Promise((resolve, reject) => {
    const pythonExecutable = getPythonExecutablePath();
    // En mode production, l'exécutable PyInstaller est directement le script.
    // Donc, le premier argument de 'scriptArgs' est l'argument JSON que vous voulez lui passer.
    const scriptArgs = [argsFromRenderer];

    console.log(`[Main Process] Lancement de: ${pythonExecutable} avec arguments: ${scriptArgs.join(' ')}`);

    // Lance le processus Python (l'exécutable PyInstaller)
    const pythonProcess = spawn(pythonExecutable, scriptArgs);

    const readline = require('readline');

    let jsonLine = null;

    const rl = readline.createInterface({
      input: pythonProcess.stdout,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      console.log('[Python stdout]', line);
      try {
        const maybe = JSON.parse(line);
        jsonLine = maybe;
      } catch (e) {
        // Pas du JSON, on ignore
      }
    });

    let pythonError = '';

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Main Process] Le script Python a échoué avec le code ${code}. Erreur: ${pythonError.trim()}`);
        reject(`Erreur Python (Code ${code}): ${pythonError.trim() || 'Erreur inconnue'}`);
      } else if (!jsonLine) {
        console.error(`[Main Process] Aucune ligne JSON valide n'a été trouvée dans la sortie.`);
        reject(`Erreur de format de sortie Python : aucune sortie JSON trouvée.`);
      } else {
        console.log(`[Main Process] JSON extrait du script Python:`, jsonLine);
        resolve(jsonLine);
      }
    });


    pythonProcess.on('error', (err) => {
      console.error('[Main Process] Échec du démarrage du processus Python:', err);
      reject(`Impossible de lancer le script Python. Vérifiez le chemin et les permissions. Erreur: ${err.message}`);
    });
  });
});