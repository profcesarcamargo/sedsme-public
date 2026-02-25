// Public/JS/supabaseClient.js
// Inicializa o cliente Supabase aguardando config.js
// Compatível com GitHub Pages e Render

(function () {

  // 🔹 Aguarda config.js definir as variáveis globais
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

  // ✅ PROMISE GLOBAL
  // outros scripts devem aguardar window.__supabaseReady
  window.__supabaseReady = (async () => {

    const { url, anon, timedOut } = await waitForConfig();

    // 1️⃣ Verifica config
    if (!url || !anon) {

      console.error("[SEDSME] Supabase não configurado.");
      console.log("[SEDSME] timedOut:", timedOut);
      console.log("[SEDSME] URL:", window.__SUPABASE_URL__);
      console.log("[SEDSME] ANON:", window.__SUPABASE_ANON_KEY__);
      console.trace();

      throw new Error("Supabase não configurado. config.js não carregou.");
    }

    // 2️⃣ Verifica biblioteca supabase-js
    if (!window.supabase || typeof window.supabase.createClient !== "function") {

      console.error("[SEDSME] Biblioteca supabase-js não carregada.");
      throw new Error("Biblioteca Supabase não carregada.");
    }

    // 3️⃣ Cria cliente
    window.supabaseClient = window.supabase.createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

    console.log("[SEDSME] Supabase inicializado com sucesso.");

    return window.supabaseClient;

  })();

})();
