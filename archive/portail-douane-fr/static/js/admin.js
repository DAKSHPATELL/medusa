/* Interactions côté console agent.
   Confirmations légères avant les actions irréversibles de la démo. */

(function () {
    "use strict";

    function confirmSubmit(formSelector, message) {
        var form = document.querySelector(formSelector);
        if (!form) return;
        form.addEventListener('submit', function (e) {
            if (!window.confirm(message)) {
                e.preventDefault();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        confirmSubmit('form[action$="/release"]',
            'Confirmer l’octroi de la mainlevée ? Le statut passera au vert.');
    });
})();
