"""SQLite helpers for the DELTA-X Fret Express mock customs portal.

État partagé entre l'interface courtier et l'interface agent douanier.
On utilise le module standard sqlite3 (synchrone) : largement suffisant
pour une maquette de démo, et zéro dépendance supplémentaire.
"""

import os
import sqlite3
from pathlib import Path

# Chemin de la base : surchargé par la variable d'environnement DOUANE_DB
# pour pointer vers un volume persistant en production (ex. /data/douane.db).
DB_PATH = Path(os.environ.get("DOUANE_DB", Path(__file__).parent / "douane.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
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
    value_justification TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT REFERENCES cases(case_id),
    sender TEXT,           -- 'customs' ou 'broker'
    sender_name TEXT,
    recipient TEXT,
    subject TEXT,
    body TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT REFERENCES cases(case_id),
    filename TEXT,
    doc_type TEXT,
    upload_date TEXT,
    status TEXT DEFAULT 'valid',  -- valid, missing, pending
    requested_by TEXT,
    deadline TEXT
);

CREATE TABLE IF NOT EXISTS actions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT,
    actor TEXT,            -- 'system', 'customs', 'broker'
    action_type TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------

def list_cases():
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM cases ORDER BY filing_date DESC, case_id DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_case(case_id):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM cases WHERE case_id = ?", (case_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_case(case_id, fields):
    if not fields:
        return
    fields = dict(fields)
    fields["updated_at"] = "CURRENT_TIMESTAMP"
    conn = get_connection()
    # Build the SET clause; updated_at handled specially so it stays a raw SQL keyword.
    assignments = []
    values = []
    for key, value in fields.items():
        if key == "updated_at":
            assignments.append("updated_at = CURRENT_TIMESTAMP")
        else:
            assignments.append(f"{key} = ?")
            values.append(value)
    values.append(case_id)
    conn.execute(
        f"UPDATE cases SET {', '.join(assignments)} WHERE case_id = ?", values
    )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def list_messages(case_id=None):
    conn = get_connection()
    if case_id:
        rows = conn.execute(
            "SELECT * FROM messages WHERE case_id = ? ORDER BY created_at DESC, id DESC",
            (case_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM messages ORDER BY created_at DESC, id DESC"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_message(msg_id):
    conn = get_connection()
    row = conn.execute("SELECT * FROM messages WHERE id = ?", (msg_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def add_message(case_id, sender, sender_name, recipient, subject, body, is_read=0):
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO messages (case_id, sender, sender_name, recipient, subject, body, is_read)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (case_id, sender, sender_name, recipient, subject, body, is_read),
    )
    conn.commit()
    msg_id = cur.lastrowid
    conn.close()
    return msg_id


def mark_message_read(msg_id):
    conn = get_connection()
    conn.execute("UPDATE messages SET is_read = 1 WHERE id = ?", (msg_id,))
    conn.commit()
    conn.close()


def count_unread():
    conn = get_connection()
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM messages WHERE is_read = 0"
    ).fetchone()
    conn.close()
    return row["c"]


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

def list_documents(case_id=None):
    conn = get_connection()
    if case_id:
        rows = conn.execute(
            "SELECT * FROM documents WHERE case_id = ? ORDER BY id ASC", (case_id,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM documents ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_document(case_id, filename, doc_type, upload_date, status="valid",
                 requested_by=None, deadline=None):
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO documents (case_id, filename, doc_type, upload_date, status, requested_by, deadline)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (case_id, filename, doc_type, upload_date, status, requested_by, deadline),
    )
    conn.commit()
    doc_id = cur.lastrowid
    conn.close()
    return doc_id


def update_document(doc_id, fields):
    if not fields:
        return
    assignments = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [doc_id]
    conn = get_connection()
    conn.execute(f"UPDATE documents SET {assignments} WHERE id = ?", values)
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Actions log
# ---------------------------------------------------------------------------

def log_action(case_id, actor, action_type, description):
    conn = get_connection()
    conn.execute(
        """INSERT INTO actions_log (case_id, actor, action_type, description)
           VALUES (?, ?, ?, ?)""",
        (case_id, actor, action_type, description),
    )
    conn.commit()
    conn.close()


def list_actions(case_id=None):
    conn = get_connection()
    if case_id:
        rows = conn.execute(
            "SELECT * FROM actions_log WHERE case_id = ? ORDER BY created_at DESC, id DESC",
            (case_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM actions_log ORDER BY created_at DESC, id DESC"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Notifications (polling) — dernier changement d'état / dernier message
# ---------------------------------------------------------------------------

def latest_activity():
    """Renvoie un jeton d'état pour le polling courtier :
    nombre de messages non lus + statut de chaque dossier + max id message."""
    conn = get_connection()
    unread = conn.execute(
        "SELECT COUNT(*) AS c FROM messages WHERE is_read = 0"
    ).fetchone()["c"]
    last_msg = conn.execute("SELECT MAX(id) AS m FROM messages").fetchone()["m"] or 0
    cases = conn.execute("SELECT case_id, status FROM cases").fetchall()
    conn.close()
    return {
        "unread": unread,
        "last_message_id": last_msg,
        "cases": {r["case_id"]: r["status"] for r in cases},
    }
