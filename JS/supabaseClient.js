// Public/JS/supabaseClient.js
// Inicializa o cliente Supabase aguardando config.js (Render pode demorar)

(function () {

  // 🔹 Aguarda as variáveis do backend ficarem disponíveis
  function waitForConfig(timeoutMs = 15000, intervalMs = 50) {
    return new Promise((resolve) => {
      const start = Date.now();

      const timer = setInterval(() => {
        const url = window.__SUPABASE_URL__;
        const anon = window.__SUPABASE_ANON_KEY__;

        if (url && anon) {
          clearInterval(timer);
          resolve({ url, anon, timedOut: false });
          return;
        }

        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          resolve({
            url: url || "",
            anon: anon || "",
            timedOut: true
          });
        }

      }, intervalMs);
    });
  }

  // 🔹 Inicializa quando página carregar
  document.addEventListener("DOMContentLoaded", async () => {

    const { url, anon, timedOut } = await waitForConfig();

    // 1️⃣ Verifica se config carregou
    if (!url || !anon) {

      console.error("[SEDSME] Supabase não configurado.");
      console.log("[SEDSME] timedOut:", timedOut);
      console.log("[SEDSME] URL:", window.__SUPABASE_URL__);
      console.log("[SEDSME] ANON:", window.__SUPABASE_ANON_KEY__);
      console.trace();

      alert("Erro: Supabase não configurado. Verifique o backend.");
      return;
    }

    // 2️⃣ Verifica biblioteca Supabase
    if (!window.supabase || typeof window.supabase.createClient !== "function") {

      console.error("[SEDSME] Biblioteca supabase-js não carregada.");
      alert("Erro: Biblioteca Supabase não carregada.");
      return;
    }

    // 3️⃣ Cria cliente Supabase
    window.supabaseClient = window.supabase.createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

    console.log("[SEDSME] Supabase inicializado com sucesso.");

  });

})();

