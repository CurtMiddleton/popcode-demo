(function() {
  // Only show on non-view pages (viewers shouldn't see this)
  // and only in browser context
  if (typeof window === 'undefined') return;

  // Wait for config.js globals to be available
  function init() {
    if (typeof SUPABASE_URL === 'undefined') {
      setTimeout(init, 100);
      return;
    }
    injectWidget();
  }

  function injectWidget() {
    // Styles
    const style = document.createElement('style');
    style.textContent = `
      #beta-fab {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 9000;
        background: #7657FC;
        color: white;
        border: none;
        border-radius: 20px;
        padding: 7px 13px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        cursor: pointer;
        font-family: 'FilsonPro', sans-serif;
        box-shadow: 0 2px 12px rgba(118,87,252,0.35);
        opacity: 0.75;
        transition: opacity 0.15s;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      #beta-fab:hover { opacity: 1; }
      #beta-fab svg { flex-shrink: 0; }

      #beta-modal-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9100;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      #beta-modal-overlay.visible { display: flex; }

      #beta-modal {
        background: white;
        border-radius: 20px;
        padding: 28px 24px 24px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 12px 48px rgba(0,0,0,0.2);
        font-family: 'FilsonPro', sans-serif;
      }
      #beta-modal h2 {
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 0 0 4px;
      }
      #beta-modal .beta-sub {
        font-size: 13px;
        color: #888;
        margin: 0 0 20px;
        line-height: 1.45;
      }
      #beta-modal label {
        display: block;
        font-size: 12px;
        font-weight: 700;
        color: #555;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      #beta-modal textarea, #beta-modal input[type=text] {
        width: 100%;
        box-sizing: border-box;
        border: 1.5px solid #e0e0e0;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
        font-family: 'FilsonPro', sans-serif;
        color: #1a1a1a;
        outline: none;
        resize: none;
        transition: border-color 0.15s;
        margin-bottom: 14px;
      }
      #beta-modal textarea:focus, #beta-modal input[type=text]:focus {
        border-color: #7657FC;
      }
      #beta-modal-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 4px;
      }
      #beta-cancel-btn {
        background: #eeeeee;
        color: #333;
        border: none;
        border-radius: 20px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: 'FilsonPro', sans-serif;
      }
      #beta-submit-btn {
        background: linear-gradient(135deg, #7657FC 0%, #589AF9 100%);
        color: white;
        border: none;
        border-radius: 20px;
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: 'FilsonPro', sans-serif;
        transition: opacity 0.15s;
      }
      #beta-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      #beta-success {
        display: none;
        text-align: center;
        padding: 16px 0 8px;
      }
      #beta-success .beta-check {
        font-size: 36px;
        margin-bottom: 10px;
      }
      #beta-success p {
        font-size: 15px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 0 0 4px;
      }
      #beta-success small {
        font-size: 12px;
        color: #aaa;
      }
    `;
    document.head.appendChild(style);

    // FAB button
    const fab = document.createElement('button');
    fab.id = 'beta-fab';
    fab.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg> Beta Feedback`;
    document.body.appendChild(fab);

    // Modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'beta-modal-overlay';
    overlay.innerHTML = `
      <div id="beta-modal">
        <h2>Report an Issue</h2>
        <p class="beta-sub">Found a bug or something not working? Let us know — we read every report.</p>
        <div id="beta-form-body">
          <label>What happened?</label>
          <textarea id="beta-desc" rows="4" placeholder="Describe the issue..."></textarea>
          <label>Your email <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span></label>
          <input type="text" id="beta-email" placeholder="so we can follow up"/>
          <div id="beta-modal-actions">
            <button id="beta-cancel-btn">Cancel</button>
            <button id="beta-submit-btn">Send Report</button>
          </div>
        </div>
        <div id="beta-success">
          <div class="beta-check">✓</div>
          <p>Thanks for the report!</p>
          <small>We'll look into it.</small>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Events
    fab.addEventListener('click', function() {
      overlay.classList.add('visible');
      document.getElementById('beta-desc').focus();
    });

    document.getElementById('beta-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });

    document.getElementById('beta-submit-btn').addEventListener('click', submitFeedback);

    function closeModal() {
      overlay.classList.remove('visible');
      // Reset after close
      setTimeout(function() {
        document.getElementById('beta-desc').value = '';
        document.getElementById('beta-email').value = '';
        document.getElementById('beta-form-body').style.display = '';
        document.getElementById('beta-success').style.display = 'none';
        document.getElementById('beta-submit-btn').disabled = false;
      }, 300);
    }

    async function submitFeedback() {
      const desc = document.getElementById('beta-desc').value.trim();
      if (!desc) {
        document.getElementById('beta-desc').focus();
        document.getElementById('beta-desc').style.borderColor = '#ff4444';
        setTimeout(function() { document.getElementById('beta-desc').style.borderColor = ''; }, 1500);
        return;
      }
      const btn = document.getElementById('beta-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      const payload = {
        page_url: window.location.href,
        description: desc,
        email: document.getElementById('beta-email').value.trim() || null,
        user_agent: navigator.userAgent,
        user_id: (window._currentUserId) || null
      };

      try {
        const res = await fetch(SUPABASE_URL + '/rest/v1/beta_feedback', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        document.getElementById('beta-form-body').style.display = 'none';
        document.getElementById('beta-success').style.display = 'block';
        setTimeout(closeModal, 2500);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Send Report';
        alert('Could not send report. Please try again.');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
