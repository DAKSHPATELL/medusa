"""Pré-chargement des données de démo pour le portail douanier mocké.

Réinitialise entièrement la base : supprime douane.db, recrée le schéma
et insère les 3 dossiers + les 3 documents validés du dossier CLR-2026-0042.
Aucun message n'est pré-chargé (le hold est déclenché en direct via /admin).
"""

import database
import database as db


CASES = [
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
        "currency": "EUR",
        "hs_code": "8708.99.97",
        "goods_description": "Pièces détachées automobiles — supports moteur en aluminium",
        "origin_country": "MX",
        "weight_net_kg": 340,
        "quantity": "200 pcs",
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
        "importer_address": "8 avenue de la Gare, 69003 Lyon",
        "exporter_name": "SHENZHEN LIANHE ELECTRONICS",
        "exporter_id": "CN914403001234567A",
        "exporter_address": "Nanshan District, Shenzhen, Chine",
        "representative_name": "Maria FOURNIER",
        "representative_badge": "RD-2024-1847",
        "carrier_name": "FEDEX EXPRESS",
        "carrier_scac": "FDXE",
        "declared_value": 4200.00,
        "invoice_value": 4200.00,
        "freight": 380.00,
        "insurance": 0.00,
        "incoterm": "DAP",
        "currency": "EUR",
        "hs_code": "8542.31.00",
        "goods_description": "Circuits intégrés — microcontrôleurs ARM Cortex-M4",
        "origin_country": "CN",
        "weight_net_kg": 12,
        "quantity": "5 000 pcs",
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
        "importer_address": "22 rue des Canuts, 69004 Lyon",
        "exporter_name": "ISTANBUL TEXTILE A.Ş.",
        "exporter_id": "TR1234567890",
        "exporter_address": "Merter, Istanbul, Turquie",
        "representative_name": "Maria FOURNIER",
        "representative_badge": "RD-2024-1847",
        "carrier_name": "DHL EXPRESS FRANCE",
        "carrier_scac": "DHLF",
        "declared_value": 8750.00,
        "invoice_value": 8750.00,
        "freight": 640.00,
        "insurance": 0.00,
        "incoterm": "CIF",
        "currency": "EUR",
        "hs_code": "5208.21.00",
        "goods_description": "Tissus de coton écrus — toile",
        "origin_country": "TR",
        "weight_net_kg": 210,
        "quantity": "1 200 m",
    },
]

DOCUMENTS = [
    {"case_id": "CLR-2026-0042", "filename": "FAC-2026-0891.pdf",
     "doc_type": "Facture commerciale", "upload_date": "28/06/2026", "status": "valid"},
    {"case_id": "CLR-2026-0042", "filename": "PL-2026-0891.pdf",
     "doc_type": "Packing list", "upload_date": "28/06/2026", "status": "valid"},
    {"case_id": "CLR-2026-0042", "filename": "CO-MX-2026.pdf",
     "doc_type": "Certificat d'origine", "upload_date": "29/06/2026", "status": "valid"},
    {"case_id": "CLR-2026-0038", "filename": "FAC-2026-0745.pdf",
     "doc_type": "Facture commerciale", "upload_date": "26/06/2026", "status": "valid"},
    {"case_id": "CLR-2026-0031", "filename": "FAC-2026-0611.pdf",
     "doc_type": "Facture commerciale", "upload_date": "23/06/2026", "status": "valid"},
]


def _populate():
    """Insère les dossiers, documents et actions de démo dans une base vide."""
    conn = db.get_connection()
    columns = [
        "case_id", "mrn", "declaration_type", "filing_date", "customs_office",
        "status", "importer_name", "importer_eori", "importer_address",
        "exporter_name", "exporter_id", "exporter_address",
        "representative_name", "representative_badge", "carrier_name",
        "carrier_scac", "declared_value", "invoice_value", "freight",
        "insurance", "incoterm", "currency", "hs_code", "goods_description",
        "origin_country", "weight_net_kg", "quantity",
    ]
    placeholders = ", ".join("?" for _ in columns)
    for case in CASES:
        values = [case.get(c) for c in columns]
        conn.execute(
            f"INSERT INTO cases ({', '.join(columns)}) VALUES ({placeholders})",
            values,
        )
    conn.commit()
    conn.close()

    for doc in DOCUMENTS:
        db.add_document(
            doc["case_id"], doc["filename"], doc["doc_type"],
            doc["upload_date"], doc["status"],
        )

    db.log_action("CLR-2026-0042", "system", "declaration_filed",
                  "Déclaration IM-A déposée au bureau FR003300 — Le Havre Port")
    db.log_action("CLR-2026-0038", "system", "declaration_filed",
                  "Déclaration IM-A déposée au bureau FR003300 — Le Havre Port")
    db.log_action("CLR-2026-0031", "system", "release_granted",
                  "Mainlevée accordée — dédouanement terminé")


def seed():
    """Réinitialise complètement la base (usage CLI : `python seed.py`)."""
    if database.DB_PATH.exists():
        database.DB_PATH.unlink()
    db.init_db()
    _populate()
    print("Base de démo initialisée :", database.DB_PATH)
    print(f"  {len(CASES)} dossiers, {len(DOCUMENTS)} documents, 0 message.")


def seed_if_empty():
    """Amorce la base uniquement si elle ne contient aucun dossier.

    Appelé au démarrage de l'application pour qu'un déploiement cloud
    (système de fichiers vierge) dispose des données de démo sans étape
    manuelle, tout en préservant l'état d'une démo déjà en cours.
    """
    db.init_db()
    if not db.list_cases():
        _populate()


if __name__ == "__main__":
    seed()
