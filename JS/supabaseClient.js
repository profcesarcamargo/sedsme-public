// Public/JS/supabaseClient.js
// Inicializa o cliente Supabase (v2 via CDN)
// As chaves vêm do backend (/config.js no Render)

(function () {
  // Aguarda o carregamento completo da página
  document.addEventListener("DOMContentLoaded", () => {
    const url = window.__SUPABASE_URL__;
    const anon = window.__SUPABASE_ANON_KEY__;

    // 1) Verifica se as variáveis vieram do backend
    if (!url || !anon) {
      console.error("[Supabase] URL/ANON não configurados.");
      alert("Erro: Supabase não configurado. Verifique o backend.");
      return;
    }

    // 2) Verifica se a lib Supabase (CDN) está disponível
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.error("[Supabase] Biblioteca supabase-js (CDN) não carregada.");
      alert("Erro: Biblioteca Supabase não carregada.");
      return;
    }

    // 3) Cria o client Supabase (v2)
    const client = window.supabase.createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

    // 4) Disponibiliza globalmente
    window.supabaseClient = client;

    console.log("[Supabase] Cliente inicializado com sucesso.");
  });
})();
