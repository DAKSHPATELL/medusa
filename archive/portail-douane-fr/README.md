# Portail douanier mocké — DELTA-X Fret Express

Maquette d'un faux portail douanier français réaliste (style `douane.gouv.fr`),
construite selon [`spec_portail_douane_mock_v2.md`](spec_portail_douane_mock_v2.md).

Deux interfaces partageant un même état SQLite :

- **Interface courtier** (`/courtier/*`) — publique, pilotée par Computer Use (Maria FOURNIER).
- **Interface agent douanier** (`/admin/*`) — cachée, utilisée en coulisses pour simuler
  les actions de la douane en temps réel (hold, message, demande de document, mainlevée).

Le frontend courtier interroge `/api/notifications` toutes les 3 secondes (polling)
pour détecter en direct les nouveaux messages et changements de statut.

## Stack

- **Backend** : FastAPI (`main.py`), un seul fichier de routes + API.
- **Frontend** : templates Jinja2 + un seul fichier CSS, sans framework JS.
- **Base de données** : SQLite (`douane.db`), état partagé courtier ↔ admin.
- Largeur fixe 1024px, coins carrés, zéro animation — charte gouvernementale.

## Lancement

```bash
# 1. Dépendances (Python 3.11 ou 3.12 recommandé)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Initialiser la base de démo (3 dossiers, dossier CLR-2026-0042 « active »)
python seed.py

# 3. Démarrer le serveur
uvicorn main:app --host 0.0.0.0 --port 3000

# 4. (option) Exposer publiquement pour la VM Antigravity
cloudflared tunnel --url http://localhost:3000
```

Puis :

- Courtier : http://localhost:3000/courtier/login
- Agent (coulisses) : http://localhost:3000/admin/login  (`agent.durand` / `admin`)

## Scénario de démo

1. Sur `/admin/dossier/CLR-2026-0042`, **Déclencher un hold** (motif « Écart de valeur »).
   → statut `hold`, message automatique (art. 140 CDU) dans la messagerie courtier, badge rouge.
2. Côté courtier : lecture du message, onglet **Valeur en douane**, correction + justification.
3. Sur l'admin, **Demander un document** (justificatif fiscal) → ligne « Manquant » + message.
4. Côté courtier : onglet **Documents**, dépôt du justificatif.
5. Sur l'admin, **Accorder la mainlevée** → statut vert + message de confirmation.

## Réinitialiser

```bash
python seed.py   # supprime et recrée douane.db avec les données de démo
```

## Structure

```
main.py            routes courtier + admin + API interne
database.py        schéma SQLite + helpers de requêtes
seed.py            données de démonstration
templates/         base.html, base_admin.html, courtier/*, admin/*
static/css/        style.css (charte gouvernementale)
static/js/         courtier.js (polling), admin.js
docs/fake_docs/    PDFs fictifs pour la démo
```
