// renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const runPythonBtn = document.getElementById('runPythonBtn');
    const resultParagraph = document.getElementById('result');

    runPythonBtn.addEventListener('click', async () => {
        // 1. Récupérer les valeurs des champs d'entrée
        const ipRelais = document.getElementById('iprelais').value;
        const keyPublicRelais = document.getElementById('keypublicrelais').value;
        const portrelais = document.getElementById('portrelais').value;
        const ip = document.getElementById('ip').value;
        const ipAllow = document.getElementById('ipallow').value;

        // 2. Créer un objet avec toutes les données
        const inputData = {
            ipRelais: ipRelais,
            keyPublicRelais: keyPublicRelais,
            portrelais: portrelais,
            ip: ip,
            ipAllow: ipAllow
        };

        // 3. Convertir l'objet en chaîne JSON
        // C'est la meilleure façon de passer des données structurées
        // entre JavaScript et Python via des arguments de ligne de commande.
        const jsonInputData = JSON.stringify(inputData);

        resultParagraph.textContent = 'Exécution du script Python...';
        try {
            const pythonOutput = await window.electronAPI.runPythonScript(jsonInputData);
            if (pythonOutput) {
                resultParagraph.textContent = `Script exécuté avec succès`;
                window.location.href = 'interface.html';
            }
            
        } catch (error) {
            console.error('Erreur lors de l\'exécution du script Python:', error);
            resultParagraph.textContent = 'Erreur lors de l\'exécution du script Python. Veuiller contacter le developper pour regler le probleme.';
        }
    });
});