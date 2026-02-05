// public/js/login.js
// Login híbrido: Professor via Supabase Auth; SME liberado apenas para e-mails autorizados.

function waitForSupabaseClient(timeoutMs = 12000, intervalMs = 50) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.supabaseClient) {
        clearInterval(timer);
        resolve(window.supabaseClient);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error("supabaseClient não inicializou a tempo"));
      }
    }, intervalMs);
  });
}

window.loginReal = async function () {
  const perfil = document.getElementById("perfil")?.value; // professor | sme | ...
  const usuario = document.getElementById("usuario")?.value?.trim();
  const senha = document.getElementById("senha")?.value;

  const mensagens = document.getElementById("mensagens");

  function setMsg(texto, tipo = "") {
    if (!mensagens) return;
    mensagens.innerHTML = `<div class="${tipo}">${texto}</div>`;
  }

  if (!perfil) return setMsg("Selecione um perfil.", "erro");
  if (!usuario || !senha) return setMsg("Preencha usuário (e-mail) e senha.", "erro");

  // ⏳ Espera o supabaseClient ficar pronto (evita corrida de scripts)
  let supa;
  try {
    supa = await waitForSupabaseClient();
  } catch (e) {
    console.error(e);
    return setMsg(
      "Supabase não configurado. Verifique /config.js e o carregamento do supabaseClient.js",
      "erro"
    );
  }

  // ✅ Lista de e-mails autorizados a entrar como SME (super usuário)
  // Coloque aqui o(s) e-mail(s) que você cadastrou no Supabase Auth.
  const SME_EMAILS = [
    "sesantabranca@gmail.com",
    // "outro@dominio.com",
  ].map((s) => s.toLowerCase());

  try {
    setMsg("Entrando...", "");

    const { data, error } = await supa.auth.signInWithPassword({
      email: usuario,
      password: senha,
    });

    if (error) {
      console.error(error);
      return setMsg("Login inválido: " + (error.message || "erro"), "erro");
    }

    const user = data?.user;
    if (!user) return setMsg("Falha ao obter usuário autenticado.", "erro");

    const emailLower = (user.email || usuario || "").toLowerCase();

    // ✅ Decide perfil final
    let perfilFinal = "professor";

    if (perfil === "sme") {
      if (!SME_EMAILS.includes(emailLower)) {
        return setMsg(
          "Este usuário não está autorizado como SME. Entre como Professor ou ajuste a lista SME_EMAILS no login.js.",
          "erro"
        );
      }
      perfilFinal = "sme";
    } else if (perfil === "professor") {
      perfilFinal = "professor";
    } else {
      // outros perfis ainda não liberados
      return setMsg("Neste momento, apenas Professor e SME estão disponíveis.", "erro");
    }

    // ✅ Se for professor, garante registro na tabela educsb
    if (perfilFinal === "professor") {
      const { error: upErr } = await supa
        .from("educsb")
        .upsert({ id: user.id }, { onConflict: "id" });

      if (upErr) console.warn("[educsb] upsert falhou:", upErr.message);
    }

    // ✅ Sessão local para o guard.js
    localStorage.setItem(
      "sedsme_session",
      JSON.stringify({
        perfil: perfilFinal,
        usuario: usuario,
        professorId: user.id, // mantém compatibilidade (para professor é essencial; para sme não atrapalha)
        userId: user.id,
        loginEm: new Date().toISOString(),
      })
    );

    setMsg("Login OK.", "success");

    // ✅ Redireciona conforme perfil
    const destino = perfilFinal === "sme" ? "sme.html" : "professor.html";
    const urlFinal = new URL(destino, window.location.href).toString();
    window.location.assign(urlFinal);
  } catch (err) {
    console.error(err);
    setMsg("Erro ao realizar login. Veja o Console (F12).", "erro");
  }
};
