# SPEC v2 — Portail douanier mocké « DELTA-X Fret Express »

## Objectif

Construire un faux portail douanier français réaliste avec **deux interfaces** :
1. **Interface courtier** (publique) — ce que Maria voit et ce que Computer Use pilote
2. **Interface agent douanier** (cachée, admin) — ce que VOUS utilisez pendant la démo pour simuler les actions de la douane (envoyer un message, relever un problème, demander un document)

Le tout exposé sur une **URL publique** via Cloudflare Tunnel, pour que Computer Use (qui tourne dans un sandbox cloud Antigravity) puisse y accéder.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Votre laptop                       │
│                                                      │
│   FastAPI (localhost:3000)                            │
│   ├── /courtier/*    → Interface Maria (publique)    │
│   ├── /admin/*       → Interface agent douanier      │
│   ├── /api/*         → API interne (état des dossiers)│
│   └── SQLite         → État partagé entre les deux   │
│                                                      │
│   cloudflared tunnel --url http://localhost:3000      │
│   → https://xxxx.trycloudflare.com                   │
└─────────────────────────────────────────────────────┘
         │
         │ URL publique HTTPS
         ▼
┌─────────────────────┐
│ Antigravity sandbox  │
│ Computer Use accède  │
│ au portail via       │
│ l'URL Cloudflare     │
└─────────────────────┘
```

## Exposition publique — Cloudflare Quick Tunnel

La solution la plus simple : **Cloudflare Quick Tunnel** (gratuit, sans compte, sans config).

```bash
# Installer cloudflared
# macOS
brew install cloudflared
# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared

# Lancer le tunnel (une seule commande)
cloudflared tunnel --url http://localhost:3000
```

Output :
```
Your free tunnel has started! Visit it:
https://seasonal-deck-organisms-sf.trycloudflare.com
```

Cette URL est publique, HTTPS, accessible de partout — y compris depuis la VM Antigravity. L'URL change à chaque relance de cloudflared, mais elle reste stable pendant toute la session.

**Alternative encore plus simple** si cloudflared pose problème :
```bash
# localtunnel (npm, zéro config)
npx localtunnel --port 3000
```

## Contraintes techniques

- **Backend** : FastAPI (Python) — un seul fichier `main.py`
- **Frontend** : HTML/CSS/JS statique, servi par FastAPI (Jinja2 templates)
- **Base de données** : SQLite — un fichier `douane.db`, état partagé entre interface courtier et admin
- **Pas de framework frontend** (pas de React, pas de Tailwind)
- **Responsive** : NON (site gouvernemental, réaliste)
- **Largeur fixe** : 1024px, centré

## Contraintes Computer Use

Computer Use fonctionne par screenshot → action. Pour qu'il réussisse :

- **Champs de formulaire grands** : hauteur minimum 40px, largeur minimum 300px
- **Labels au-dessus des champs**, pas à côté, pas en placeholder
- **Labels en texte visible**, pas en gris clair — contraste fort
- **Boutons larges** (min 200px × 44px) avec du texte explicite
- **Espacement généreux** entre les éléments (min 16px vertical)
- **Pas de menus déroulants complexes** — utiliser des `<select>` simples ou des champs texte
- **Pas de modales** — tout en pleine page
- **Pas de scroll horizontal**
- **Un seul appel à l'action principal par page** (le bouton le plus important est visuellement distinct)
- **IDs HTML sur tous les champs** pour faciliter le debug

## Direction artistique

Identique à la v1 — style gouvernemental français (douane.gouv.fr).

### Palette

| Rôle | Hex | Usage |
|------|-----|-------|
| Bleu République | `#000091` | Header, titres, boutons principaux |
| Bleu hover | `#1212FF` | Hover liens/boutons |
| Rouge Marianne | `#E1000F` | Alertes, holds, erreurs |
| Fond page | `#F5F5FE` | Background global |
| Fond formulaire | `#FFFFFF` | Cards formulaire |
| Fond bandeau info | `#E3E3FD` | Bandeaux information |
| Bordures | `#CECECE` | Séparateurs, tableaux |
| Texte principal | `#161616` | Corps de texte |
| Texte secondaire | `#666666` | Labels secondaires |
| Vert validation | `#18753C` | Mainlevée, succès |
| Orange attention | `#B34000` | En attente, warnings |

### Typographie
- Titres : `Marianne, Arial, sans-serif` — weight 700
- Corps : `Marianne, Arial, sans-serif` — weight 400, 16px
- Labels formulaire : 14px, weight 600, uppercase
- Monospace : `Courier New, monospace` pour les codes/numéros

### Éléments visuels obligatoires
- Bandeau header bleu `#000091` avec "RÉPUBLIQUE FRANÇAISE" + "DIRECTION GÉNÉRALE DES DOUANES ET DROITS INDIRECTS"
- Sous-bandeau "DELTA-X — Fret Express et Postal"
- Footer noir avec mentions légales
- Coins carrés partout (border-radius: 0)
- Zéro animation, zéro ombre, zéro gradient

---

## INTERFACE COURTIER (ce que Maria voit)

### Navigation principale

Barre de navigation horizontale sous le sous-bandeau, fond blanc, bordure inférieure `#CECECE` :

```
[Tableau de bord]  [Déclarations]  [Documents]  [Messagerie (3)]  [Mon compte]
```

Le chiffre entre parenthèses sur "Messagerie" = nombre de messages non lus (badge rouge).

### Page C1 — Connexion

**URL** : `/courtier/login`

- Card centrée 480px avec champs EORI + mot de passe (préremplis)
- Bouton "SE CONNECTER" → redirige vers `/courtier/dashboard`

### Page C2 — Tableau de bord

**URL** : `/courtier/dashboard`

- Compteurs : Dossiers actifs (42), En attente (7, orange), Hold douanier (3, rouge), Mainlevée (32, vert)
- Tableau des dossiers en hold (3 lignes, CLR-2026-0042 en surbrillance rouge)
- Recherche par numéro d'entrée

### Page C3 — Déclarations (liste)

**URL** : `/courtier/declarations`

Tableau paginé de toutes les déclarations avec colonnes :
| N° Entrée | MRN | Type | Expéditeur | Statut | Date | Actions |

Filtres en haut : par statut (Tous / En cours / Hold / Mainlevée), par date.

Chaque ligne a un lien "Voir" qui mène à la page dossier.

### Page C4 — Dossier détail

**URL** : `/courtier/dossier/<case_id>`

C'est la page principale de la démo. Structurée en onglets horizontaux :

```
[Informations générales]  [Marchandises]  [Valeur en douane]  [Documents]  [Historique]
```

**Onglet "Informations générales"** :
- Bandeau d'alerte si hold (rouge) ou demande de document (orange)
- Tableau 2 colonnes : N° entrée, MRN, type, date, bureau, statut, parties (importateur, expéditeur, représentant, transporteur)

**Onglet "Marchandises"** :
- Tableau des articles : code HS, désignation, origine, poids, quantité, valeur

**Onglet "Valeur en douane"** (la section clé pour Computer Use) :
- Formulaire éditable : valeur déclarée, Incoterm, fret, assurance
- Valeur facturée (lecture seule), écart constaté (rouge si > 5%)
- Textarea "Justification de l'écart"
- Boutons "SOUMETTRE LA MODIFICATION" / "ANNULER"

**Onglet "Documents"** :
- Tableau des documents joints avec statut (✓ Validé / ✗ Manquant)
- Bouton "JOINDRE UN DOCUMENT" (input file)

**Onglet "Historique"** :
- Timeline verticale de toutes les actions (dépôt, hold, messages, corrections, demandes)

### Page C5 — Documents (bibliothèque)

**URL** : `/courtier/documents`

Liste de tous les documents de tous les dossiers, avec filtres par dossier et par type. Permet d'uploader de nouveaux documents et de les rattacher à un dossier.

### Page C6 — Messagerie

**URL** : `/courtier/messagerie`

Style webmail gouvernemental (type messagerie impots.gouv.fr) :

**Liste des messages** (panneau gauche, 300px) :
- Chaque message = une ligne avec : expéditeur, objet, date, lu/non-lu
- Messages non lus en bold avec pastille bleue
- Messages liés à un dossier en hold en surbrillance rouge

**Détail du message** (panneau droit) :
- En-tête : De, À, Date, Objet, Dossier lié (cliquable)
- Corps du message (texte brut, style administratif)
- Pièces jointes éventuelles
- Bouton "RÉPONDRE" → textarea + bouton "ENVOYER"

**Messages pré-chargés pour le scénario** :

1. Message du 01/07/2026 — **NON LU**
   - De : Bureau FR003300 — Le Havre Port
   - Objet : "HOLD — Écart de valeur — Dossier CLR-2026-0042"
   - Corps : "Madame FOURNIER, suite au contrôle automatique de votre déclaration n° 26FR00000042E7, un écart significatif a été constaté entre la valeur facturée (14 500,00 EUR) et la valeur déclarée (12 000,00 EUR). Conformément à l'article 140 du CDU, vous êtes invité à justifier cet écart ou à corriger la valeur déclarée dans un délai de 5 jours ouvrés. À défaut, le dossier sera transmis au service contentieux. Cordialement, Service de la valeur — Bureau FR003300"

2. (Apparaît après action admin) Message du 02/07/2026
   - De : Bureau FR003300 — Le Havre Port
   - Objet : "DEMANDE DE DOCUMENT — Justificatif fiscal — Dossier CLR-2026-0042"
   - Corps : "Suite à la correction de la valeur déclarée enregistrée le 01/07/2026, un justificatif fiscal est requis pour valider la modification. Merci de joindre le document dans un délai de 48 heures."

### Page C7 — Confirmation de modification

**URL** : `/courtier/dossier/<case_id>/confirmation`

Card centrée avec résumé de la modification (ancienne valeur → nouvelle valeur, justification), message de confirmation, bouton retour au tableau de bord.

---

## INTERFACE AGENT DOUANIER (cachée, admin)

**URL de base** : `/admin`

Cette interface n'est PAS montrée au jury pendant la démo principale. C'est l'outil que vous utilisez en coulisses (sur un 2ᵉ écran ou un téléphone) pour simuler les actions de la douane en temps réel.

### Style visuel

Identique au portail courtier (même charte gouvernementale) mais avec un bandeau supplémentaire orange en haut : "⚠ INTERFACE AGENT — ENVIRONNEMENT DE CONTRÔLE" pour éviter toute confusion.

### Page A1 — Connexion admin

**URL** : `/admin/login`

Login simple : identifiant "agent.durand" / mot de passe "admin" (prérempli). Redirige vers `/admin/dashboard`.

### Page A2 — Tableau de bord agent

**URL** : `/admin/dashboard`

Liste de tous les dossiers avec leur statut actuel. Pour chaque dossier, boutons d'action rapide :
- "Déclencher un hold"
- "Envoyer un message"
- "Demander un document"
- "Accorder la mainlevée"

### Page A3 — Actions sur un dossier

**URL** : `/admin/dossier/<case_id>`

Vue complète du dossier (lecture seule pour les données courtier) + **panneau d'actions agent** :

**Action 1 — Déclencher un hold** :
- Sélection du motif : "Écart de valeur" / "Code HS contesté" / "Document manquant" / "Valeur suspecte" / "Autre"
- Champ texte libre pour le motif détaillé
- Bouton "DÉCLENCHER LE HOLD"
- → Met à jour le statut du dossier en BDD + crée automatiquement un message dans la messagerie courtier

**Action 2 — Envoyer un message** :
- Objet (pré-rempli selon le contexte, modifiable)
- Corps du message (textarea, avec un template pré-rempli en français administratif)
- Case à cocher "Lier au dossier CLR-2026-0042"
- Bouton "ENVOYER LE MESSAGE"
- → Le message apparaît instantanément dans la messagerie du courtier (polling ou SSE)

**Action 3 — Demander un document complémentaire** :
- Type de document demandé : "Justificatif fiscal" / "Facture corrigée" / "Certificat d'origine" / "Attestation de valeur" / "Autre"
- Raison de la demande (textarea)
- Date limite (date picker)
- Bouton "ENVOYER LA DEMANDE"
- → Crée un message + met à jour la section Documents du dossier courtier (ajout d'une ligne "Manquant")

**Action 4 — Accorder la mainlevée** :
- Commentaire optionnel
- Bouton "ACCORDER LA MAINLEVÉE"
- → Statut passe à "MAINLEVÉE ACCORDÉE" (badge vert), message automatique envoyé au courtier

### Page A4 — Historique des actions agent

**URL** : `/admin/historique`

Log de toutes les actions effectuées par l'agent, avec horodatage. Utile pour débugger pendant la démo.

---

## API INTERNE

Endpoints REST qui font le pont entre admin et courtier, via SQLite :

```
# État des dossiers
GET    /api/cases                        → liste tous les dossiers
GET    /api/cases/<case_id>              → détail d'un dossier
PATCH  /api/cases/<case_id>              → modifier un dossier (statut, valeurs)

# Messagerie
GET    /api/messages?case_id=...         → messages d'un dossier
POST   /api/messages                     → envoyer un message (admin → courtier ou courtier → admin)
PATCH  /api/messages/<msg_id>/read       → marquer comme lu

# Documents
GET    /api/documents?case_id=...        → documents d'un dossier
POST   /api/documents                    → ajouter un document
PATCH  /api/documents/<doc_id>           → modifier le statut (manquant/validé)

# Actions admin
POST   /api/admin/hold                   → déclencher un hold (crée le hold + le message)
POST   /api/admin/request-document       → demander un document (crée la demande + le message)
POST   /api/admin/release                → accorder la mainlevée

# Polling temps réel (pour rafraîchir l'interface courtier)
GET    /api/notifications?since=<timestamp>  → nouvelles notifs depuis X
```

Le frontend courtier poll `/api/notifications` toutes les 3 secondes pour détecter les nouveaux messages et changements de statut, et afficher une notification visuelle (badge rouge sur "Messagerie", bandeau d'alerte sur le dossier).

---

## SCHÉMA SQLite

```sql
CREATE TABLE cases (
    case_id TEXT PRIMARY KEY,
    mrn TEXT,
    declaration_type TEXT,
    filing_date TEXT,
    customs_office TEXT,
    status TEXT DEFAULT 'active',  -- active, hold, pending_docs, released
    hold_reason TEXT,
    hold_since TEXT,
    importer_name TEXT,
    importer_eori TEXT,
    importer_address TEXT,
    exporter_name TEXT,
    exporter_id TEXT,
    exporter_address TEXT,
    representative_name TEXT,
    representative_badge TEXT,
    carrier_name TEXT,
    carrier_scac TEXT,
    declared_value REAL,
    invoice_value REAL,
    freight REAL,
    insurance REAL,
    incoterm TEXT,
    currency TEXT DEFAULT 'EUR',
    hs_code TEXT,
    goods_description TEXT,
    origin_country TEXT,
    weight_net_kg REAL,
    quantity TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT REFERENCES cases(case_id),
    sender TEXT,           -- 'customs' ou 'broker'
    sender_name TEXT,      -- ex: "Bureau FR003300 — Le Havre Port"
    recipient TEXT,        -- ex: "Maria FOURNIER"
    subject TEXT,
    body TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT REFERENCES cases(case_id),
    filename TEXT,
    doc_type TEXT,          -- facture, packing_list, certificat_origine, justificatif_fiscal
    upload_date TEXT,
    status TEXT DEFAULT 'valid',  -- valid, missing, pending
    requested_by TEXT,      -- null ou 'customs'
    deadline TEXT
);

CREATE TABLE actions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT,
    actor TEXT,             -- 'system', 'customs', 'broker'
    action_type TEXT,       -- hold_triggered, message_sent, doc_requested, value_modified, release_granted
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## SCÉNARIO DE DÉMO — LE SCRIPT MINUTE PAR MINUTE

### Pré-chargement (avant la démo)

La BDD est initialisée avec :
- Le dossier CLR-2026-0042 en statut "active" (pas encore en hold)
- Les 3 documents validés (facture, packing list, certificat d'origine)
- Zéro message
- 2 autres dossiers inactifs pour le décor (CLR-2026-0038, CLR-2026-0031)

### Pendant la démo

**[0:00]** Vous (sur l'interface admin `/admin`) déclenchez le hold sur CLR-2026-0042 :
- Motif : "Écart de valeur"
- → Le statut passe à "hold" dans la BDD
- → Un message est automatiquement créé dans la messagerie
- → L'interface courtier détecte le changement (polling) et affiche le badge rouge

**[0:15]** Maria (Computer Use) voit la notification sur son tableau de bord, clique sur le dossier, va dans la messagerie, lit le message de la douane.

**[0:30]** L'appel Live Translate se produit — l'expéditeur confirme "la valeur inclut le fret" — l'info est captée par l'agent ClearBorder.

**[1:15]** Computer Use navigue vers l'onglet "Valeur en douane", modifie le champ, remplit la justification, soumet.

**[2:00]** Kill/resume. Après le resume, vous (admin) déclenchez "Demander un document" (justificatif fiscal) :
- → Nouveau message dans la messagerie
- → Nouvelle ligne "Manquant" dans les documents du dossier

**[2:15]** L'agent ClearBorder détecte la demande, retrouve le document, navigue vers l'onglet Documents, uploade le fichier, soumet.

**[2:45]** Vous (admin) accordez la mainlevée → le statut passe au vert, message de confirmation.

---

## STRUCTURE DU PROJET

```
portail-douane-mock/
├── main.py                    # FastAPI app (routes + API + init BDD)
├── database.py                # Init SQLite + queries
├── seed.py                    # Pré-chargement des données de démo
├── requirements.txt           # fastapi, uvicorn, jinja2, python-multipart, aiosqlite
├── douane.db                  # SQLite (généré par seed.py)
├── templates/
│   ├── base.html              # Template de base (header, nav, footer)
│   ├── base_admin.html        # Template admin (header orange)
│   ├── courtier/
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── declarations.html
│   │   ├── dossier.html       # Page avec onglets
│   │   ├── documents.html
│   │   ├── messagerie.html
│   │   └── confirmation.html
│   └── admin/
│       ├── login.html
│       ├── dashboard.html
│       ├── dossier.html       # Vue dossier + panneau d'actions
│       └── historique.html
├── static/
│   ├── css/
│   │   └── style.css          # UN SEUL fichier CSS
│   ├── js/
│   │   ├── courtier.js        # Polling + interactions côté courtier
│   │   └── admin.js           # Interactions côté admin
│   └── img/
│       ├── republique-francaise.svg
│       └── favicon.ico
└── docs/
    └── fake_docs/             # PDFs fictifs pour la démo
        ├── FAC-2026-0891.pdf
        ├── PL-2026-0891.pdf
        ├── CO-MX-2026.pdf
        └── justificatif-fiscal.pdf
```

## LANCEMENT

```bash
# 1. Installer les dépendances
pip install fastapi uvicorn jinja2 python-multipart aiosqlite

# 2. Initialiser la BDD avec les données de démo
python seed.py

# 3. Lancer le serveur
uvicorn main:app --host 0.0.0.0 --port 3000

# 4. Exposer publiquement (dans un autre terminal)
cloudflared tunnel --url http://localhost:3000

# 5. Copier l'URL Cloudflare et la donner à l'agent Antigravity
```

## CE QU'IL NE FAUT PAS FAIRE

- **Pas de SPA** — navigation classique par liens
- **Pas d'animations** — site gouvernemental
- **Pas de border-radius** — coins carrés
- **Pas de gradients/ombres**
- **Pas de lorem ipsum** — tout en français administratif crédible
- **Pas de dark mode**
- **Pas de WebSockets** — le polling toutes les 3 secondes suffit et est plus simple à implémenter
- **Ne PAS montrer l'interface admin au jury** pendant la démo principale — c'est votre marionnettiste en coulisses

## DONNÉES PRÉ-CHARGÉES (seed.py)

```json
{
  "cases": [
    {
      "case_id": "CLR-2026-0042",
      "mrn": "26FR00000042E7",
      "declaration_type": "IM-A",
      "filing_date": "30/06/2026",
      "customs_office": "FR003300 — Le Havre Port",
      "status": "active",
      "importer_name": "GARAGE MARTIN SARL",
      "importer_eori": "FR12345678900042",
      "importer_address": "14 rue de la Paix, 75002 Paris",
      "exporter_name": "AUTOPIEZAS HERNÁNDEZ S.A.",
      "exporter_id": "AHE980415QR7",
      "exporter_address": "Av. Insurgentes Sur 1602, México D.F., Mexique",
      "representative_name": "Maria FOURNIER",
      "representative_badge": "RD-2024-1847",
      "carrier_name": "DHL EXPRESS FRANCE",
      "carrier_scac": "DHLF",
      "declared_value": 12000.00,
      "invoice_value": 14500.00,
      "freight": 2500.00,
      "insurance": 0.00,
      "incoterm": "CIF",
      "hs_code": "8708.99.97",
      "goods_description": "Pièces détachées automobiles — supports moteur en aluminium",
      "origin_country": "MX",
      "weight_net_kg": 340,
      "quantity": "200 pcs"
    },
    {
      "case_id": "CLR-2026-0038",
      "mrn": "26FR00000038E3",
      "declaration_type": "IM-A",
      "filing_date": "27/06/2026",
      "customs_office": "FR003300 — Le Havre Port",
      "status": "active",
      "importer_name": "TECHNO IMPORT SAS",
      "importer_eori": "FR98765432100018",
      "exporter_name": "SHENZHEN LIANHE ELECTRONICS",
      "declared_value": 4200.00,
      "invoice_value": 4200.00,
      "hs_code": "8542.31.00",
      "goods_description": "Circuits intégrés — microcontrôleurs ARM Cortex-M4"
    },
    {
      "case_id": "CLR-2026-0031",
      "mrn": "26FR00000031E9",
      "declaration_type": "IM-A",
      "filing_date": "24/06/2026",
      "customs_office": "FR003300 — Le Havre Port",
      "status": "released",
      "importer_name": "SARL TISSUS DU MONDE",
      "importer_eori": "FR45678912300031",
      "exporter_name": "ISTANBUL TEXTILE A.Ş.",
      "declared_value": 8750.00,
      "invoice_value": 8750.00,
      "hs_code": "5208.21.00",
      "goods_description": "Tissus de coton écrus — toile"
    }
  ],
  "documents": [
    {"case_id": "CLR-2026-0042", "filename": "FAC-2026-0891.pdf", "doc_type": "Facture commerciale", "upload_date": "28/06/2026", "status": "valid"},
    {"case_id": "CLR-2026-0042", "filename": "PL-2026-0891.pdf", "doc_type": "Packing list", "upload_date": "28/06/2026", "status": "valid"},
    {"case_id": "CLR-2026-0042", "filename": "CO-MX-2026.pdf", "doc_type": "Certificat d'origine", "upload_date": "29/06/2026", "status": "valid"}
  ]
}
```
