document.addEventListener('DOMContentLoaded', () => {
    const selectedHost = localStorage.getItem('selectedHost');
    const hostDisplay = document.getElementById('selected-host');
  
    if (!selectedHost) {
      hostDisplay.textContent = "Aucun hôte sélectionné.";
      return;
    }
  
    hostDisplay.textContent = selectedHost;
  
    document.getElementById('ssh-btn').addEventListener('click', () => {
        document.getElementById("auth-section").classList.remove("hidden");
        connect.addEventListener('click', () => {
            const username = document.getElementById('user');
            const password = document.getElementById('password').classList.add("hidden");
            password.required = false; // Rendre le mot de passe non requis pour SSH        
              // Appelle la fonction pour démarrer la connexion RDP
              localStorage.setItem('username', username.value);  
              window.location.href = 'ssh.html';
              
              
        });
    });
  
    document.getElementById('vnc-btn').addEventListener('click', () => {
      alert(`pas encore trouver comment faire pour le VNC`);
    });
  
    document.getElementById('rdp-btn').addEventListener('click', () => {
    document.getElementById("auth-section").classList.remove("hidden");
    connect.addEventListener('click', () => {
        const username = document.getElementById('user');
        const password = document.getElementById('password');        
          // Appelle la fonction pour démarrer la connexion RDP
        window.electronAPI.startRDP(selectedHost, username.value, password.value);
          
          
    });
  });
});  