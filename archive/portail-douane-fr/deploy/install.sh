#!/usr/bin/env bash
#
# Installe le portail douanier mocké comme service systemd sur Ubuntu.
# À lancer SANS sudo (le script appelle sudo uniquement là où c'est nécessaire).
#
#   cd ~/medusa
#   bash deploy/install.sh
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="$USER"

echo "==> Dossier applicatif : $APP_DIR"
echo "==> Utilisateur du service : $RUN_USER"

# 1. Dépendances système minimales (python venv).
if ! command -v python3 >/dev/null; then
    echo "python3 introuvable — installez-le : sudo apt install -y python3 python3-venv"
    exit 1
fi

# 2. Environnement virtuel + dépendances Python.
if [ ! -d "$APP_DIR/.venv" ]; then
    echo "==> Création de l'environnement virtuel"
    python3 -m venv "$APP_DIR/.venv"
fi
echo "==> Installation des dépendances Python"
"$APP_DIR/.venv/bin/pip" install --quiet --upgrade pip
"$APP_DIR/.venv/bin/pip" install --quiet -r "$APP_DIR/requirements.txt"

# 3. Dossier de données persistant pour la base SQLite.
mkdir -p "$APP_DIR/data"
echo "==> Base SQLite persistante : $APP_DIR/data/douane.db"

# 4. Génération et installation de l'unité systemd.
echo "==> Installation du service systemd (sudo requis)"
sed -e "s#__USER__#$RUN_USER#g" -e "s#__APP_DIR__#$APP_DIR#g" \
    "$APP_DIR/deploy/portail-douane.service" \
    | sudo tee /etc/systemd/system/portail-douane.service >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now portail-douane.service

echo
echo "==> Terminé. État du service :"
sudo systemctl --no-pager --lines=0 status portail-douane.service || true
echo
echo "Le portail écoute maintenant sur http://localhost:3000"
echo "Logs en direct :  journalctl -u portail-douane -f"
