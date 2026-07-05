/* Polling temps réel côté courtier.
   Toutes les 3 secondes, on interroge /api/notifications pour détecter :
   - de nouveaux messages non lus  → mise à jour du badge "Messagerie"
   - un changement de statut de dossier → rechargement de la page dossier
   Aucune dépendance externe, pas de WebSocket. */

(function () {
    "use strict";

    var POLL_INTERVAL = 3000;
    var lastState = null;

    function currentCaseId() {
        var m = window.location.pathname.match(/\/courtier\/dossier\/([^\/?]+)/);
        return m ? m[1] : null;
    }

    function updateBadge(unread) {
        var link = document.querySelector('.nav a[href="/courtier/messagerie"]');
        if (!link) return;
        var badge = link.querySelector('.badge');
        if (unread > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'badge';
                link.appendChild(document.createTextNode(' '));
                link.appendChild(badge);
            }
            badge.textContent = unread;
        } else if (badge) {
            badge.remove();
        }
    }

    function poll() {
        fetch('/api/notifications')
            .then(function (r) { return r.json(); })
            .then(function (state) {
                updateBadge(state.unread);

                if (lastState) {
                    var caseId = currentCaseId();
                    // Si le statut du dossier affiché a changé → recharger la page
                    if (caseId && lastState.cases && state.cases &&
                        lastState.cases[caseId] !== state.cases[caseId]) {
                        window.location.reload();
                        return;
                    }
                    // Nouveau message reçu → recharger la messagerie si on y est
                    if (state.last_message_id > lastState.last_message_id &&
                        window.location.pathname.indexOf('/courtier/messagerie') === 0) {
                        window.location.reload();
                        return;
                    }
                }
                lastState = state;
            })
            .catch(function () { /* silencieux : réseau momentanément indisponible */ });
    }

    poll();
    setInterval(poll, POLL_INTERVAL);
})();
