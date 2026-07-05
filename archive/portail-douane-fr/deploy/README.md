# Déploiement sur un poste Ubuntu toujours allumé

Ce guide fait tourner le portail douanier mocké **en permanence** sur un
ordinateur Ubuntu :

- Lancé par **systemd** → redémarre tout seul en cas de plantage **et** au
  démarrage de la machine (même avant toute ouverture de session graphique).
- Base **SQLite sur le disque local** (`data/douane.db`) → **mémoire persistante**,
  conservée entre les redémarrages.
- Exposé publiquement via **Cloudflare Tunnel**.

Testé sur Ubuntu 22.04 / 24.04 (GNOME). Toutes les commandes sont à lancer sur
le poste Ubuntu.

---

## 1. Récupérer le code

```bash
sudo apt update
sudo apt install -y git python3 python3-venv
git clone https://github.com/DAKSHPATELL/medusa.git ~/medusa
cd ~/medusa
git checkout feature/portail-douane-mock
```

## 2. Installer le service applicatif

```bash
bash deploy/install.sh
```

Ce script : crée le venv, installe les dépendances, crée le dossier `data/`,
puis installe et démarre le service systemd `portail-douane`.

Vérifier :

```bash
systemctl status portail-douane        # doit être "active (running)"
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/courtier/login   # -> 200
```

La base de démo (3 dossiers) est amorcée automatiquement au premier démarrage.

---

## 3. Rendre le processus « impossible à arrêter »

### a) Redémarrage auto (plantage + reboot) — déjà en place

L'unité systemd contient `Restart=always` et a été activée avec
`systemctl enable`, donc :

- si le processus plante → systemd le relance sous 3 s ;
- si la machine redémarre → le service repart tout seul au boot, **sans**
  qu'une session graphique soit ouverte.

Rien de plus à faire pour ça.

### b) Empêcher le poste de se mettre en veille

Un service tourne, mais si Ubuntu **suspend** la machine, tout s'arrête. On
désactive donc la mise en veille au niveau système (le plus robuste, actif même
sur l'écran de connexion) :

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

Pour réactiver un jour : `sudo systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target`.

En complément, côté session GNOME (au cas où) :

```bash
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing'
```

Ou via l'interface : **Paramètres → Énergie → Suspension automatique : Désactivée**.
L'extinction de l'écran (veille de l'affichage) est sans effet sur le service —
vous pouvez la laisser active.

### c) (Portable uniquement) ne pas suspendre à la fermeture du capot

Si le poste est un ordinateur portable, éditez `/etc/systemd/logind.conf` :

```
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
```

puis `sudo systemctl restart systemd-logind`. (Inutile sur un vrai desktop.)

---

## 4. Exposer publiquement — Cloudflare Tunnel

### Installer cloudflared

```bash
# amd64 (Intel/AMD). Pour un ARM, remplacez amd64 par arm64.
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
sudo install -m 755 /tmp/cloudflared /usr/local/bin/cloudflared
cloudflared --version
```

### Option A — URL stable (recommandé) : tunnel nommé

Nécessite un **compte Cloudflare gratuit** + un **domaine ajouté à Cloudflare**
(la zone DNS gérée par Cloudflare). L'URL ne change jamais.

```bash
cloudflared tunnel login                       # ouvre le navigateur, choisir la zone
cloudflared tunnel create douane               # crée le tunnel + un fichier de creds
cloudflared tunnel route dns douane douane.mondomaine.fr
```

Créer `~/.cloudflared/config.yml` :

```yaml
tunnel: douane
credentials-file: /home/VOTRE_USER/.cloudflared/<UUID>.json
ingress:
  - hostname: douane.mondomaine.fr
    service: http://localhost:3000
  - service: http_status:404
```

Installer le tunnel comme service systemd (démarre au boot, redémarre seul) :

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Le portail est alors joignable en permanence sur `https://douane.mondomaine.fr`.

### Option B — sans domaine : quick tunnel (URL éphémère)

URL gratuite `https://xxxx.trycloudflare.com`, **mais qui change à chaque
redémarrage de cloudflared**. Pratique pour un test, moins pour du 24/7.

```bash
# Installer le service quick tunnel fourni dans ce dépôt :
sed -e "s#__USER__#$USER#g" deploy/cloudflared-quick.service \
    | sudo tee /etc/systemd/system/cloudflared-quick.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-quick

# Récupérer l'URL courante :
journalctl -u cloudflared-quick -n 30 | grep trycloudflare
```

---

## 5. Exploitation au quotidien

```bash
# Logs en direct de l'application
journalctl -u portail-douane -f

# Redémarrer / arrêter / démarrer
sudo systemctl restart portail-douane
sudo systemctl stop portail-douane
sudo systemctl start portail-douane

# Réinitialiser la base de démo (efface l'état, recharge les 3 dossiers)
cd ~/medusa
sudo systemctl stop portail-douane
DOUANE_DB=~/medusa/data/douane.db .venv/bin/python seed.py
sudo systemctl start portail-douane

# Mettre à jour depuis GitHub
cd ~/medusa && git pull
.venv/bin/pip install -r requirements.txt
sudo systemctl restart portail-douane
```

Accès :

- Courtier : `http://localhost:3000/courtier/login` (ou l'URL Cloudflare)
- Console agent : `.../admin/login` — identifiant `agent.durand`, mot de passe `admin`
