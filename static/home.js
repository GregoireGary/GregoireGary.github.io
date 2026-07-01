(function() {
    var modal = document.getElementById('feedbackModal');
    var openBtn = document.getElementById('openFeedback');
    var closeBtn = document.getElementById('closeFeedback');
    var form = document.getElementById('feedbackForm');
    var status = document.getElementById('feedbackStatus');
    var sendBtn = document.getElementById('sendFeedbackBtn');

    if (!modal || !openBtn || !closeBtn || !form || !status || !sendBtn) {
        return;
    }

    function openModal() {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        status.textContent = '';
        status.className = 'home-feedback-status';
        var msgField = document.getElementById('feedbackMessage');
        if (msgField) {
            msgField.focus();
        }
    }

    function closeModal() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    function setStatus(message, type) {
        status.textContent = message || '';
        status.className = 'home-feedback-status' + (type ? ' ' + type : '');
    }

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function(evt) {
        if (evt.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', function(evt) {
        if (evt.key === 'Escape' && modal.classList.contains('open')) {
            closeModal();
        }
    });

    form.addEventListener('submit', async function(evt) {
        evt.preventDefault();

        var formData = new FormData(form);
        var payload = {
            name: (formData.get('name') || '').toString().trim(),
            email: (formData.get('email') || '').toString().trim(),
            message: (formData.get('message') || '').toString().trim()
        };

        if (payload.message.length < 5) {
            setStatus('Le message doit contenir au moins 5 caracteres.', 'error');
            return;
        }

        sendBtn.disabled = true;
        setStatus('Envoi en cours...', '');

        try {
            var response = await fetch('/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            var data = await response.json();

            if (!response.ok) {
                setStatus((data && data.error) || 'Impossible d\'envoyer le message.', 'error');
                return;
            }

            setStatus('Merci, votre message a bien ete envoye.', 'success');
            form.reset();

            setTimeout(function() {
                closeModal();
            }, 900);
        } catch (err) {
            setStatus('Erreur reseau. Merci de reessayer.', 'error');
        } finally {
            sendBtn.disabled = false;
        }
    });
})();
