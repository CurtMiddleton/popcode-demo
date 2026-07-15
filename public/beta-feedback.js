(function() {
  // The Beta Feedback widget (the floating purple pill + report modal) has been
  // removed. This file is kept because every page includes it via
  // <script src="/beta-feedback.js">, and it still does one useful thing:
  // reveal admin-only navigation/links for the admin account.
  if (typeof window === 'undefined') return;

  function init() {
    // Wait for config.js globals (SUPABASE_URL/KEY) to be available.
    if (typeof SUPABASE_URL === 'undefined') {
      setTimeout(init, 100);
      return;
    }
    revealAdminNav();
  }

  function revealAdminNav() {
    if (!window.supabase || !window.supabase.createClient) return;
    try {
      var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      client.auth.getSession().then(function(res) {
        var email = res && res.data && res.data.session && res.data.session.user && res.data.session.user.email;
        if (!email) return;
        if (email.toLowerCase() !== 'curtmid@gmail.com') return;
        var nodes = document.querySelectorAll('.nav-link-admin, .admin-only');
        for (var i = 0; i < nodes.length; i++) nodes[i].style.display = '';
      }).catch(function() {});
    } catch (e) { /* silent */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
