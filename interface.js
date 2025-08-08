
const container = document.getElementById("machine-grid");
const container2 = document.getElementById("machine-list");
const refreshButton = document.getElementById('refresh');
const toggle = document.getElementById('toggle');
const icon = document.getElementById('icon');
const svgCarte = `
  <svg class="w-4 h-4 text-gray-700" fill="none" stroke="black" stroke-width="1.5" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round"
          d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 
          1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6A1.125 1.125 0 0 
          1 2.25 10.875v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 
          0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 
          1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM3.75 
          16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 
          1.125v2.25c0 .621-.504 1.125-1.125 
          1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z" />
  </svg>`;
const svgListe = `
<svg class="w-4 h-4 text-white" fill="none" stroke="black" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
</svg>`;



toggle.addEventListener('change', () => {
  icon.innerHTML = toggle.checked ? svgListe : svgCarte;
  if (toggle.checked) {
    container.classList.add('hidden');
    container2.classList.remove('hidden');
  } else { 
    container.classList.remove('hidden');
    container2.classList.add('hidden');
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const hosts = await getVpnHosts(); // Liste IPs (["10.8.0.1", ...])
  const peersInfo = await getPeersInfo(hosts); // Infos sur les pairs
  container.innerHTML = hosts.map(peer => {
    const info = peersInfo.find(p => p.publicKey === peer.publicKey);
    return createMachineCard(peer, info);
  }).join('');
  container2.innerHTML = hosts.map(createMachineListItem).join('');
    refreshButton.addEventListener('click', () => {
    refreshData(); // rafraîchir tout
  });


  // Gestion du clic sur les boutons SSH/RDP/VNC
  container.addEventListener('click', (event) => {
    const button = event.target.closest('.action-btn');
    if (!button) return;

    const ip = button.dataset.ip;
    const type = button.dataset.type;

    prepareAuth(ip, type);
  });

  document.querySelectorAll('.option-btn').forEach(button => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();

    // Supprime la bulle précédente si elle existe
    const oldBubble = document.getElementById('option-bubble');
    if (oldBubble) oldBubble.remove();

    const bubble = document.createElement('div');
    bubble.id = 'option-bubble';

    bubble.className = `
      absolute bg-white border border-gray-300 p-2 rounded-lg shadow-lg z-50 flex flex-col space-y-2
    `;


    // Le contenu du menu
    bubble.innerHTML = `
      <button id="editBtn" class="mr-2 px-2 py-1 bg-white hover:bg-gray-300 text-black rounded-xl">Modifier</button>
      <button id="deleteBtn" class="px-2 py-1 bg-white hover:bg-gray-300 text-black rounded-xl">Supprimer</button>
    `;

    // Création du petit triangle (flèche)
    const triangle = document.createElement('div');
    triangle.className = `
      absolute top-[0px] left-[-10px] top-3 w-0 h-0 border-t-[8px] border-b-[8px] border-r-[10px] border-t-transparent border-b-transparent border-r-white drop-shadow-sm
    `;

    bubble.appendChild(triangle);

    // Positionnement de la bulle par rapport au bouton
    const rect = button.getBoundingClientRect();
    bubble.style.top = `${rect.top + window.scrollY}px`;
    bubble.style.left = `${rect.right + window.scrollX + 10}px`;

    document.body.appendChild(bubble);

    // Gestion des clics sur les boutons de la bulle
    bubble.querySelector('#editBtn').addEventListener('click', () => {
      //alert(`Modifier peer ${button.dataset.publickey}`);
      // rediriger vers une page de modification
      window.location.href = `./editpeer.html?publicKey=${encodeURIComponent(button.dataset.publickey)}`;
      bubble.remove();
    });

    bubble.querySelector('#deleteBtn').addEventListener('click', () => {
      bubble.remove();
      const confirmation = document.createElement('div');
      confirmation.id = 'delete-confirmation';
      confirmation.className = 'absolute bg-white border border-gray-300 p-2 rounded-lg shadow-lg z-50 flex flex-col space-y-2';
      confirmation.innerHTML = `        <p class="text-black">Êtes-vous sûr de vouloir supprimer ce peer ?</p>
        <button id="confirmDelete" class="bg-red-600 text-white px-2 py-1 rounded-md">Confirmer</button>
        <button id="cancelDelete" class="bg-gray-300 text-black px-2 py-1 rounded-md">Annuler</button>
      `;
      confirmation.style.top = `${rect.top + window.scrollY}px`;
      confirmation.style.left = `${rect.right + window.scrollX + 10}px`;
      confirmation.appendChild(triangle);
      document.body.appendChild(confirmation);
      confirmation.querySelector('#confirmDelete').addEventListener('click', async() => {
        // Logique de suppression du peer
        console.log(`Suppression du peer ${button.dataset.publickey}`);
         try {
              const response = await fetch(`http://192.168.1.103:5000/deletepeer/${button.dataset.publickey}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
                // pas besoin de body ici, la clé est dans l'URL
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors de la suppression');
              }

              const data = await response.json();
              console.log(data.message); // "Pair XXX supprimé avec succès."
            } catch (err) {
              console.error('Erreur:', err.message);
            }
      confirmation.innerHTML = `<p class="text-black">Peer supprimé avec succès.</p>`;
      setTimeout(() => {  
        confirmation.remove();
      }, 3000);
      });
      // Annuler la suppression
      confirmation.querySelector('#cancelDelete').addEventListener('click', () => {
        confirmation.remove();
      });


    });

    // Clic ailleurs ferme la bulle
    document.addEventListener('click', function onDocClick(e) {
      if (!bubble.contains(e.target) && e.target !== button) {
        bubble.remove();
        document.removeEventListener('click', onDocClick);
      }
    });
  });
});

});

async function getVpnHosts() {
  try {
    const response = await fetch('http://10.8.0.1:5000/wg-peers');
    if (!response.ok) throw new Error('Erreur réseau');
    const peers = await response.json();
    // filtrer les pairs pour qu'il ny ait que les machines srv client donc 10.8.0.0/24 pas 10.8.1.0/24
    return peers.filter(peer => peer.allowedIps.some(ip => ip.startsWith('10.8.0.')));
  } catch (error) {
    console.error('Erreur récupération VPN hosts:', error);
    return [];
  }
}

async function getPeersInfo(peers) {
    try {
        const response = await fetch('http://10.8.0.1:5000/getinfo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ peers }), // on envoie un objet { peers: [...] }
        });

        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Erreur lors de la récupération des peers:', error.message);
        return [];
    }
}


// Création carte UI

//faire passer data en parametre pour pouvoir mettre le nom du client
function createMachineCard(peer, info) {
    const ip = peer.allowedIps[0].replace('/32', '');
    const publicKey = peer.publicKey;
    const clientName = info.info?.nom || 'Nom inconnu'; // Nom du client si disponible
    const osVersion = info.info?.os || 'OS inconnu'; // Version de l'OS si disponible
    console.log(info);
  return `
    <div class="machine-card bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col gap-2" data-ip="${ip}">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-green-500"></span>
        <h2 class="text-lg font-semibold">${clientName}</h2>
        <div class="justify-end flex-1 flex items-center gap-2">
          <button data-publickey="${publicKey}" id ="option-btn" class="option-btn bg-gray-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md text-sm">...</button>
        </div>
      </div>
      <p class="text-gray-400 text-sm">${ip}</p>
      <p class="text-gray-400 text-sm justify-end">OS: ${osVersion}</p>
      <div class="auth-or-buttons mt-2 flex flex-col gap-2">
        <div class="button-group flex gap-2">
          <button data-ip="${ip}" data-type="ssh" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">SSH</button>
          <button data-ip="${ip}" data-type="rdp" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">RDP</button>
          <button data-ip="${ip}" data-type="vnc" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">VNC</button>
        </div>
      </div>
    </div>
  `;
}

// Liste (non interactive ici, tu peux ajouter les boutons si besoin)
function createMachineListItem(peer) {
  const machine = peer.allowedIps[0].replace('/32', '');
  const publicKey = peer.publicKey; //pas encore utilisé
  return `
    <div class="bg-gray-800 p-4 rounded-xl shadow flex items-center justify-between">
      <div class="flex items-center gap-4">
        <span class="w-3 h-3 rounded-full bg-green-500"></span>
        <div>
          <h2 class="text-lg font-semibold">${machine}</h2>
          <p class="text-gray-400 text-sm">${machine}</p>
        </div>
      </div>
      <div class="flex gap-2">
          <button data-ip="${machine}" data-type="ssh" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">SSH</button>
          <button data-ip="${machine}" data-type="rdp" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">RDP</button>
          <button data-ip="${machine}" data-type="vnc" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">VNC</button>
      </div>
    </div>
  `;
}
// Remplace les boutons par l’auth (dans la carte ciblée)
function prepareAuth(ip, type) {
  const card = document.querySelector(`.machine-card[data-ip="${ip}"]`);
  const container = card.querySelector(".auth-or-buttons");

  container.innerHTML = `
    <div class="flex flex-col gap-2">
      <input type="text" placeholder="Nom d'utilisateur" class="auth-user border p-2 w-full text-black rounded">
      <input type="password" placeholder="Mot de passe" class="auth-pass border p-2 w-full text-black rounded hidden">
      <div class="flex gap-2">
        <button class="auth-connect bg-blue-600 text-white px-4 py-2 rounded">Connexion</button>
        <button class="auth-cancel bg-red-600 text-white px-4 py-2 rounded">Annuler</button>
      </div>
      <p class="auth-error text-red-500 text-sm hidden"></p>
    </div>
  `;

  const userInput = container.querySelector('.auth-user');
  const passInput = container.querySelector('.auth-pass');
  const connectBtn = container.querySelector('.auth-connect');
  const cancelBtn = container.querySelector('.auth-cancel');
  const errorMsg = container.querySelector('.auth-error');

  let step = 1;
  if (type === "vnc") {
    step = 3; // VNC n'a pas besoin de nom d'utilisateur
    userInput.classList.add("hidden");
  }
  connectBtn.addEventListener('click', () => {
    const username = userInput.value.trim();
    const password = passInput.value;
    if (step === 1) {
      if (!username) {
        errorMsg.textContent = "Nom d'utilisateur requis.";
        errorMsg.classList.remove("hidden");
        return;
      }
      localStorage.setItem('username', username);
      if (type === "rdp") {
        step = 2;
        userInput.classList.add("hidden");
        passInput.classList.remove("hidden");
        errorMsg.classList.add("hidden");
      } else if (type === "ssh") {
        console.log("ssh selected");
        window.location.href = 'ssh.html';
      } /*else if (type === "vnc") {
        userInput.classList.add("hidden");
        passInput.classList.add("hidden");
        errorMsg.classList.add("hidden");
        // Démarrage VNC via Electron
        window.electronAPI.runVNC(ip);
      }*/
    } else if (step === 2) {
      if (!password) {
        errorMsg.textContent = "Mot de passe requis.";
        errorMsg.classList.remove("hidden");
        return;
      }

      // Démarrage RDP via Electron
      window.electronAPI.startRDP(ip, username, password);
   
   } else if (step === 3 && type === "vnc") {
      // Démarrage VNC via Electron
      window.electronAPI.runVNC(ip);
   }
  });

  cancelBtn.addEventListener('click', () => {
    // Remet les boutons si on annule
    container.innerHTML = `
      <div class="button-group flex gap-2">
        <button data-ip="${ip}" data-type="ssh" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">SSH</button>
        <button data-ip="${ip}" data-type="rdp" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">RDP</button>
        <button data-ip="${ip}" data-type="vnc" class="action-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">VNC</button>
      </div>
    `;
  });
}

async function refreshData() {
  try {
    const hosts = await getVpnHosts(); // récupère les IP
    const peersInfo = await getPeersInfo(hosts); // récupère les infos associées

    // mise à jour de l'affichage des cartes
    container.innerHTML = hosts.map(peer => {
      const info = peersInfo.find(p => p.publicKey === peer.publicKey);
      return createMachineCard(peer, info); // suppose que cette fonction gère peer + info
    }).join('');

    // mise à jour de l'autre liste si besoin
    container2.innerHTML = hosts.map(createMachineListItem).join('');
  } catch (err) {
    console.error("Erreur lors du rafraîchissement :", err);
  }
}

// cree la foncion de recherche en dinamique soit avec ip soit avec le nom du client
