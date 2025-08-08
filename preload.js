// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runPythonScript: (args) => ipcRenderer.invoke('run-python-script', args),
  startSSH: (user, host) => ipcRenderer.send('start-ssh', { user, host }),
  sendSSHInput: (data) => ipcRenderer.send('ssh-input', data),
  onSSHData: (callback) => ipcRenderer.on('ssh-data', (event, data) => callback(data)),
  startRDP: (host, username, password) => ipcRenderer.send('start-rdp', { host, username, password }),
  runVNC: (ip) => ipcRenderer.send('run-vnc', ip)
});


contextBridge.exposeInMainWorld('api', {
  pingIp: (ip) => ipcRenderer.invoke('ping-ip', ip)
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-control', 'minimize'),
  maximize: () => ipcRenderer.send('window-control', 'maximize'),
  close: () => ipcRenderer.send('window-control', 'close'),
});

