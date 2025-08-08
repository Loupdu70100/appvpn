# python/script.py
import sys
import json
import subprocess
import os
import tempfile 
import uuid 
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart      
import hmac
import hashlib
import time
import urllib.parse # Pour encoder les paramètres d'URL
import requests

EMAIL_SECRET_KEY = "VPNJET1OEIL" # <-- Valeur en dur pour le test

def generate_signature(data_string, secret_key):
    """Génère une signature HMAC SHA256 pour les données."""
    h = hmac.new(secret_key.encode('utf-8'), data_string.encode('utf-8'), hashlib.sha256)
    return h.hexdigest()


def get_public_ip():
    """Tente de récupérer l'adresse IP publique de la machine."""
    try:
        response = requests.get('https://api.ipify.org?format=json', timeout=5)
        response.raise_for_status() # Lève une exception pour les codes d'état d'erreur
        return response.json()['ip']
    except requests.exceptions.RequestException as e:
        print(f"Impossible de récupérer l'IP publique: {e}", file=sys.stderr)
        return "IP_PUBLIQUE_INCONNUE"

def generate_wireguard_keys():
    """Génère une paire de clés privée/publique WireGuard de manière compatible Windows/Linux."""
    private_key = ""
    public_key = ""
    fd = None # File descriptor for the temporary file
    temp_private_key_path = None # Path to the temporary file

    try:
        # 1. Générer la clé privée (subprocess.check_output avec text=True renvoie une STR)
        private_key = subprocess.check_output(
            "wg genkey",
            shell=True,
            text=True, # Indique que la sortie est du texte (str)
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        ).strip()
        print(private_key) # Bon pour le débogage, vous pouvez l'enlever après

        # 2. Créer un fichier temporaire en mode binaire
        # tempfile.mkstemp() renvoie un descripteur de fichier (fd) et le chemin (path)
        # Il crée le fichier en mode binaire par défaut.
        fd, temp_private_key_path = tempfile.mkstemp()

        # Écrire la clé privée (convertie en octets) dans le fichier temporaire
        # os.write() prend un descripteur de fichier et des octets.
        # !!! C'EST CETTE LIGNE QU'IL FAUT CORRIGER !!!
        os.write(fd, private_key.encode('utf-8')) # <-- RE-AJOUTEZ .encode('utf-8') ICI

        # Fermer le descripteur de fichier immédiatement après l'écriture
        os.write(fd, b'\n') # Added to ensure a newline for wg pubkey, important for some OS/versions
        os.close(fd)
        fd = None # Réinitialiser fd pour éviter de tenter de le fermer deux fois dans 'finally'

        # 3. Lire le contenu du fichier temporaire pour le passer à wg pubkey
        # Ouvre en mode texte ('r') car on veut relire la clé comme du texte
        # On n'a pas besoin d'encoding='utf-8' ici si le fichier est simple ASCII/Latin-1,
        # mais c'est une bonne pratique de le laisser pour la robustesse.
        with open(temp_private_key_path, 'r', encoding='utf-8') as f: # Keep encoding='utf-8' here
            private_key_content_for_pubkey = f.read()

        # 4. Générer la clé publique en passant la clé privée via stdin (en octets)
        public_key = subprocess.check_output(
            ["wg", "pubkey"],
            # !!! ET C'EST CETTE LIGNE QU'IL FAUT CORRIGER AUSSI !!!
            input=private_key_content_for_pubkey, # <-- RE-AJOUTEZ .encode('utf-8') ICI
            text=True, # La sortie de wg pubkey sera du texte (str)
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        ).strip()

    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else e.output
        print(f"Erreur lors de la génération des clés WireGuard. Assurez-vous que 'wg.exe' est dans votre PATH Windows. Erreur: {error_output}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        # Afficher la trace d'erreur complète pour un meilleur débogage
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"Une erreur inattendue est survenue lors de la génération des clés : {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # S'assurer que le descripteur de fichier est fermé s'il n'a pas été fermé avant
        if fd is not None:
            os.close(fd)
        # Nettoyer le fichier temporaire
        if temp_private_key_path and os.path.exists(temp_private_key_path):
            try:
                os.remove(temp_private_key_path)
            except OSError as e:
                print(f"Attention: Impossible de supprimer le fichier temporaire {temp_private_key_path}: {e}", file=sys.stderr)
            
    return private_key, public_key

# Move generate_client_config function out of generate_wireguard_keys if it's there
# It looks like it was accidentally indented in your paste.
# It should be at the same level as generate_wireguard_keys and main.

def generate_client_config(client_private_key, client_address, peer_public_key, endpoint_ip, endpoint_port=51820, allowed_ips="0.0.0.0/0"):
    """
    Génère le contenu du fichier de configuration client WireGuard.
    """
    config_content = f"""
[Interface]
PrivateKey = {client_private_key}
Address = {client_address}

[Peer]
PublicKey = {peer_public_key}
AllowedIPs = {allowed_ips}
Endpoint = {endpoint_ip}:{endpoint_port}
PersistentKeepalive = 25

"""
    return config_content

def install_wireguard_profile(config_content, client_public_key):
    """
    Crée un fichier .conf temporaire et tente de l'installer via wireguard.exe /installtunnelservice.
    """
    temp_dir = tempfile.gettempdir()
    config_filename = "wg_client.conf" # Nom unique basé sur la clé publique
    temp_config_path = os.path.join(temp_dir, config_filename)
    wireguard_exe_path = 'C:\\Program Files\\WireGuard\\wireguard.exe' # Chemin par défaut

    try:
        print(f"DEBUG: Creating temporary config file at: {temp_config_path}", file=sys.stderr)
        with open(temp_config_path, 'w', encoding='utf-8') as f:
            f.write(config_content)
        print(f"DEBUG: Temporary config file created. Exists: {os.path.exists(temp_config_path)}", file=sys.stderr)

        print(f"DEBUG: Attempting WireGuard installation with command:", file=sys.stderr)
        test = subprocess.run(
            [wireguard_exe_path, "/installtunnelservice", temp_config_path],
        )
        print("\n--- Résultat de la commande ---")
        print(f"Code de retour : {test.returncode}")
        print(f"Sortie standard (stdout) :")
        print(test.stdout) # Notez : pas de parenthèses ici, c'est un attribut
        print(f"Erreur standard (stderr) :")
        print(test.stderr) # Notez : pas de parenthèses ici
        
        return True, temp_config_path

    except RuntimeError as e:
        raise RuntimeError(f"WireGuard installation failed: {e}")
    finally:
        # Le nettoyage du fichier temporaire sera fait dans la fonction main()
        pass


def main():
    if len(sys.argv) > 1:
        json_input_string = sys.argv[1]
        try:
            #je load se que l'app menvoie
            data = json.loads(json_input_string)
            #je defini mes variable python via les info de data et je defini des valeur par default
            ip_relais = data.get("ipRelais", "") 
            key_public_relais = data.get("keyPublicRelais", "")
            portrelais=data.get("portrelais","51820")
            client_ip = data.get("ip", "")
            allowed_ips_client = data.get("ipAllow", "0.0.0.0/0")

            #si les info son vide on retourne une erreur
            if not ip_relais or not key_public_relais or not client_ip:
                print("Erreur: Tous les champs obligatoires (IP Relais, Clé Publique Relais, Votre IP WireGuard) doivent être remplis.", file=sys.stderr)
                print(json.dumps({"error": "Erreur: Données manquantes."}))
                sys.exit(1)

            # Générer une nouvelle paire de clés pour le client
            client_private_key, client_generated_public_key = generate_wireguard_keys()

            #je genere mon fichier de config via les info que je recupere
            client_config_content = generate_client_config(
                client_private_key=client_private_key,
                client_address=client_ip,
                peer_public_key=key_public_relais,
                endpoint_ip=ip_relais,
                endpoint_port=portrelais,
                allowed_ips=allowed_ips_client
            )

            # Récupérer l'IP publique de la machine qui exécute le script
            requester_public_ip = get_public_ip()

            server_add_user_data = {
                "clientPublicKey": client_generated_public_key,
                "clientAllowedIPs": client_ip,
                "clientName": f"electron_client_{client_generated_public_key[:8]}",
                "ipPublic": requester_public_ip,  # Ajout de l'IP publique pour le serveur
                "iplocal": client_ip,  # Ajout de l'IP locale pour le serveur

            }
            #valeur renvoyer a mon application
            response_to_electron = {
                "clientConfig": client_config_content,
                "serverAddUserData": server_add_user_data,
                "clientPrivateKey": client_private_key
            }
            #je mette en json pour que mon render.js puisse traitrer
            print(json.dumps(response_to_electron))


            

            # --- Préparation des données pour le bouton d'action sécurisé ---
            action_data = {
                "clientPublicKey": client_generated_public_key,
                "clientAllowedIPs": client_ip,
                "clientName": f"electron_client_{client_generated_public_key[:8]}",
                "timestamp": int(time.time()), # Timestamp pour l'expiration du lien
                "ipPublic": requester_public_ip,  # Ajout de l'IP publique pour le serveur
                "iplocal": client_ip,  # Ajout de l'IP locale pour le serveur
            }
            # Convertir les données en une chaîne JSON pour la signature
            action_data_str = json.dumps(action_data, sort_keys=True) # sort_keys important pour une signature consistante

            

            # Générer une signature pour ces données
            signature = generate_signature(action_data_str, EMAIL_SECRET_KEY)

            # URL de votre API backend
            # Remplacez par l'adresse IP publique ou le nom de domaine de votre serveur d'API
            # Assurez-vous que l'IP/domaine est accessible depuis l'endroit où le mail sera cliqué
            API_BASE_URL = f"http://{ip_relais}:5000/api" 

            # Construire l'URL d'activation avec les données et la signature
            # Les données et la signature sont encodées pour être passées dans l'URL
            encoded_action_data = urllib.parse.quote_plus(action_data_str)
            encoded_signature = urllib.parse.quote_plus(signature)

            # C'est l'URL que le bouton dans l'email pointera. C'est une requête GET pour la simplicité.
            # Pour une sécurité maximale (anti-CSRF), ce lien devrait idéalement pointer vers une page
            # de confirmation sur votre site, qui ferait ensuite un POST sécurisé vers votre API.
            activation_link = f"{API_BASE_URL}/add-peer?data={encoded_action_data}&sig={encoded_signature}"


            # --- Paramètres de l'expéditeur et du destinataire ---
            sender_email = "alerte@jet1oeil.com"
            receiver_email = "luc.bourguignon@jet1oeil.com"

            # --- Configuration du serveur SMTP ---
            port = 587  # Port standard pour STARTTLS
            smtp_server = "smtp.gmail.com"  # Exemple pour Gmail
            login = "alerte@jet1oeil.com"  # Votre identifiant généré par Mailtrap
            password = "dxiv gysb jbcr jhkn"  # Votre mot de passe généré par Mailtrap

            # --- Création du message MIME ---
            message = MIMEMultipart("alternative")
            message["Subject"] = "Votre e-mail avec un super bouton !"
            message["From"] = sender_email
            message["To"] = receiver_email

            
            # --- Contenu texte brut (Fallback pour les clients qui ne supportent pas HTML) ---
            # Notez les doubles accolades {{ }} si vous utilisez des f-strings pour échapper
            # les accolades qui ne sont pas des placeholders. Ici, on utilise .format() donc on garde {}
            raw_text_content_template = """\
            Bonjour,
            Un utilisateur a essaye de rejoindre votre serveur vpn il souhaite cette ip local : {client_ip}
            l'action a ete faite depuis celle ip public : {requester_public_ip}
            si vous etes a l'origine de cette demande 
            Cliquez sur le lien {activation_link}

            Cordialement,
            Votre application
            """

            # --- Contenu HTML avec le bouton ---
            raw_html_content_template = """\
            <!DOCTYPE html>
            <html>
            <head>
            <style>
            /* Styles généraux (certains clients de messagerie peuvent ignorer) */
            body {{ font-family: sans-serif; }}
            .button-container {{ text-align: center; margin-top: 20px; }}
            </style>
            </head>
            <body>
            <p>Bonjour,</p>
            <p>Bonjour,
            Un utilisateur a essaye de rejoindre votre serveur vpn il souhaite cette ip local : {client_ip}
            l'action a ete faite depuis celle ip public : {requester_public_ip}
            si vous etes a l'origine de cette demande </p>

            <div class="button-container">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tbody>
                    <tr>
                    <td align="center">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tbody>
                            <tr>
                            <td>
                                <a href="{activation_link}" target="_blank" style="background-color: #3498db; border: solid 1px #3498db; border-radius: 5px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; line-height: 1.2; margin: 0; padding: 15px 30px; text-decoration: none; text-transform: capitalize;">
                                Ajouter le client au VPN
                                </a>
                            </td>
                            </tr>
                        </tbody>
                        </table>
                    </td>
                    </tr>
                </tbody>
                </table>
            </div>

            <p>N'hésitez pas à nous contacter si vous avez des questions.</p>
            <p>Cordialement,<br>Votre équipe</p>
            </body>
            </html>
            """

            # --- FORMATEZ LES CONTENUS ICI AVANT DE LES ATTACHER ! ---
            # Utilisez .format() pour insérer les valeurs des variables dans les templates
            formatted_text_content = raw_text_content_template.format(
                client_ip=client_ip,
                requester_public_ip=requester_public_ip,
                activation_link=activation_link
            )

            formatted_html_content = raw_html_content_template.format(
                client_ip=client_ip,
                requester_public_ip=requester_public_ip,
                activation_link=activation_link
            )

            # Créer les parties MIMEText avec les contenus FORMATTÉS
            part1 = MIMEText(formatted_text_content, "plain")
            part2 = MIMEText(formatted_html_content, "html")

            # Attacher les parties au message, le HTML en dernier pour qu'il soit privilégié
            message.attach(part1)
            message.attach(part2)
            # --- Envoi de l'e-mail ---#
            context = ssl.create_default_context()
            with smtplib.SMTP(smtp_server, port) as server:
                server.starttls(context=context)  # Sécurise la connexion
                server.login(sender_email, password)
                server.sendmail(sender_email, receiver_email, message.as_string())
            print("E-mail envoyé avec succès !")
            install_wireguard_profile(client_config_content,client_private_key)


        except Exception as e:
            print(f"Erreur lors de l'envoi de l'e-mail : {e}")
        except json.JSONDecodeError:
            print("Erreur: L'argument n'est pas un JSON valide.", file=sys.stderr)
            print(json.dumps({"error": "Erreur de format de données."}))
            sys.exit(1)
        except Exception as e:
            # Display full traceback for better debugging
            import traceback
            traceback.print_exc(file=sys.stderr)
            print(f"Une erreur inattendue est survenue : {e}", file=sys.stderr)
            print(json.dumps({"error": f"Erreur lors du traitement : {str(e)}"}))
            sys.exit(1)
    else:
        print(json.dumps({"error": "Aucune donnée reçue de Electron."}))

if __name__ == "__main__":
    main()