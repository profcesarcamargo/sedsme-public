
/* Public/JS/sme.js
 * SME (Supabase) — Painel de gestão
 * - Professores: cadastra/atualiza em educsb + define tipo_de_usuario em usuarios (quando aplicável)
 * - Turmas: cria/edita/exclui por escola + período
 * - Atribuições: professor_turmas
 * - Estudantes: gerenciar estudantes por turma (estudantes + turma_estudantes)
 *
 * Observação importante:
 * Para evitar erros de "coluna não existe", este arquivo usa SELECT * e trata variações de nomes
 * (ex.: role / tipo_de_usuario / tipo_de_usuário, etc.).
 */

(function () {
  "use strict";

  /* =======================
     Helpers
  ======================= */
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  const norm = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .toLowerCase()
      .trim();

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text ?? "";
  }

  function showMsg(id, text, ok = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text ?? "";
    el.style.color = ok ? "#1a7f37" : "#b00020";
  }

  function getVal(...ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return String(el.value ?? "").trim();
    }
    return "";
  }

  function setVal(val, ...ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.value = val ?? "";
        return;
      }
    }
  }

  function openDialog(id) {
    const dlg = document.getElementById(id);
    if (!dlg) return;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.style.display = "flex";
  }

  function closeDialog(id) {
    const dlg = document.getElementById(id);
    if (!dlg) return;
    if (typeof dlg.close === "function") dlg.close();
    else dlg.style.display = "none";
  }

  function openOverlay(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = "flex";
  }
  function closeOverlay(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = "none";
  }

  /* =======================
     Supabase
  ======================= */
  function supa() {
    return window.supabaseClient || window.supabase;
  }

  async function getSession() {
    const client = supa();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data?.session || null;
  }

  function pickFirst(obj, keys) {
    if (!obj) return undefined;
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
    }
    return undefined;
  }

  // tenta achar uma key real existente no objeto (ignora acentos)
  function findKey(obj, wantedKeys) {
    if (!obj) return null;
    const entries = Object.keys(obj);
    const wanted = wantedKeys.map(norm);
    for (const k of entries) {
      if (wanted.includes(norm(k))) return k;
    }
    return null;
  }

  async function requireSME() {
    const client = supa();
    if (!client) throw new Error("Supabase não configurado (supabaseClient).");

    const session = await getSession();
    if (!session) {
      window.location.href = "/index1.html";
      return null;
    }

    // Seleciona tudo pra não quebrar se a coluna mudou.
    const { data, error } = await client
      .from("usuarios")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) throw new Error("Erro ao verificar perfil (usuarios): " + error.message);

    const roleKey = findKey(data, ["tipo_de_usuario", "tipo_de_usuário", "role", "rola"]);
    const roleVal = norm(roleKey ? data?.[roleKey] : "");

    // Fallback: se a coluna de role mudou, a linha não apareceu por RLS,
    // ou ainda não foi preenchida, permita acesso quando o email estiver
    // em uma allowlist (definida no login.js como SME_EMAILS).
    function emailIsAllowed(email) {
      const e = norm(email);
      if (!e) return false;
      const list = Array.isArray(window.SME_EMAILS) ? window.SME_EMAILS : null;
      if (list && list.some((it) => norm(it) === e)) return true;
      // compatibilidade: permite configurar via localStorage (lista separada por vírgula)
      try {
        const raw = localStorage.getItem("SME_EMAILS") || localStorage.getItem("sedsme_sme_emails");
        if (raw) {
          const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
          if (arr.some((it) => norm(it) === e)) return true;
        }
      } catch {}
      return false;
    }

    if (roleVal !== "sme") {
      const emailOk = emailIsAllowed(session.user.email || "");
      if (!emailOk) {
        alert("Acesso restrito ao perfil SME.");
        window.location.href = "/index1.html";
        return null;
      }
      // Se entrou por allowlist, mostramos aviso no status (sem bloquear).
      setText("sbStatus", "SME (allowlist)");
    }

    // UI userbox
    setText("smeUserName", "SME");
    setText("smeUserEmail", session.user.email || "");
    return session;
  }

  /* =======================
     Navegação (menu -> views)
  ======================= */
  window.navegar = function (pagina, ev) {
    qsa("section.view").forEach((v) => v.classList.add("hidden"));
    const alvo = document.getElementById("view-" + pagina);
    if (alvo) alvo.classList.remove("hidden");

    qsa(".menu__item, .menu-item").forEach((i) => i.classList.remove("active"));
    if (ev?.currentTarget) ev.currentTarget.classList.add("active");

    // título da página
    const map = { dashboard: "Dashboard", professores: "Professores", turmas: "Turmas", usuarios: "Usuários" };
    setText("pageTitle", map[pagina] || "Dashboard");
  };

  function hookMenuFallback() {
    qsa("[data-view]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        const pg = el.getAttribute("data-view");
        if (!pg) return;
        ev.preventDefault();
        window.navegar(pg, ev);
      });
    });
  }

  /* =======================
     Estado
  ======================= */
  const STATE = {
    professores: [],
    turmas: [],
    atribuicoes: [],
    usuarios: [],
    estudantes: [],
    // colunas reais detectadas
    usuariosCols: { role: null, nome: null },
    turmaEstudantesCols: { estudanteRef: null }, // estudante_id OU estudante_nome (uuid)
  };

  /* =======================
     Loaders (com SELECT *)
  ======================= */
  async function loadProfessores() {
    const client = supa();
    const { data, error } = await client.from("educsb").select("*").order("nome", { ascending: true });
    if (error) throw new Error("Erro ao carregar professores (educsb): " + error.message);

    STATE.professores = (data || []).map((p) => {
      const nome = (pickFirst(p, ["nome"]) || "").toString().trim() || "(sem nome)";
      const matricula = (pickFirst(p, ["matricula", "matrícula", "codigo"]) || "").toString().trim();
      const escola = (pickFirst(p, ["escola", "unidade", "unidade_escolar"]) || "").toString().trim();
      const email = (pickFirst(p, ["email"]) || "").toString().trim();
      return { id: p.id, nome, matricula, escola, email };
    });
  }

  async function loadTurmas() {
    const client = supa();
    const { data, error } = await client.from("turmas").select("*").order("nome", { ascending: true });
    if (error) throw new Error("Erro ao carregar turmas (turmas): " + error.message);

    STATE.turmas = (data || []).map((t) => {
      const nome = (pickFirst(t, ["nome"]) || "").toString().trim() || "(sem nome)";
      const escola = (pickFirst(t, ["escola"]) || "").toString().trim();
      const periodo = (pickFirst(t, ["periodo", "período"]) || "").toString().trim();
      return { id: t.id, nome, escola, periodo };
    });
  }

  async function loadAtribuicoes() {
    const client = supa();
    const { data, error } = await client
      .from("professor_turmas")
      .select("professor_id,turma_id,criado_em")
      .order("criado_em", { ascending: false });

    if (error) throw new Error("Erro ao carregar atribuições (professor_turmas): " + error.message);
    STATE.atribuicoes = data || [];
  }

  async function loadUsuarios() {
    const client = supa();
    const { data, error } = await client.from("usuarios").select("*").order("id", { ascending: true });
    if (error) throw new Error("Erro ao carregar usuários (usuarios): " + error.message);

    const sample = (data && data[0]) || null;
    STATE.usuariosCols.role = sample ? findKey(sample, ["tipo_de_usuario", "tipo_de_usuário", "role", "rola"]) : null;
    STATE.usuariosCols.nome = sample ? findKey(sample, ["nome_usuario", "nome_usuário", "nome"]) : null;

    STATE.usuarios = (data || []).map((u) => {
      const roleKey = STATE.usuariosCols.role || findKey(u, ["tipo_de_usuario", "tipo_de_usuário", "role", "rola"]);
      const nomeKey = STATE.usuariosCols.nome || findKey(u, ["nome_usuario", "nome_usuário", "nome"]);
      return {
        id: u.id,
        tipo: (roleKey ? u[roleKey] : "") || "",
        nome: (nomeKey ? u[nomeKey] : "") || "",
        email: (u.email || "") + "",
      };
    });
  }

  async function loadEstudantes() {
    const client = supa();
    // esta tabela foi criada por você. Se não existir ainda, não quebra.
    const { data, error } = await client.from("estudantes").select("*").order("criado_em", { ascending: false });
    if (error) {
      // Se ainda não existir, apenas zera.
      if (String(error.message || "").toLowerCase().includes("relation") || String(error.message || "").includes("does not exist")) {
        STATE.estudantes = [];
        return;
      }
      throw new Error("Erro ao carregar estudantes (estudantes): " + error.message);
    }

    STATE.estudantes = (data || []).map((e) => {
      const nome = (pickFirst(e, ["estudante_nome", "nome"]) || "").toString().trim() || "(sem nome)";
      const ra = (pickFirst(e, ["ra"]) || "").toString().trim();
      return { id: e.id, nome, ra };
    });
  }

  async function detectTurmaEstudantesColumns() {
    const client = supa();
    const { data, error } = await client.from("turma_estudantes").select("*").limit(1);
    if (error) {
      STATE.turmaEstudantesCols.estudanteRef = null;
      return;
    }
    const sample = (data && data[0]) || null;
    if (!sample) {
      // padrão: estudante_id
      STATE.turmaEstudantesCols.estudanteRef = "estudante_id";
      return;
    }
    // coluna que referencia estudantes (uuid)
    const key = findKey(sample, ["estudante_id", "estudante_nome", "estudante_uuid"]);
    STATE.turmaEstudantesCols.estudanteRef = key || "estudante_id";
  }

  /* =======================
     Render (Dashboard)
  ======================= */
  function refreshKPIs() {
    setText("kpiProf", String(STATE.professores.length));
    setText("kpiTurmas", String(STATE.turmas.length));
    setText("kpiAtrib", String(STATE.atribuicoes.length));
    setText("kpiEstudantes", String(STATE.estudantes.length));
  }

  /* =======================
     Render (Professores)
  ======================= */
  function turmasDoProfessor(profId) {
    const turmaIds = new Set(
      STATE.atribuicoes.filter((a) => String(a.professor_id) === String(profId)).map((a) => String(a.turma_id))
    );
    return STATE.turmas.filter((t) => turmaIds.has(String(t.id))).map((t) => t.nome);
  }

  function renderTabelaProfessores() {
    const tbody = qs("#tblProfessores tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!STATE.professores.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="opacity:.8;padding:14px;">Nenhum professor encontrado.</td></tr>`;
      return;
    }

    for (const p of STATE.professores) {
      const turmas = turmasDoProfessor(p.id);
      const turmasTxt = turmas.length ? turmas.join(", ") : "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.nome)}</td>
        <td>${escapeHtml(p.matricula || "-")}</td>
        <td>${escapeHtml(p.escola || "-")}</td>
        <td>${escapeHtml(turmasTxt)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn--small" data-action="atribuirmodal" data-prof="${escapeHtml(p.id)}">Atribuir</button>
          <button class="btn btn--small" data-action="removermodal" data-prof="${escapeHtml(p.id)}">Remover</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderSelectProfessores(idSelect) {
    const sel = document.getElementById(idSelect);
    if (!sel) return;
    sel.innerHTML =
      `<option value="">Selecione...</option>` +
      STATE.professores.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`).join("");
  }

  function renderSelectTurmas(idSelect) {
    const sel = document.getElementById(idSelect);
    if (!sel) return;
    sel.innerHTML =
      `<option value="">Selecione...</option>` +
      STATE.turmas.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nome)}</option>`).join("");
  }

  /* =======================
     Render (Turmas)
  ======================= */
  async function countEstudantesDaTurma(turmaId) {
    const client = supa();
    // se tabela não existir ainda, volta 0
    try {
      const { count, error } = await client
        .from("turma_estudantes")
        .select("*", { count: "exact", head: true })
        .eq("turma_id", turmaId);
      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  async function renderTabelaTurmas() {
    const tbody = qs("#tblTurmas tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!STATE.turmas.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="opacity:.8;padding:14px;">Nenhuma turma encontrada.</td></tr>`;
      return;
    }

    // render com contagem (leve, mas ok no tamanho atual)
    for (const t of STATE.turmas) {
      const qtd = await countEstudantesDaTurma(t.id);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(t.nome)}</td>
        <td>${escapeHtml(t.escola || "-")}</td>
        <td>${escapeHtml(t.periodo || "-")}</td>
        <td style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:.86em;">
          ${escapeHtml(t.id)}
        </td>
        <td>${qtd}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn--small" data-action="turma-editar" data-turma="${escapeHtml(t.id)}">Editar</button>
          <button class="btn btn--small btn--ghost" data-action="turma-excluir" data-turma="${escapeHtml(t.id)}">Excluir</button>
          <button class="btn btn--small" data-action="turma-estudantes" data-turma="${escapeHtml(t.id)}">Estudantes</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  /* =======================
     Render (Usuários) — somente exibir: tipo, nome, id
  ======================= */
  function renderTabelaUsuarios() {
    const tbody = qs("#tblUsuarios tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!STATE.usuarios.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="opacity:.8;padding:14px;">Nenhum usuário encontrado.</td></tr>`;
      return;
    }

    for (const u of STATE.usuarios) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(u.tipo || "-")}</td>
        <td>${escapeHtml(u.nome || u.email || "-")}</td>
        <td style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:.86em;">
          ${escapeHtml(u.id)}
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  /* =======================
     Refresh UI geral
  ======================= */
  async function refreshAllUI() {
    refreshKPIs();

    // Professores
    renderTabelaProfessores();
    renderSelectProfessores("selProfessor");
    renderSelectProfessores("selProfessorRem");
    renderSelectTurmas("selTurma");
    renderSelectTurmas("selTurmaRem");

    // Turmas
    await renderTabelaTurmas();
    renderSelectTurmas("selTurmaEstudantes");

    // Usuários
    renderTabelaUsuarios();
  }

  /* =======================
     CRUD: Professores
  ======================= */
  async function salvarProfessor() {
    const client = supa();
    showMsg("msgCriarProfessor", "", true);

    const id = getVal("inpProfId");
    const nome = getVal("inpProfNome");
    const matricula = getVal("inpProfMatricula");
    const escola = getVal("inpProfEscola");
    const email = getVal("inpProfEmail");

    if (!id) return showMsg("msgCriarProfessor", "Informe o ID (UUID) do usuário do professor (Auth).", false);
    if (!nome) return showMsg("msgCriarProfessor", "Informe o nome.", false);

    // 1) educsb: usa somente colunas existentes (detecta pela 1ª linha, se houver)
    showMsg("msgCriarProfessor", "Salvando...", true);

    const { data: sample, error: sampleErr } = await client.from("educsb").select("*").limit(1);
    if (sampleErr) return showMsg("msgCriarProfessor", "Erro ao acessar educsb: " + sampleErr.message, false);
    const cols = sample && sample[0] ? Object.keys(sample[0]) : ["id", "nome", "escola", "matricula", "email"];

    const payload = { id, nome };
    if (cols.some((c) => norm(c) === "matricula")) payload[cols.find((c) => norm(c) === "matricula")] = matricula || null;
    if (cols.some((c) => norm(c) === "escola")) payload[cols.find((c) => norm(c) === "escola")] = escola || null;
    if (cols.some((c) => norm(c) === "email")) payload[cols.find((c) => norm(c) === "email")] = email || null;

    const { error: upErr } = await client.from("educsb").upsert(payload, { onConflict: "id" });
    if (upErr) return showMsg("msgCriarProfessor", "Não foi possível salvar professor (educsb): " + upErr.message, false);

    // 2) usuarios: definir tipo/nome (sem depender de colunas específicas)
    try {
      const { data: uRow } = await client.from("usuarios").select("*").eq("id", id).maybeSingle();

      const roleKey = findKey(uRow || {}, ["tipo_de_usuario", "tipo_de_usuário", "role", "rola"]) || "tipo_de_usuario";
      const nomeKey = findKey(uRow || {}, ["nome_usuario", "nome_usuário", "nome"]) || "nome_usuario";

      const uPayload = { id };
      uPayload[roleKey] = "professor";
      uPayload[nomeKey] = nome;

      // email pode existir ou não
      if (uRow && Object.prototype.hasOwnProperty.call(uRow, "email")) uPayload.email = email || uRow.email || null;

      await client.from("usuarios").upsert(uPayload, { onConflict: "id" });
    } catch {
      // se não conseguir, não bloqueia o cadastro do professor
    }

    showMsg("msgCriarProfessor", "Professor salvo com sucesso.", true);

    // limpa campos (mantém e-mail opcional)
    setVal("", "inpProfId", "inpProfNome", "inpProfMatricula", "inpProfEscola", "inpProfEmail");
    closeDialog("modalCriarProfessor");

    await loadProfessores();
    await loadUsuarios();
    refreshKPIs();
    await refreshAllUI();
  }

  /* =======================
     CRUD: Turmas
  ======================= */
  async function criarTurma() {
    const client = supa();
    showMsg("msgCriarTurma", "", true);

    const nome = getVal("inpNomeTurma");
    const escola = getVal("inpTurmaEscola");
    const periodo = getVal("inpTurmaPeriodo");

    if (!nome) return showMsg("msgCriarTurma", "Informe o nome da turma.", false);
    if (!escola) return showMsg("msgCriarTurma", "Informe a escola da turma.", false);
    if (!periodo) return showMsg("msgCriarTurma", "Informe o período.", false);

    showMsg("msgCriarTurma", "Salvando...", true);

    // tenta inserir com colunas; se falhar, tenta só com nome (não deve acontecer, mas garante)
    let error = null;
    let res = await client.from("turmas").insert({ nome, escola, periodo });
    error = res.error;

    if (error) {
      res = await client.from("turmas").insert({ nome });
      if (res.error) return showMsg("msgCriarTurma", "Não foi possível criar turma: " + res.error.message, false);
    }

    showMsg("msgCriarTurma", "Turma criada.", true);
    setVal("", "inpNomeTurma", "inpTurmaEscola", "inpTurmaPeriodo");
    closeDialog("modalCriarTurma");

    await loadTurmas();
    await refreshAllUI();
  }

  function openEditarTurma(turmaId) {
    const t = STATE.turmas.find((x) => String(x.id) === String(turmaId));
    if (!t) return;

    setVal(t.id, "inpEditTurmaId");
    setVal(t.nome, "inpEditTurmaNome");
    setVal(t.escola || "", "inpEditTurmaEscola");
    setVal(t.periodo || "", "inpEditTurmaPeriodo");

    showMsg("msgEditarTurma", "", true);
    openDialog("modalEditarTurma");
  }

  async function salvarEdicaoTurma() {
    const client = supa();
    const id = getVal("inpEditTurmaId");
    const nome = getVal("inpEditTurmaNome");
    const escola = getVal("inpEditTurmaEscola");
    const periodo = getVal("inpEditTurmaPeriodo");

    if (!id) return showMsg("msgEditarTurma", "Turma inválida.", false);
    if (!nome) return showMsg("msgEditarTurma", "Informe o nome.", false);
    if (!escola) return showMsg("msgEditarTurma", "Informe a escola.", false);
    if (!periodo) return showMsg("msgEditarTurma", "Informe o período.", false);

    showMsg("msgEditarTurma", "Salvando...", true);
    const { error } = await client.from("turmas").update({ nome, escola, periodo }).eq("id", id);
    if (error) return showMsg("msgEditarTurma", "Não foi possível salvar: " + error.message, false);

    showMsg("msgEditarTurma", "Turma atualizada.", true);
    closeDialog("modalEditarTurma");

    await loadTurmas();
    await refreshAllUI();
  }

  async function excluirTurma(turmaId) {
    const client = supa();
    const t = STATE.turmas.find((x) => String(x.id) === String(turmaId));
    if (!t) return;

    if (!confirm(`Excluir a turma "${t.nome}"?\n\nIsso também removerá atribuições e vínculos de estudantes desta turma.`)) return;

    // apaga vínculos antes (se existir)
    try { await client.from("professor_turmas").delete().eq("turma_id", turmaId); } catch {}
    try { await client.from("turma_estudantes").delete().eq("turma_id", turmaId); } catch {}

    const { error } = await client.from("turmas").delete().eq("id", turmaId);
    if (error) return alert("Não foi possível excluir turma: " + error.message);

    await loadTurmas();
    await loadAtribuicoes();
    await refreshAllUI();
  }

  /* =======================
     CRUD: Atribuições
  ======================= */
  async function atribuirTurma() {
    const client = supa();
    const professorId = getVal("selProfessor");
    const turmaId = getVal("selTurma");

    if (!professorId) return alert("Selecione um professor.");
    if (!turmaId) return alert("Selecione uma turma.");

    const ja = STATE.atribuicoes.some(
      (a) => String(a.professor_id) === String(professorId) && String(a.turma_id) === String(turmaId)
    );
    if (ja) return alert("Essa turma já está atribuída a este professor.");

    const { error } = await client.from("professor_turmas").insert({ professor_id: professorId, turma_id: turmaId });
    if (error) return alert("Não foi possível atribuir: " + error.message);

    closeDialog("modalAtribuirTurma");
    await loadAtribuicoes();
    await refreshAllUI();
    alert("Turma atribuída com sucesso!");
  }

  async function removerTurma() {
    const client = supa();
    const professorId = getVal("selProfessorRem");
    const turmaId = getVal("selTurmaRem");

    if (!professorId) return alert("Selecione um professor.");
    if (!turmaId) return alert("Selecione uma turma.");

    const { error } = await client.from("professor_turmas").delete().eq("professor_id", professorId).eq("turma_id", turmaId);
    if (error) return alert("Não foi possível remover: " + error.message);

    closeDialog("modalRemoverTurma");
    await loadAtribuicoes();
    await refreshAllUI();
    alert("Turma removida com sucesso!");
  }

  /* =======================
     Estudantes por turma
  ======================= */
  async function carregarEstudantesDaTurma(turmaId) {
    const client = supa();
    const refCol = STATE.turmaEstudantesCols.estudanteRef || "estudante_id";

    const { data, error } = await client
      .from("turma_estudantes")
      .select("*")
      .eq("turma_id", turmaId)
      .order("criado_em", { ascending: false });

    if (error) throw new Error("Erro ao carregar estudantes (turma_estudantes): " + error.message);

    const ids = (data || [])
      .map((r) => r?.[refCol])
      .filter(Boolean)
      .map(String);

    // busca nomes na tabela estudantes
    let alunos = [];
    if (ids.length) {
      const { data: studs, error: e2 } = await client.from("estudantes").select("*").in("id", ids);
      if (e2) throw new Error("Erro ao carregar estudantes (estudantes): " + e2.message);

      const map = new Map((studs || []).map((s) => [String(s.id), s]));
      alunos = ids
        .map((id) => map.get(String(id)))
        .filter(Boolean)
        .map((s) => ({
          id: s.id,
          nome: (pickFirst(s, ["estudante_nome", "nome"]) || "").toString(),
          ra: (pickFirst(s, ["ra"]) || "").toString(),
        }));
    }

    return alunos;
  }

  function renderListaEstudantesTurma(alunos, turmaId) {
    const wrap = document.getElementById("listEstudantesTurma");
    if (!wrap) return;

    if (!alunos.length) {
      wrap.innerHTML = `<div class="muted">Nenhum estudante nesta turma.</div>`;
      return;
    }

    wrap.innerHTML = alunos
      .map(
        (a) => `
        <div class="sb-item" style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div class="meta">
            <div class="t">${escapeHtml(a.nome)}</div>
            <div class="s muted">RA: ${escapeHtml(a.ra || "-")}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn--small btn--ghost" data-action="estu-remover-turma" data-turma="${escapeHtml(turmaId)}" data-estu="${escapeHtml(a.id)}">Remover</button>
          </div>
        </div>
      `
      )
      .join("");
  }

  async function abrirGerenciarEstudantes(turmaId) {
    // seleciona turma no select e carrega lista
    setVal(turmaId, "selTurmaEstudantes");
    setText("msgEstudantes", "");
    setVal("", "inpEstudanteNome", "inpEstudanteRA");

    openOverlay("modalGerenciarEstudantes");
    await atualizarListaEstudantesModal();
  }

  async function atualizarListaEstudantesModal() {
    const turmaId = getVal("selTurmaEstudantes");
    if (!turmaId) {
      const wrap = document.getElementById("listEstudantesTurma");
      if (wrap) wrap.innerHTML = `<div class="muted">Selecione uma turma.</div>`;
      return;
    }

    try {
      const alunos = await carregarEstudantesDaTurma(turmaId);
      renderListaEstudantesTurma(alunos, turmaId);
    } catch (e) {
      console.error(e);
      setText("msgEstudantes", e.message || String(e));
    }
  }

  async function addEstudanteNaTurma() {
    const client = supa();
    const turmaId = getVal("selTurmaEstudantes");
    const nome = getVal("inpEstudanteNome");
    const ra = getVal("inpEstudanteRA");

    if (!turmaId) return setText("msgEstudantes", "Selecione a turma.");
    if (!nome) return setText("msgEstudantes", "Informe o nome do estudante.");

    setText("msgEstudantes", "Salvando...");

    // 1) cria estudante (sempre texto em estudantes.estudante_nome)
    const { data: ins, error: e1 } = await client
      .from("estudantes")
      .insert({ estudante_nome: nome, ra: ra || null })
      .select("id")
      .maybeSingle();

    if (e1) return setText("msgEstudantes", "Não foi possível cadastrar estudante (estudantes): " + e1.message);

    const estudanteId = ins?.id;
    if (!estudanteId) return setText("msgEstudantes", "Não foi possível obter o ID do estudante.");

    // 2) vincula na turma_estudantes (coluna pode ter nomes diferentes)
    const refCol = STATE.turmaEstudantesCols.estudanteRef || "estudante_id";
    const payload = { turma_id: turmaId };
    payload[refCol] = estudanteId;
    // se existir estudante_ra, salva também
    payload.estudante_ra = ra || null;

    const { error: e2 } = await client.from("turma_estudantes").insert(payload);
    if (e2) return setText("msgEstudantes", "Não foi possível adicionar: " + e2.message);

    setVal("", "inpEstudanteNome", "inpEstudanteRA");
    setText("msgEstudantes", "Adicionado com sucesso!");
    await loadEstudantes();
    await atualizarListaEstudantesModal();
    await renderTabelaTurmas();
    refreshKPIs();
  }

  async function removerEstudanteDaTurma(turmaId, estudanteId) {
    const client = supa();
    const refCol = STATE.turmaEstudantesCols.estudanteRef || "estudante_id";

    const { error } = await client
      .from("turma_estudantes")
      .delete()
      .eq("turma_id", turmaId)
      .eq(refCol, estudanteId);

    if (error) return alert("Não foi possível remover: " + error.message);

    await atualizarListaEstudantesModal();
    await renderTabelaTurmas();
  }

  /* =======================
     Usuários (CRUD simples)
  ======================= */
  async function salvarUsuario() {
    const client = supa();
    showMsg("msgCriarUsuario", "", true);

    const id = getVal("inpUserId");
    const email = getVal("inpUserEmail");
    const role = getVal("selUserRole");

    if (!id) return showMsg("msgCriarUsuario", "Informe o ID (UUID do Auth).", false);
    if (!role) return showMsg("msgCriarUsuario", "Informe o tipo de usuário.", false);

    // tenta descobrir colunas reais
    const roleKey = STATE.usuariosCols.role || "tipo_de_usuario";
    const nomeKey = STATE.usuariosCols.nome || "nome_usuario";

    const payload = { id };
    payload[roleKey] = role;
    payload[nomeKey] = (email || "").split("@")[0] || role;
    // email pode não existir no schema; tenta inserir, se falhar remove e tenta de novo
    payload.email = email || null;

    let { error } = await client.from("usuarios").upsert(payload, { onConflict: "id" });
    if (error && String(error.message || "").toLowerCase().includes("column") && String(error.message || "").toLowerCase().includes("email")) {
      delete payload.email;
      const r2 = await client.from("usuarios").upsert(payload, { onConflict: "id" });
      error = r2.error;
    }
    if (error) return showMsg("msgCriarUsuario", "Não foi possível salvar usuário: " + error.message, false);

    showMsg("msgCriarUsuario", "Usuário salvo.", true);
    setVal("", "inpUserId", "inpUserEmail");
    closeDialog("modalCriarUsuario");

    await loadUsuarios();
    refreshKPIs();
    await refreshAllUI();
  }

  /* =======================
     Hooks (modais e ações)
  ======================= */
  function hookDialogs() {
    // abrir dialog por data-open
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-open]");
      if (!btn) return;
      const id = btn.getAttribute("data-open");
      if (!id) return;
      ev.preventDefault();
      openDialog(id);
    });

    // overlay close por data-close (modalGerenciarEstudantes)
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-close]");
      if (!btn) return;
      const id = btn.getAttribute("data-close");
      if (!id) return;
      ev.preventDefault();
      closeOverlay(id);
    });

    // fecha overlay clicando fora
    const overlay = document.getElementById("modalGerenciarEstudantes");
    if (overlay) {
      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) closeOverlay("modalGerenciarEstudantes");
      });
    }

    // fecha dialogs quando clicar no X (value="cancel") já funciona via <form method="dialog">
  }

  function hookBotoes() {
    qs("#btnSalvarProfessor")?.addEventListener("click", salvarProfessor);
    qs("#btnCriarTurma")?.addEventListener("click", criarTurma);
    qs("#btnSalvarAtribuicao")?.addEventListener("click", atribuirTurma);
    qs("#btnSalvarRemocao")?.addEventListener("click", removerTurma);
    qs("#btnSalvarEditTurma")?.addEventListener("click", salvarEdicaoTurma);

    qs("#btnAddEstudanteTurma")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      addEstudanteNaTurma();
    });

    qs("#selTurmaEstudantes")?.addEventListener("change", atualizarListaEstudantesModal);

    qs("#btnSalvarUsuario")?.addEventListener("click", salvarUsuario);
  }

  function hookTabelaAcoes() {
    // ações em tabelas
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");

      if (action === "atribuirmodal") {
        const profId = btn.getAttribute("data-prof");
        if (profId) setVal(profId, "selProfessor");
        openDialog("modalAtribuirTurma");
        return;
      }

      if (action === "removermodal") {
        const profId = btn.getAttribute("data-prof");
        if (profId) setVal(profId, "selProfessorRem");
        openDialog("modalRemoverTurma");
        return;
      }

      if (action === "turma-editar") {
        const turmaId = btn.getAttribute("data-turma");
        if (turmaId) openEditarTurma(turmaId);
        return;
      }

      if (action === "turma-excluir") {
        const turmaId = btn.getAttribute("data-turma");
        if (turmaId) excluirTurma(turmaId);
        return;
      }

      if (action === "turma-estudantes") {
        const turmaId = btn.getAttribute("data-turma");
        if (turmaId) abrirGerenciarEstudantes(turmaId);
        return;
      }

      if (action === "estu-remover-turma") {
        const turmaId = btn.getAttribute("data-turma");
        const estuId = btn.getAttribute("data-estu");
        if (turmaId && estuId) removerEstudanteDaTurma(turmaId, estuId);
        return;
      }
    });
  }

  /* =======================
     Logout
  ======================= */
  async function sair() {
    try {
      await supa()?.auth?.signOut?.();
    } catch {}
    try { window.SEDSME?.logout?.(); } catch {}
    try { localStorage.removeItem("sedsme_session"); } catch {}
    window.location.href = "/index1.html";
  }

  function hookLogout() {
    const btn = document.getElementById("btnLogout");
    if (!btn) return;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      sair();
    });
  }

  /* =======================
     Init
  ======================= */
  async function initData() {
    await detectTurmaEstudantesColumns();
    await Promise.all([loadProfessores(), loadTurmas(), loadAtribuicoes(), loadUsuarios(), loadEstudantes()]);
    await refreshAllUI();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (!supa()) {
        alert("Supabase não configurado no SME. Verifique se sme.html carrega /config.js + supabaseClient.js.");
        return;
      }

      await requireSME();

      hookMenuFallback();
      hookLogout();
      hookDialogs();
      hookBotoes();
      hookTabelaAcoes();

      await initData();
      window.navegar("dashboard");

      setText("sbStatus", "Online");
    } catch (e) {
      console.error(e);
      alert("Erro no SME: " + (e?.message || e));
    }
  });
})();
