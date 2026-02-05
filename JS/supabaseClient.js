// public/js/supabaseClient.js
// Cria um client do Supabase usando chaves fornecidas pelo servidor em /config.js.
// Requer o CDN do supabase-js v2 carregado antes deste arquivo.

(function () {
  const url = window.__SUPABASE_URL__;
  const anon = window.__SUPABASE_ANON_KEY__;

  if (!url || !anon) {
    console.error("[Supabase] URL/ANON não configurados. Verifique /config.js e variáveis do Render.");
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[Supabase] Biblioteca supabase-js não carregada (CDN).");
    return;
  }

  window.supabaseClient = window.supabase.createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
})();
