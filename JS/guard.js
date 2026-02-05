// Public/js/guard.js
// Proteção de acesso (modo local) usando localStorage.
// Requer que o login salve em "sedsme_session" algo como:
// { perfil, usuario, loginEm, ... }
// Agora também tenta garantir professorId quando perfil = "professor".

(function () {
  const STORAGE_KEY = "sedsme_session";

  function goLogin() {
    // ✅ volta sempre para a raiz (seu login abre em http://localhost:3000/)
    window.location.assign("/");
  }

  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function getSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = safeParse(raw);
    if (!data || typeof data !== "object") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  }

  function setSession(sessionObj) {
    if (!sessionObj || typeof sessionObj !== "object") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionObj));
  }

  function updateSession(patch) {
    const current = getSession() || {};
    const next = { ...current, ...(patch || {}) };
    setSession(next);
    return next;
  }

  function getQueryParam(name) {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get(name);
    } catch {
      return null;
    }
  }

  /**
   * Garante professorId na sessão quando estiver em páginas do perfil "professor".
   * Prioridade:
   * 1) session.professorId (já existe)
   * 2) session.usuarioId / session.userId / session.id (caso login/SME salve)
   * 3) querystring ?professorId=...
   * 4) session.login (se existir e você usar login como id)
   */
  function ensureProfessorId(session) {
    if (!session || session.perfil !== "professor") return session;

    if (session.professorId != null && String(session.professorId).trim() !== "") {
      return session;
    }

    const fromSession =
      session.usuarioId ?? session.userId ?? session.id ?? session.login ?? null;

    const fromQuery = getQueryParam("professorId");

    const candidate = fromSession ?? fromQuery;

    if (candidate == null) return session;

    const professorId = String(candidate).trim();
    if (!professorId) return session;

    // grava de volta para persistir
    return updateSession({ professorId });
  }

  // Exponho no window para cada página chamar
  window.SEDSME = window.SEDSME || {};

  window.SEDSME.requirePerfil = function (perfilEsperado) {
    let session = getSession();
    if (!session) {
      console.warn("[GUARD] Sem sessão. Voltando para login.");
      return goLogin();
    }

    if (!session.perfil) {
      console.warn("[GUARD] Sessão sem perfil. Voltando para login.", session);
      return goLogin();
    }

    if (session.perfil !== perfilEsperado) {
      console.warn(
        `[GUARD] Perfil inválido. Esperado=${perfilEsperado} Atual=${session.perfil}. Voltando para login.`
      );
      return goLogin();
    }

    // ✅ se for professor, tenta garantir professorId na sessão
    if (perfilEsperado === "professor") {
      session = ensureProfessorId(session);
    }

    return true;
  };

  window.SEDSME.requireAnyPerfil = function (perfisPermitidos) {
    let session = getSession();
    if (!session) {
      console.warn("[GUARD] Sem sessão. Voltando para login.");
      return goLogin();
    }

    if (!session.perfil || !Array.isArray(perfisPermitidos) || !perfisPermitidos.includes(session.perfil)) {
      console.warn("[GUARD] Perfil não permitido. Permitidos=", perfisPermitidos, "Atual=", session.perfil);
      return goLogin();
    }

    // ✅ se estiver dentro dos permitidos e for professor, tenta garantir professorId
    if (session.perfil === "professor") {
      session = ensureProfessorId(session);
    }

    return true;
  };

  window.SEDSME.logout = function () {
    localStorage.removeItem(STORAGE_KEY);
    goLogin();
  };

  window.SEDSME.getSession = function () {
    return getSession();
  };

  // ✅ Helpers novos (úteis no login/SME)
  window.SEDSME.setSession = function (sessionObj) {
    setSession(sessionObj);
  };

  window.SEDSME.updateSession = function (patch) {
    return updateSession(patch);
  };
})();
