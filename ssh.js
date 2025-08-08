const user = localStorage.getItem('username');
const host = localStorage.getItem('selectedHost');
const term = new Terminal();

term.open(document.getElementById('terminal'));

window.electronAPI.startSSH(user, host);

window.electronAPI.onSSHData(data => {
  term.write(data);
});

term.onData(data => {
  window.electronAPI.sendSSHInput(data);
});

term.write('Connexion SSH en cours...\r\n');
