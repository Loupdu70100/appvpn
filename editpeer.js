async function init() {
    const params = new URLSearchParams(window.location.search);
    const publicKey = params.get('publicKey');

    if (publicKey) {
        const data = await getPeersInfo([{ publicKey }]);

        if (!data || data.length === 0) {
            console.error("Aucune info reçue pour ce peer.");
            return;
        }

        const info = data[0].info;

        document.getElementById('nom').value = info?.nom || '';
        document.getElementById('os').value = info?.os || '';
        document.getElementById('description').value = info?.description || '';
    } else {
        console.error('Public key not found in URL parameters');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    init();
    const button = document.getElementById('editpeer');
    if (button) {
        button.addEventListener('click', async () => {
            const publicKey = new URLSearchParams(window.location.search).get('publicKey');
            //recupere les donne de mon form
            let nom=document.getElementById('nom').value;
            let  os=document.getElementById('os').value;
            let description=document.getElementById('description').value ;
            const payload = { nom, os, description};
            try {
                const response = await fetch(`http://10.8.0.1:5000/updatepeer/${encodeURIComponent(publicKey)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new Error(`Erreur serveur: ${response.status}`);
                }

                console.log('Édition envoyée avec succès');
                //ecrire que l'edition a ete fait et que vous aller etre rediriger 
                await success();
                window.location.href= "./interface.html";

            } catch (err) {
                console.error('Erreur lors de l\'édition du peer:', err);
            }
        });
    }
});


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
            throw new Error(response.status);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Erreur lors de la récupération des peers:', error.message);
        return [];
    }
}


// Fonction utilitaire pause
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction pour fermer automatiquement l'alerte après 2 secondes
async function success() {
    // On récupère l'alerte par son id
    const alert = document.getElementById('alert-3');
    if (!alert) {
        return
    }
    alert.classList.remove('hidden')
    await sleep(5000);
    alert.classList.add('hidden')
}

// Installer les listeners de fermeture au clic
document.querySelectorAll('[data-dismiss-target]').forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-dismiss-target');
    const target = document.querySelector(targetId);
    if (target) target.remove();
  });
});