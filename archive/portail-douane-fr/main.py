"""DELTA-X Fret Express — Portail douanier mocké.

Application FastAPI mono-fichier exposant :
  - /courtier/*  → interface publique (Maria / Computer Use)
  - /admin/*     → interface agent douanier (marionnettiste en coulisses)
  - /api/*       → API interne (pont SQLite entre les deux)

Lancement :
    python seed.py
    uvicorn main:app --host 0.0.0.0 --port 3000
"""

from datetime import datetime

from fastapi import FastAPI, Form, Request, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import database as db
import seed as seed_module

app = FastAPI(title="DELTA-X Fret Express — Portail douanier (maquette)")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
# Rechargement des templates à chaud (pratique en démo).
templates.env.cache = None

DEMO_CASE = "CLR-2026-0042"
BROKER_NAME = "Maria FOURNIER"
CUSTOMS_NAME = "Bureau FR003300 — Le Havre Port"

STATUS_LABELS = {
    "active": "En cours",
    "hold": "Hold douanier",
    "pending_docs": "Document requis",
    "released": "Mainlevée accordée",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_fr():
    """Date/heure lisible en format administratif français."""
    return datetime.now().strftime("%d/%m/%Y %H:%M")


def today_fr():
    return datetime.now().strftime("%d/%m/%Y")


def nav_context():
    """Contexte commun à toutes les pages courtier (badge messagerie)."""
    return {
        "unread": db.count_unread(),
        "status_labels": STATUS_LABELS,
    }


def value_gap(case):
    """Écart absolu et relatif entre valeur facturée et valeur déclarée."""
    invoice = case.get("invoice_value") or 0
    declared = case.get("declared_value") or 0
    gap_abs = invoice - declared
    gap_pct = (gap_abs / invoice * 100) if invoice else 0
    return gap_abs, gap_pct


@app.on_event("startup")
def ensure_db():
    # Amorce les données de démo si la base est vide (utile en déploiement cloud).
    seed_module.seed_if_empty()


# ===========================================================================
# INTERFACE COURTIER
# ===========================================================================

@app.get("/", response_class=HTMLResponse)
def root():
    return RedirectResponse(url="/courtier/login")


@app.get("/courtier/login", response_class=HTMLResponse)
def courtier_login(request: Request):
    return templates.TemplateResponse(request, "courtier/login.html", {})


@app.post("/courtier/login")
def courtier_login_post(eori: str = Form(None), password: str = Form(None)):
    return RedirectResponse(url="/courtier/dashboard", status_code=303)


@app.get("/courtier/dashboard", response_class=HTMLResponse)
def courtier_dashboard(request: Request):
    cases = db.list_cases()
    counts = {
        "active_total": 42,
        "pending": 7,
        "hold": sum(1 for c in cases if c["status"] == "hold") or 3,
        "released": 32,
    }
    hold_cases = [c for c in cases if c["status"] in ("hold", "pending_docs")]
    ctx = {
        "request": request,
        "cases": cases,
        "counts": counts,
        "hold_cases": hold_cases,
        "demo_case": DEMO_CASE,
        **nav_context(),
    }
    return templates.TemplateResponse(request, "courtier/dashboard.html", ctx)


@app.get("/courtier/declarations", response_class=HTMLResponse)
def courtier_declarations(request: Request, statut: str = "tous"):
    cases = db.list_cases()
    if statut and statut != "tous":
        mapping = {
            "en_cours": ["active"],
            "hold": ["hold", "pending_docs"],
            "mainlevee": ["released"],
        }
        keep = mapping.get(statut, [])
        cases = [c for c in cases if c["status"] in keep]
    ctx = {
        "request": request,
        "cases": cases,
        "statut": statut,
        **nav_context(),
    }
    return templates.TemplateResponse(request, "courtier/declarations.html", ctx)


@app.get("/courtier/dossier/{case_id}", response_class=HTMLResponse)
def courtier_dossier(request: Request, case_id: str, tab: str = "general"):
    case = db.get_case(case_id)
    if not case:
        return HTMLResponse("Dossier introuvable", status_code=404)
    documents = db.list_documents(case_id)
    actions = db.list_actions(case_id)
    gap_abs, gap_pct = value_gap(case)
    ctx = {
        "request": request,
        "case": case,
        "documents": documents,
        "actions": actions,
        "tab": tab,
        "gap_abs": gap_abs,
        "gap_pct": gap_pct,
        **nav_context(),
    }
    return templates.TemplateResponse(request, "courtier/dossier.html", ctx)


@app.post("/courtier/dossier/{case_id}/valeur")
def courtier_submit_value(
    case_id: str,
    declared_value: float = Form(...),
    incoterm: str = Form(None),
    freight: float = Form(0),
    insurance: float = Form(0),
    justification: str = Form(""),
):
    case = db.get_case(case_id)
    if not case:
        return HTMLResponse("Dossier introuvable", status_code=404)
    old_value = case.get("declared_value")
    db.update_case(case_id, {
        "declared_value": declared_value,
        "incoterm": incoterm,
        "freight": freight,
        "insurance": insurance,
        "value_justification": justification,
    })
    db.log_action(
        case_id, "broker", "value_modified",
        f"Valeur en douane modifiée : {old_value:.2f} EUR → {declared_value:.2f} EUR. "
        f"Justification : {justification or '(aucune)'}",
    )
    # Message informatif du courtier vers la douane
    db.add_message(
        case_id, "broker", BROKER_NAME, CUSTOMS_NAME,
        f"Correction de la valeur en douane — Dossier {case_id}",
        f"La valeur déclarée a été corrigée de {old_value:.2f} EUR à "
        f"{declared_value:.2f} EUR.\n\nJustification : {justification or '(aucune)'}",
        is_read=1,
    )
    return RedirectResponse(
        url=f"/courtier/dossier/{case_id}/confirmation", status_code=303
    )


@app.get("/courtier/dossier/{case_id}/confirmation", response_class=HTMLResponse)
def courtier_confirmation(request: Request, case_id: str):
    case = db.get_case(case_id)
    if not case:
        return HTMLResponse("Dossier introuvable", status_code=404)
    gap_abs, gap_pct = value_gap(case)
    ctx = {
        "request": request,
        "case": case,
        "gap_abs": gap_abs,
        "gap_pct": gap_pct,
        **nav_context(),
    }
    return templates.TemplateResponse(request, "courtier/confirmation.html", ctx)


@app.get("/courtier/documents", response_class=HTMLResponse)
def courtier_documents(request: Request, case_id: str = None):
    documents = db.list_documents(case_id)
    cases = db.list_cases()
    ctx = {
        "request": request,
        "documents": documents,
        "cases": cases,
        "selected_case": case_id,
        **nav_context(),
    }
    return templates.TemplateResponse(request, "courtier/documents.html", ctx)


@app.post("/courtier/documents/upload")
async def courtier_documents_upload(
    case_id: str = Form(...),
    doc_type: str = Form(...),
    fichier: UploadFile = File(None),
):
    filename = fichier.filename if fichier and fichier.filename else f"{doc_type}.pdf"
    db.add_document(case_id, filename, doc_type, today_fr(), status="valid")
    db.log_action(
        case_id, "broker", "document_added",
        f"Document joint : {filename} ({doc_type})",
    )
    return RedirectResponse(
        url=f"/courtier/documents?case_id={case_id}", status_code=303
    )


@app.post("/courtier/dossier/{case_id}/documents/upload")
async def courtier_dossier_upload(
    case_id: str,
    doc_type: str = Form(...),
    doc_id: int = Form(None),
    fichier: UploadFile = File(None),
):
    filename = fichier.filename if fichier and fichier.filename else f"{doc_type}.pdf"
    if doc_id:
        # On satisfait une demande existante (ligne "Manquant").
        db.update_document(doc_id, {
            "filename": filename,
            "status": "valid",
            "upload_date": today_fr(),
        })
    else:
        db.add_document(case_id, filename, doc_type, today_fr(), status="valid")
    db.log_action(
        case_id, "broker", "document_added",
        f"Document joint : {filename} ({doc_type})",
    )
    # Notifier la douane
    db.add_message(
        case_id, "broker", BROKER_NAME, CUSTOMS_NAME,
        f"Dépôt de document — {doc_type} — Dossier {case_id}",
        f"Le document « {filename} » ({doc_type}) a été joint au dossier {case_id} "
        f"en réponse à votre demande.",
        is_read=1,
    )
    return RedirectResponse(
        url=f"/courtier/dossier/{case_id}?tab=documents", status_code=303
    )


@app.get("/courtier/messagerie", response_class=HTMLResponse)
def courtier_messagerie(request: Request, msg: int = None):
    messages = db.list_messages()
    selected = None
    if msg:
        selected = db.get_message(msg)
        if selected and not selected["is_read"]:
            db.mark_message_read(msg)
            selected["is_read"] = 1
    elif messages:
        selected = messages[0]
        if selected and not selected["is_read"]:
            db.mark_message_read(selected["id"])
            selected["is_read"] = 1
    # Recharger pour refléter le statut lu
    messages = db.list_messages()
    ctx = {
        "request": request,
        "messages": messages,
        "selected": selected,
        **nav_context(),
    }
    return templates.TemplateResponse(request, "courtier/messagerie.html", ctx)


@app.post("/courtier/messagerie/repondre")
def courtier_messagerie_reply(
    case_id: str = Form(None),
    subject: str = Form(...),
    body: str = Form(...),
):
    db.add_message(
        case_id, "broker", BROKER_NAME, CUSTOMS_NAME,
        subject, body, is_read=1,
    )
    if case_id:
        db.log_action(case_id, "broker", "message_sent",
                      f"Réponse envoyée à la douane : {subject}")
    return RedirectResponse(url="/courtier/messagerie", status_code=303)


@app.get("/courtier/compte", response_class=HTMLResponse)
def courtier_compte(request: Request):
    ctx = {"request": request, **nav_context()}
    return templates.TemplateResponse(request, "courtier/compte.html", ctx)


# ===========================================================================
# INTERFACE AGENT DOUANIER (admin)
# ===========================================================================

@app.get("/admin", response_class=HTMLResponse)
def admin_root():
    return RedirectResponse(url="/admin/login")


@app.get("/admin/login", response_class=HTMLResponse)
def admin_login(request: Request):
    return templates.TemplateResponse(request, "admin/login.html", {})


@app.post("/admin/login")
def admin_login_post(username: str = Form(None), password: str = Form(None)):
    return RedirectResponse(url="/admin/dashboard", status_code=303)


@app.get("/admin/dashboard", response_class=HTMLResponse)
def admin_dashboard(request: Request):
    cases = db.list_cases()
    ctx = {
        "request": request,
        "cases": cases,
        "status_labels": STATUS_LABELS,
    }
    return templates.TemplateResponse(request, "admin/dashboard.html", ctx)


@app.get("/admin/dossier/{case_id}", response_class=HTMLResponse)
def admin_dossier(request: Request, case_id: str):
    case = db.get_case(case_id)
    if not case:
        return HTMLResponse("Dossier introuvable", status_code=404)
    documents = db.list_documents(case_id)
    messages = db.list_messages(case_id)
    gap_abs, gap_pct = value_gap(case)
    ctx = {
        "request": request,
        "case": case,
        "documents": documents,
        "messages": messages,
        "gap_abs": gap_abs,
        "gap_pct": gap_pct,
        "status_labels": STATUS_LABELS,
    }
    return templates.TemplateResponse(request, "admin/dossier.html", ctx)


@app.post("/admin/dossier/{case_id}/hold")
def admin_hold(
    case_id: str,
    motif: str = Form(...),
    detail: str = Form(""),
):
    case = db.get_case(case_id)
    if not case:
        return HTMLResponse("Dossier introuvable", status_code=404)
    db.update_case(case_id, {
        "status": "hold",
        "hold_reason": motif,
        "hold_since": now_fr(),
    })
    invoice = case.get("invoice_value") or 0
    declared = case.get("declared_value") or 0
    body = (
        f"Madame FOURNIER, suite au contrôle automatique de votre déclaration "
        f"n° {case.get('mrn')}, un écart significatif a été constaté entre la "
        f"valeur facturée ({invoice:,.2f} EUR) et la valeur déclarée "
        f"({declared:,.2f} EUR). Conformément à l'article 140 du CDU, vous êtes "
        f"invité à justifier cet écart ou à corriger la valeur déclarée dans un "
        f"délai de 5 jours ouvrés. À défaut, le dossier sera transmis au service "
        f"contentieux.\n\nMotif du contrôle : {motif}."
        + (f"\n{detail}" if detail else "")
        + f"\n\nCordialement,\nService de la valeur — {CUSTOMS_NAME}"
    ).replace(",", " ")
    db.add_message(
        case_id, "customs", CUSTOMS_NAME, BROKER_NAME,
        f"HOLD — {motif} — Dossier {case_id}", body, is_read=0,
    )
    db.log_action(case_id, "customs", "hold_triggered",
                  f"Hold déclenché — motif : {motif}. {detail}".strip())
    return RedirectResponse(url=f"/admin/dossier/{case_id}", status_code=303)


@app.post("/admin/dossier/{case_id}/message")
def admin_message(
    case_id: str,
    subject: str = Form(...),
    body: str = Form(...),
    link_case: str = Form(None),
):
    linked = case_id if link_case else None
    db.add_message(
        linked, "customs", CUSTOMS_NAME, BROKER_NAME,
        subject, body, is_read=0,
    )
    db.log_action(case_id, "customs", "message_sent",
                  f"Message envoyé au courtier : {subject}")
    return RedirectResponse(url=f"/admin/dossier/{case_id}", status_code=303)


@app.post("/admin/dossier/{case_id}/request-document")
def admin_request_document(
    case_id: str,
    doc_type: str = Form(...),
    raison: str = Form(""),
    deadline: str = Form(""),
):
    case = db.get_case(case_id)
    if not case:
        return HTMLResponse("Dossier introuvable", status_code=404)
    db.update_case(case_id, {"status": "pending_docs"})
    db.add_document(
        case_id, "—", doc_type, "", status="missing",
        requested_by="customs", deadline=deadline,
    )
    body = (
        f"Suite au traitement de votre dossier {case_id}, un justificatif "
        f"complémentaire est requis pour valider la modification.\n\n"
        f"Document demandé : {doc_type}.\n"
        + (f"Motif : {raison}\n" if raison else "")
        + (f"Date limite : {deadline}.\n" if deadline else "")
        + f"\nMerci de joindre le document dans les meilleurs délais.\n\n"
        f"Cordialement,\nService de la valeur — {CUSTOMS_NAME}"
    )
    db.add_message(
        case_id, "customs", CUSTOMS_NAME, BROKER_NAME,
        f"DEMANDE DE DOCUMENT — {doc_type} — Dossier {case_id}", body, is_read=0,
    )
    db.log_action(case_id, "customs", "doc_requested",
                  f"Document demandé : {doc_type}. {raison}".strip())
    return RedirectResponse(url=f"/admin/dossier/{case_id}", status_code=303)


@app.post("/admin/dossier/{case_id}/release")
def admin_release(case_id: str, comment: str = Form("")):
    case = db.get_case(case_id)
    if not case:
        return HTMLResponse("Dossier introuvable", status_code=404)
    db.update_case(case_id, {"status": "released", "hold_reason": None})
    body = (
        f"Madame FOURNIER, la mainlevée est accordée pour le dossier {case_id} "
        f"(déclaration n° {case.get('mrn')}). Les marchandises peuvent être "
        f"enlevées.\n"
        + (f"\nCommentaire : {comment}\n" if comment else "")
        + f"\nCordialement,\nService de la valeur — {CUSTOMS_NAME}"
    )
    db.add_message(
        case_id, "customs", CUSTOMS_NAME, BROKER_NAME,
        f"MAINLEVÉE ACCORDÉE — Dossier {case_id}", body, is_read=0,
    )
    db.log_action(case_id, "customs", "release_granted",
                  f"Mainlevée accordée. {comment}".strip())
    return RedirectResponse(url=f"/admin/dossier/{case_id}", status_code=303)


@app.get("/admin/historique", response_class=HTMLResponse)
def admin_historique(request: Request):
    actions = db.list_actions()
    ctx = {"request": request, "actions": actions}
    return templates.TemplateResponse(request, "admin/historique.html", ctx)


# ===========================================================================
# API INTERNE
# ===========================================================================

@app.get("/api/cases")
def api_cases():
    return db.list_cases()


@app.get("/api/cases/{case_id}")
def api_case(case_id: str):
    case = db.get_case(case_id)
    if not case:
        return JSONResponse({"error": "not found"}, status_code=404)
    return case


@app.patch("/api/cases/{case_id}")
async def api_case_patch(case_id: str, request: Request):
    payload = await request.json()
    db.update_case(case_id, payload)
    return db.get_case(case_id)


@app.get("/api/messages")
def api_messages(case_id: str = None):
    return db.list_messages(case_id)


@app.post("/api/messages")
async def api_message_post(request: Request):
    payload = await request.json()
    msg_id = db.add_message(
        payload.get("case_id"),
        payload.get("sender", "customs"),
        payload.get("sender_name", CUSTOMS_NAME),
        payload.get("recipient", BROKER_NAME),
        payload.get("subject", ""),
        payload.get("body", ""),
        payload.get("is_read", 0),
    )
    return db.get_message(msg_id)


@app.patch("/api/messages/{msg_id}/read")
def api_message_read(msg_id: int):
    db.mark_message_read(msg_id)
    return {"ok": True}


@app.get("/api/documents")
def api_documents(case_id: str = None):
    return db.list_documents(case_id)


@app.post("/api/documents")
async def api_document_post(request: Request):
    payload = await request.json()
    doc_id = db.add_document(
        payload.get("case_id"),
        payload.get("filename", ""),
        payload.get("doc_type", ""),
        payload.get("upload_date", today_fr()),
        payload.get("status", "valid"),
        payload.get("requested_by"),
        payload.get("deadline"),
    )
    return {"id": doc_id}


@app.patch("/api/documents/{doc_id}")
async def api_document_patch(doc_id: int, request: Request):
    payload = await request.json()
    db.update_document(doc_id, payload)
    return {"ok": True}


@app.post("/api/admin/hold")
async def api_admin_hold(request: Request):
    payload = await request.json()
    case_id = payload["case_id"]
    motif = payload.get("motif", "Écart de valeur")
    db.update_case(case_id, {
        "status": "hold", "hold_reason": motif, "hold_since": now_fr(),
    })
    db.add_message(
        case_id, "customs", CUSTOMS_NAME, BROKER_NAME,
        f"HOLD — {motif} — Dossier {case_id}",
        payload.get("body", f"Hold déclenché sur le dossier {case_id}."),
        is_read=0,
    )
    db.log_action(case_id, "customs", "hold_triggered", f"Hold — {motif}")
    return db.get_case(case_id)


@app.post("/api/admin/request-document")
async def api_admin_request_document(request: Request):
    payload = await request.json()
    case_id = payload["case_id"]
    doc_type = payload.get("doc_type", "Justificatif fiscal")
    db.update_case(case_id, {"status": "pending_docs"})
    db.add_document(case_id, "—", doc_type, "", status="missing",
                    requested_by="customs", deadline=payload.get("deadline"))
    db.add_message(
        case_id, "customs", CUSTOMS_NAME, BROKER_NAME,
        f"DEMANDE DE DOCUMENT — {doc_type} — Dossier {case_id}",
        payload.get("body", f"Document demandé : {doc_type}."), is_read=0,
    )
    db.log_action(case_id, "customs", "doc_requested", f"Document : {doc_type}")
    return {"ok": True}


@app.post("/api/admin/release")
async def api_admin_release(request: Request):
    payload = await request.json()
    case_id = payload["case_id"]
    db.update_case(case_id, {"status": "released", "hold_reason": None})
    db.add_message(
        case_id, "customs", CUSTOMS_NAME, BROKER_NAME,
        f"MAINLEVÉE ACCORDÉE — Dossier {case_id}",
        payload.get("body", f"Mainlevée accordée pour {case_id}."), is_read=0,
    )
    db.log_action(case_id, "customs", "release_granted", "Mainlevée accordée")
    return db.get_case(case_id)


@app.get("/api/notifications")
def api_notifications(since: str = None):
    """Jeton d'état pour le polling courtier (toutes les 3 s)."""
    return db.latest_activity()
