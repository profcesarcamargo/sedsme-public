// public/js/secretaria.js
// Painel Secretaria - modo local (mock), sem backend.
// Usa localStorage + guard.js (sedsme_session).
//
// ✅ Ajuste (Jan/2026): Módulo "Documentos" removido do perfil Secretaria Escolar.
// - Remove storage, render, dialogs, listeners e init do módulo Documentos.

(function () {
  // ======= Helpers =======
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDateBR(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("pt-BR");
    } catch {
      return iso;
    }
  }

  function normalizeKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  function uniqSorted(arr) {
    return [...new Set(arr.filter(Boolean).map((s) => String(s).trim()))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }

  function safeText(s) {
    return (s ?? "").toString().trim();
  }

  // ======= Storage =======
  const LS_KEY_MATRICULAS = "sedsme_secretaria_matriculas";
  const LS_KEY_ESCOLA_PERFIL_PREFIX = "sedsme_escola_perfil:";

  function loadMatriculas() {
    const raw = localStorage.getItem(LS_KEY_MATRICULAS);
    if (!raw) return seedMatriculas();
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return seedMatriculas();
      return arr;
    } catch {
      return seedMatriculas();
    }
  }

  function saveMatriculas(list) {
    localStorage.setItem(LS_KEY_MATRICULAS, JSON.stringify(list));
  }

  function nextMatriculaId(list) {
    const max = list.reduce((acc, it) => Math.max(acc, Number(it.id) || 0), 0);
    return max + 1;
  }

  function seedMatriculas() {
    const initial = [
      {
        id: 1,
        ra: "000001",
        estudante: "Ana Silva",
        nascimento: "2013-05-10",
        telefone: "(12) 99999-1111",
        serie: "6º Ano",
        turma: "A",
        status: "ATIVA",
        ano: String(new Date().getFullYear()),
        endereco: "Rua Exemplo, 123 - Centro",
        mae: "Maria Silva",
        pai: "João Silva",
        obs: ""
      },
      {
        id: 2,
        ra: "000002",
        estudante: "Bruno Oliveira",
        nascimento: "2012-08-21",
        telefone: "(12) 99999-2222",
        serie: "7º Ano",
        turma: "B",
        status: "ATIVA",
        ano: String(new Date().getFullYear()),
        endereco: "Av. Modelo, 45 - Jardim",
        mae: "Patrícia Oliveira",
        pai: "Carlos Oliveira",
        obs: "Transferido em 2024 (exemplo)"
      }
    ];
    saveMatriculas(initial);
    return initial;
  }

  // ======= Perfil da Escola (logo) =======
  function getEscolaKey() {
    const session =
      window.SEDSME && typeof window.SEDSME.getSession === "function"
        ? window.SEDSME.getSession()
        : null;

    const escolaId =
      session?.escolaId ||
      session?.unidadeId ||
      session?.unidade ||
      session?.escola ||
      "padrao";

    return normalizeKey(escolaId);
  }

  function perfilKey() {
    return LS_KEY_ESCOLA_PERFIL_PREFIX + getEscolaKey();
  }

  function loadPerfilEscola() {
    try {
      const raw = localStorage.getItem(perfilKey());
      if (!raw) return { logoDataUrl: "", nomeEscola: "" };
      const obj = JSON.parse(raw);
      return {
        logoDataUrl: safeText(obj.logoDataUrl),
        nomeEscola: safeText(obj.nomeEscola)
      };
    } catch {
      return { logoDataUrl: "", nomeEscola: "" };
    }
  }

  function savePerfilEscola(data) {
    localStorage.setItem(perfilKey(), JSON.stringify(data));
  }

  function fileToJpgDataUrl(file, { maxSize = 650, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("Arquivo não informado."));
      if (file.type !== "image/jpeg") return reject(new Error("Envie um arquivo JPG/JPEG."));

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Imagem inválida."));
        img.onload = () => {
          const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);

          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ======= Lista Piloto derivada das Matrículas =======
  function getListaPiloto() {
    const mats = loadMatriculas();
    const ordered = [...mats].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

    // Mantém 1 registro por R.A (ou por nome, se não tiver R.A)
    const map = new Map();

    for (const m of ordered) {
      const nome = safeText(m.estudante);
      const ra = safeText(m.ra);
      if (!nome && !ra) continue;

      const key = ra ? `ra:${normalizeKey(ra)}` : `nm:${normalizeKey(nome)}`;
      const prev = map.get(key);

      map.set(key, {
        nome: nome || (prev?.nome || ""),
        ra: ra || (prev?.ra || ""),
        nascimento: safeText(m.nascimento) || (prev?.nascimento || ""),
        telefone: safeText(m.telefone) || (prev?.telefone || ""),
        serie: safeText(m.serie) || (prev?.serie || ""),
        turma: safeText(m.turma) || (prev?.turma || ""),
        status: safeText(m.status) || (prev?.status || ""),
        endereco: safeText(m.endereco) || (prev?.endereco || ""),
        mae: safeText(m.mae) || (prev?.mae || ""),
        pai: safeText(m.pai) || (prev?.pai || ""),
        obs: safeText(m.obs) || (prev?.obs || ""),
        refMatriculaId: m.id
      });
    }

    return [...map.values()].sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" })
    );
  }

  // ======= UI Root =======
  const contentRoot = qs(".content");
  const headerTitle = qs(".header span");

  function applyHeaderInfo() {
    if (headerTitle) headerTitle.textContent = "Painel da Secretaria Escolar";
  }

  // ======= Render Modules =======
  function setActiveMenuByText(label) {
    qsa(".sidebar .menu-item").forEach((it) => {
      const txt = it.textContent.trim().toLowerCase();
      it.classList.toggle("active", txt === label.toLowerCase());
    });
  }

  function isListaPilotoLabel(name) {
    const n = (name || "").trim().toLowerCase();
    return n === "lista piloto" || n === "estudantes"; // compatibilidade
  }

  function renderModule(name) {
    if (!contentRoot) return;

    contentRoot.innerHTML = "";

    const title = document.createElement("div");
    title.className = "card";
    const tituloExibicao = isListaPilotoLabel(name) ? "Lista Piloto" : name;
    title.innerHTML = `<h2>${escapeHtml(tituloExibicao)}</h2>`;
    contentRoot.appendChild(title);

    if ((name || "").trim() === "Matrículas") {
      contentRoot.appendChild(renderMatriculasModule());
      ensureDialogsMatriculasExist();
      initMatriculasUI();
      return;
    }

    if (isListaPilotoLabel(name)) {
      contentRoot.appendChild(renderListaPilotoModule());
      ensureDialogListaPilotoDetalhesExist();
      initListaPilotoUI();
      return;
    }

    if ((name || "").trim() === "Configurações") {
      contentRoot.appendChild(renderConfiguracoesModule());
      initConfiguracoesUI();
      return;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <p>Este módulo ainda está em construção. ✅</p>
      <p>Quando você quiser, a gente adiciona os campos e ações deste módulo passo a passo.</p>
    `;
    contentRoot.appendChild(card);
  }

  // ======= Matrículas Module =======
  function renderMatriculasModule() {
    const wrap = document.createElement("div");
    wrap.className = "card";

    wrap.innerHTML = `
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button id="btnNovaMatricula" class="btn-primary">+ Nova Matrícula</button>

          <select id="filtroTurmaMat" style="padding:10px; border:1px solid #ddd; border-radius:8px;">
            <option value="">Todas as turmas</option>
          </select>

          <input id="filtroMatriculas" type="text"
            placeholder="Buscar por R.A, estudante, série, turma, status, mãe, pai, telefone..."
            style="padding:10px; border:1px solid #ddd; border-radius:8px; min-width:260px;">
        </div>
        <div style="color:#666; font-size:14px;">
          <span id="matCount">0</span> matrícula(s)
        </div>
      </div>

      <div style="margin-top:16px; overflow:auto;">
        <table id="tblMatriculas" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid #eee;">
              <th style="padding:10px;">R.A</th>
              <th style="padding:10px;">Estudante</th>
              <th style="padding:10px;">Série</th>
              <th style="padding:10px;">Turma</th>
              <th style="padding:10px;">Status</th>
              <th style="padding:10px;">Ano</th>
              <th style="padding:10px;">Ações</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    return wrap;
  }

  // ======= Lista Piloto Module (com impressão) =======
  function renderListaPilotoModule() {
    const wrap = document.createElement("div");
    wrap.className = "card";

    wrap.innerHTML = `
      <p style="margin-top:0; color:#64748b;">
        Pesquisa de estudantes derivados das matrículas (somente consulta).
      </p>

      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <select id="filtroTurmaPiloto" style="padding:10px; border:1px solid #ddd; border-radius:8px;">
            <option value="">Todas as séries/turmas</option>
          </select>

          <input id="filtroPiloto" type="text"
            placeholder="Buscar por R.A, nome, telefone, mãe..."
            style="padding:10px; border:1px solid #ddd; border-radius:8px; min-width:260px;">

          <button id="btnImprimirListaPiloto" type="button" class="btn-primary">
            Imprimir Lista
          </button>
        </div>

        <div style="color:#666; font-size:14px;">
          <span id="pilotoCount">0</span> estudante(s)
        </div>
      </div>

      <div style="margin-top:16px; overflow:auto;">
        <table id="tblPiloto" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid #eee;">
              <th style="padding:10px;">R.A</th>
              <th style="padding:10px;">Nome</th>
              <th style="padding:10px;">Nascimento</th>
              <th style="padding:10px;">Série</th>
              <th style="padding:10px;">Turma</th>
              <th style="padding:10px;">Status</th>
              <th style="padding:10px;">Ações</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    return wrap;
  }

  // ======= Configurações Module =======
  function renderConfiguracoesModule() {
    const wrap = document.createElement("div");
    wrap.className = "card";

    const perfil = loadPerfilEscola();

    wrap.innerHTML = `
      <p style="margin-top:0; color:#64748b;">
        Defina o logo (JPG) da escola para aparecer na Ficha Cadastral.
      </p>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; align-items:start;">
        <div>
          <label style="display:block; font-weight:800; font-size:13px; color:#334155;">Nome da escola (opcional)</label>
          <input id="cfgNomeEscola" value="${escapeHtml(perfil.nomeEscola || "")}"
            placeholder="Ex: EMEB ..."
            style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">

          <div style="margin-top:12px;">
            <label style="display:block; font-weight:800; font-size:13px; color:#334155;">Logo da escola (JPG/JPEG)</label>
            <input id="cfgLogo" type="file" accept="image/jpeg" style="margin-top:6px; width:100%;">
            <div style="margin-top:8px; font-size:12px; color:#64748b;">
              Dica: use um JPG quadrado (ex.: 600x600). O sistema ajusta e comprime automaticamente.
            </div>

            <div id="cfgMsg" style="margin-top:10px; font-weight:800; color:#1b4da1;"></div>

            <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
              <button id="btnSalvarCfg" class="btn-primary" type="button">Salvar</button>

              <button id="btnRemoverLogo" type="button"
                style="padding:10px 14px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer;">
                Remover Logo
              </button>
            </div>
          </div>
        </div>

        <div>
          <div style="font-weight:800; font-size:13px; color:#334155; margin-bottom:8px;">Pré-visualização</div>
          <div style="border:1px solid #eee; border-radius:12px; padding:14px;">
            <div style="display:flex; gap:12px; align-items:center;">
              <div style="width:76px; height:76px; border:1px dashed #cbd5e1; border-radius:10px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                ${
                  perfil.logoDataUrl
                    ? `<img src="${escapeHtml(perfil.logoDataUrl)}" style="width:100%; height:100%; object-fit:contain;">`
                    : `<span style="color:#94a3b8; font-size:12px;">Sem logo</span>`
                }
              </div>
              <div>
                <div style="font-size:14px; font-weight:900; color:#0f172a;">
                  ${escapeHtml(perfil.nomeEscola || "Nome da escola")}
                </div>
                <div style="font-size:12px; color:#64748b;">Ficha Cadastral do Estudante</div>
                <div style="font-size:11px; color:#94a3b8; margin-top:4px;">
                  Perfil: ${escapeHtml(getEscolaKey())}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    return wrap;
  }

  function initConfiguracoesUI() {
    const nomeEl = qs("#cfgNomeEscola");
    const fileEl = qs("#cfgLogo");
    const msgEl = qs("#cfgMsg");
    const btnSalvar = qs("#btnSalvarCfg");
    const btnRemover = qs("#btnRemoverLogo");
    if (!btnSalvar) return;

    btnSalvar.addEventListener("click", async () => {
      try {
        msgEl.style.color = "#1b4da1";

        const perfilAtual = loadPerfilEscola();
        const nomeEscola = safeText(nomeEl?.value);

        let logoDataUrl = perfilAtual.logoDataUrl;
        const file = fileEl?.files?.[0];

        if (file) {
          msgEl.textContent = "Processando logo...";
          logoDataUrl = await fileToJpgDataUrl(file, { maxSize: 650, quality: 0.82 });

          if (logoDataUrl.length > 800000) {
            throw new Error("Logo muito grande. Tente um JPG menor.");
          }
        }

        savePerfilEscola({ nomeEscola, logoDataUrl });
        msgEl.textContent = "Configurações salvas ✅";

        setActiveMenuByText("Configurações");
        renderModule("Configurações");
      } catch (err) {
        msgEl.style.color = "#c0392b";
        msgEl.textContent = err?.message || "Não foi possível salvar.";
      }
    });

    btnRemover?.addEventListener("click", () => {
      if (!confirm("Remover o logo desta escola?")) return;
      const perfilAtual = loadPerfilEscola();
      savePerfilEscola({ ...perfilAtual, logoDataUrl: "" });
      setActiveMenuByText("Configurações");
      renderModule("Configurações");
    });
  }

  // ======= Dialogs: Matrículas =======
  function ensureDialogsMatriculasExist() {
    if (!qs("#dlgMatricula")) {
      const dlg = document.createElement("dialog");
      dlg.id = "dlgMatricula";
      dlg.style.maxWidth = "720px";
      dlg.style.width = "95%";
      dlg.innerHTML = `
        <form method="dialog" style="padding:0; border:0;">
          <div style="padding:18px 18px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h3 id="dlgTituloMatricula" style="margin:0;">Nova Matrícula</h3>
            <button id="btnFecharDlgMat" value="cancel" style="border:none; background:transparent; font-size:20px; cursor:pointer;">✕</button>
          </div>

          <div style="padding:18px;">
            <div id="matErro" style="color:#c0392b; margin-bottom:10px;"></div>
            <input type="hidden" id="matId">

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <label style="display:block;">
                <span style="font-weight:800;">R.A *</span>
                <input id="matRA" required placeholder="Digite o R.A"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <div></div>

              <label style="display:block; grid-column:1 / -1;">
                <span style="font-weight:800;">Estudante *</span>
                <input id="matEstudante" list="dlEstudantes" required
                  placeholder="Nome do estudante"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
                <datalist id="dlEstudantes"></datalist>
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Nascimento</span>
                <input id="matNascimento" type="date" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Telefone</span>
                <input id="matTelefone" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Ano</span>
                <input id="matAno" value="${escapeHtml(String(new Date().getFullYear()))}"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Série *</span>
                <input id="matSerie" required placeholder="Ex.: 6º Ano"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Turma *</span>
                <input id="matTurma" required placeholder="Ex.: A"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Status *</span>
                <select id="matStatus" required style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
                  <option value="">Selecione</option>
                  <option value="ATIVA">ATIVA</option>
                  <option value="PENDENTE">PENDENTE</option>
                  <option value="INATIVA">INATIVA</option>
                </select>
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Endereço</span>
                <input id="matEndereco" placeholder="Rua, número, bairro..."
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Mãe</span>
                <input id="matMae" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Pai</span>
                <input id="matPai" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>
            </div>

            <label style="display:block; margin-top:12px;">
              <span style="font-weight:800;">Observações</span>
              <textarea id="matObs" rows="3" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;"></textarea>
            </label>
          </div>

          <div style="padding:14px 18px; border-top:1px solid #eee; display:flex; gap:10px; justify-content:flex-end;">
            <button id="btnCancelarMat" value="cancel" style="padding:10px 14px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer;">Cancelar</button>
            <button id="btnSalvarMat" value="default" style="padding:10px 14px; border-radius:8px; border:0; background:#1b4da1; color:#fff; cursor:pointer;">Salvar</button>
          </div>
        </form>
      `;
      document.body.appendChild(dlg);

      const form = dlg.querySelector("form");
      form.id = "formMatricula";
      dlg.querySelector("#btnSalvarMat").type = "submit";
    }

    if (!qs("#dlgDetalhes")) {
      const dlgDet = document.createElement("dialog");
      dlgDet.id = "dlgDetalhes";
      dlgDet.style.maxWidth = "720px";
      dlgDet.style.width = "95%";
      dlgDet.innerHTML = `
        <form method="dialog" style="padding:0; border:0;">
          <div style="padding:18px 18px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h3 style="margin:0;">Detalhes</h3>
            <button id="btnFecharDlgDet" value="cancel" style="border:none; background:transparent; font-size:20px; cursor:pointer;">✕</button>
          </div>
          <div style="padding:18px;">
            <div id="detConteudo"></div>
          </div>
        </form>
      `;
      document.body.appendChild(dlgDet);
    }
  }

  // ======= Dialog: Detalhes Lista Piloto =======
  function ensureDialogListaPilotoDetalhesExist() {
    if (qs("#dlgPilotoDetalhes")) return;

    const dlg = document.createElement("dialog");
    dlg.id = "dlgPilotoDetalhes";
    dlg.style.maxWidth = "720px";
    dlg.style.width = "95%";
    dlg.innerHTML = `
      <form method="dialog" style="padding:0; border:0;">
        <div style="padding:18px 18px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <h3 style="margin:0;">Detalhes do Estudante</h3>
          <button id="btnFecharDlgPilotoDet" value="cancel" style="border:none; background:transparent; font-size:20px; cursor:pointer;">✕</button>
        </div>
        <div style="padding:18px;">
          <div id="pilotoDetConteudo"></div>
        </div>
      </form>
    `;
    document.body.appendChild(dlg);
  }

  // ======= Datalists =======
  function refreshDatalistEstudantes() {
    const dl = qs("#dlEstudantes");
    if (!dl) return;

    const lista = getListaPiloto();
    const nomes = uniqSorted(lista.map((e) => e.nome).filter(Boolean));
    dl.innerHTML = nomes.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("");
  }

  // ======= Filtros =======
  function refreshFiltroTurmaMat() {
    const sel = qs("#filtroTurmaMat");
    if (!sel) return;

    const list = loadMatriculas();
    const turmas = uniqSorted(list.map((m) => m.turma));

    const current = sel.value || "";
    sel.innerHTML =
      `<option value="">Todas as turmas</option>` +
      turmas.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

    sel.value = turmas.includes(current) ? current : "";
  }

  // Lista Piloto: filtro com "Série + Turma" (ex.: "6º Ano A")
  function refreshFiltroTurmaPiloto() {
    const sel = qs("#filtroTurmaPiloto");
    if (!sel) return;

    const list = getListaPiloto();

    const combos = uniqSorted(
      list
        .map((e) => {
          const serie = safeText(e.serie);
          const turma = safeText(e.turma);
          if (!serie && !turma) return "";
          return `${serie} ${turma}`.trim();
        })
        .filter(Boolean)
    );

    const current = sel.value || "";
    sel.innerHTML =
      `<option value="">Todas as séries/turmas</option>` +
      combos.map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join("");

    sel.value = combos.includes(current) ? current : "";
  }

  // ======= Matrículas Render =======
  function renderMatriculas(textFilter = "", turmaFilter = "") {
    const tbody = qs("#tblMatriculas tbody");
    const countEl = qs("#matCount");
    if (!tbody) return;

    const f = textFilter.trim().toLowerCase();
    const turma = (turmaFilter || "").trim().toLowerCase();
    const list = loadMatriculas();

    const rows = list.filter((m) => {
      if (turma && String(m.turma || "").trim().toLowerCase() !== turma) return false;
      if (!f) return true;

      return (
        (m.ra || "").toLowerCase().includes(f) ||
        (m.estudante || "").toLowerCase().includes(f) ||
        (m.serie || "").toLowerCase().includes(f) ||
        (m.turma || "").toLowerCase().includes(f) ||
        (m.status || "").toLowerCase().includes(f) ||
        (m.ano || "").toLowerCase().includes(f) ||
        (m.mae || "").toLowerCase().includes(f) ||
        (m.pai || "").toLowerCase().includes(f) ||
        (m.telefone || "").toLowerCase().includes(f)
      );
    });

    if (countEl) countEl.textContent = String(rows.length);

    tbody.innerHTML = rows
      .map(
        (m) => `
        <tr style="border-bottom:1px solid #f1f1f1;">
          <td style="padding:10px;">${escapeHtml(m.ra || "")}</td>
          <td style="padding:10px;">${escapeHtml(m.estudante)}</td>
          <td style="padding:10px;">${escapeHtml(m.serie)}</td>
          <td style="padding:10px;">${escapeHtml(m.turma)}</td>
          <td style="padding:10px;">${escapeHtml(m.status)}</td>
          <td style="padding:10px;">${escapeHtml(m.ano)}</td>
          <td style="padding:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn-sm" data-action="view" data-id="${escapeHtml(m.id)}">Ver</button>
            <button class="btn-sm" data-action="edit" data-id="${escapeHtml(m.id)}">Editar</button>
            <button class="btn-sm" data-action="print" data-id="${escapeHtml(m.id)}">Imprimir Ficha</button>
            <button class="btn-sm" data-action="del" data-id="${escapeHtml(m.id)}"
              style="background:#ffe5e5; border:1px solid #ffb3b3;">Excluir</button>
          </td>
        </tr>
      `
      )
      .join("");
  }

  // ======= Lista Piloto Render =======
  function getListaPilotoFiltrada(textFilter = "", serieTurmaFilter = "") {
    const f = textFilter.trim().toLowerCase();
    const st = (serieTurmaFilter || "").trim().toLowerCase();

    const list = getListaPiloto();

    return list
      .filter((e) => {
        if (st) {
          const stItem = `${safeText(e.serie)} ${safeText(e.turma)}`.trim().toLowerCase();
          if (stItem !== st) return false;
        }

        if (!f) return true;

        return (
          (e.ra || "").toLowerCase().includes(f) ||
          (e.nome || "").toLowerCase().includes(f) ||
          (e.telefone || "").toLowerCase().includes(f) ||
          (e.mae || "").toLowerCase().includes(f) ||
          (e.serie || "").toLowerCase().includes(f) ||
          (e.turma || "").toLowerCase().includes(f) ||
          (e.status || "").toLowerCase().includes(f)
        );
      })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
  }

  function renderListaPiloto(textFilter = "", serieTurmaFilter = "") {
    const tbody = qs("#tblPiloto tbody");
    const countEl = qs("#pilotoCount");
    if (!tbody) return;

    const rows = getListaPilotoFiltrada(textFilter, serieTurmaFilter);

    if (countEl) countEl.textContent = String(rows.length);

    tbody.innerHTML = rows
      .map((e) => {
        const key = e.ra ? `ra:${normalizeKey(e.ra)}` : `nm:${normalizeKey(e.nome)}`;
        return `
          <tr style="border-bottom:1px solid #f1f1f1;">
            <td style="padding:10px;">${escapeHtml(e.ra || "")}</td>
            <td style="padding:10px;">${escapeHtml(e.nome)}</td>
            <td style="padding:10px;">${escapeHtml(fmtDateBR(e.nascimento))}</td>
            <td style="padding:10px;">${escapeHtml(e.serie)}</td>
            <td style="padding:10px;">${escapeHtml(e.turma)}</td>
            <td style="padding:10px;">${escapeHtml(e.status)}</td>
            <td style="padding:10px;">
              <button class="btn-sm" data-piloto-action="view" data-key="${escapeHtml(key)}">Ver</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // ======= Detalhes =======
  function openDetalhes(item) {
    const dlg = qs("#dlgDetalhes");
    const area = qs("#detConteudo");
    if (!dlg || !area) return;

    area.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div><strong>R.A:</strong> ${escapeHtml(item.ra || "")}</div>
        <div><strong>Status:</strong> ${escapeHtml(item.status || "")}</div>
        <div style="grid-column:1/-1;"><strong>Estudante:</strong> ${escapeHtml(item.estudante || "")}</div>
        <div><strong>Nascimento:</strong> ${escapeHtml(fmtDateBR(item.nascimento))}</div>
        <div><strong>Telefone:</strong> ${escapeHtml(item.telefone || "")}</div>
        <div><strong>Ano:</strong> ${escapeHtml(item.ano || "")}</div>
        <div><strong>Série:</strong> ${escapeHtml(item.serie || "")}</div>
        <div><strong>Turma:</strong> ${escapeHtml(item.turma || "")}</div>
        <div style="grid-column:1/-1;"><strong>Endereço:</strong> ${escapeHtml(item.endereco || "")}</div>
        <div><strong>Mãe:</strong> ${escapeHtml(item.mae || "")}</div>
        <div><strong>Pai:</strong> ${escapeHtml(item.pai || "")}</div>
        <div style="grid-column:1/-1;"><strong>Obs:</strong> ${escapeHtml(item.obs || "")}</div>
      </div>
    `;

    typeof dlg.showModal === "function" ? dlg.showModal() : dlg.setAttribute("open", "open");
  }

  function closeDetalhes() {
    const dlg = qs("#dlgDetalhes");
    if (!dlg) return;
    typeof dlg.close === "function" ? dlg.close() : dlg.removeAttribute("open");
  }

  function openPilotoDetalhesByKey(key) {
    const list = getListaPiloto();
    const item = list.find((e) => {
      const k = e.ra ? `ra:${normalizeKey(e.ra)}` : `nm:${normalizeKey(e.nome)}`;
      return k === key;
    });
    if (!item) return;

    const dlg = qs("#dlgPilotoDetalhes");
    const area = qs("#pilotoDetConteudo");
    if (!dlg || !area) return;

    area.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div><strong>R.A:</strong> ${escapeHtml(item.ra || "")}</div>
        <div><strong>Status:</strong> ${escapeHtml(item.status || "")}</div>
        <div style="grid-column:1/-1;"><strong>Nome:</strong> ${escapeHtml(item.nome || "")}</div>
        <div><strong>Nascimento:</strong> ${escapeHtml(fmtDateBR(item.nascimento))}</div>
        <div><strong>Telefone:</strong> ${escapeHtml(item.telefone || "")}</div>
        <div><strong>Série:</strong> ${escapeHtml(item.serie)}</div>
        <div><strong>Turma:</strong> ${escapeHtml(item.turma)}</div>
        <div style="grid-column:1/-1;"><strong>Endereço:</strong> ${escapeHtml(item.endereco || "")}</div>
        <div><strong>Mãe:</strong> ${escapeHtml(item.mae || "")}</div>
        <div><strong>Pai:</strong> ${escapeHtml(item.pai || "")}</div>
        <div style="grid-column:1/-1;"><strong>Obs:</strong> ${escapeHtml(item.obs || "")}</div>
      </div>
    `;

    typeof dlg.showModal === "function" ? dlg.showModal() : dlg.setAttribute("open", "open");
  }

  function closePilotoDetalhes() {
    const dlg = qs("#dlgPilotoDetalhes");
    if (!dlg) return;
    typeof dlg.close === "function" ? dlg.close() : dlg.removeAttribute("open");
  }

  // ======= Impressão via iframe =======
  function printHtmlViaIframe(html) {
    const old = document.getElementById("printFrame");
    if (old) old.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "printFrame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win?.document;

    if (!doc || !win) {
      alert("Não foi possível preparar a impressão.");
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      try {
        win.focus();
        win.print();
      } finally {
        setTimeout(() => iframe.remove(), 700);
      }
    };

    setTimeout(() => {
      if (!document.getElementById("printFrame")) return;
      try {
        win.focus();
        win.print();
      } finally {
        setTimeout(() => iframe.remove(), 700);
      }
    }, 350);
  }

  // ======= Impressão: Ficha Cadastral =======
  function imprimirFichaCadastral(m) {
    const perfil = loadPerfilEscola();
    const logoDataUrl = perfil.logoDataUrl || "";
    const nomeEscola = perfil.nomeEscola || "Secretaria Escolar";

    const titulo = `Ficha Cadastral - ${safeText(m.estudante) || "Estudante"}`;

    const html = `
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titulo)}</title>
<style>
  body{font-family:Arial, Helvetica, sans-serif; margin:22px; color:#111;}
  .sub{color:#555; font-size:12px; margin-bottom:14px;}
  .topo{display:flex; align-items:center; gap:12px; margin-bottom:10px;}
  .logo{width:72px; height:72px; object-fit:contain;}
  .topo-txt .org{font-weight:900; font-size:14px;}
  .topo-txt .esc{font-size:12px; color:#555;}
  .box{border:1px solid #ddd; border-radius:10px; padding:14px;}
  .grid{display:grid; grid-template-columns:1fr 1fr; gap:10px;}
  .row{padding:8px 10px; border:1px solid #eee; border-radius:8px;}
  .k{font-size:11px; color:#555; margin-bottom:4px;}
  .v{font-size:13px;}
  .full{grid-column:1 / -1;}
  .obs{min-height:48px;}
  @media print{
    body{margin:0;}
    .box{border:none;}
    .row{border:1px solid #ddd;}
    .logo{width:64px; height:64px;}
  }
</style>
</head>
<body>
  <div class="topo">
    ${logoDataUrl ? `<img class="logo" src="${escapeHtml(logoDataUrl)}" alt="Logo da escola">` : ""}
    <div class="topo-txt">
      <div class="org">${escapeHtml(nomeEscola)}</div>
      <div class="esc">Ficha Cadastral do Estudante</div>
    </div>
  </div>

  <div class="sub">Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>

  <div class="box">
    <div class="grid">
      <div class="row"><div class="k">R.A</div><div class="v"><strong>${escapeHtml(m.ra || "")}</strong></div></div>
      <div class="row"><div class="k">Status</div><div class="v">${escapeHtml(m.status || "")}</div></div>

      <div class="row full"><div class="k">Estudante</div><div class="v"><strong>${escapeHtml(m.estudante || "")}</strong></div></div>

      <div class="row"><div class="k">Nascimento</div><div class="v">${escapeHtml(fmtDateBR(m.nascimento))}</div></div>
      <div class="row"><div class="k">Telefone</div><div class="v">${escapeHtml(m.telefone || "")}</div></div>

      <div class="row"><div class="k">Série</div><div class="v">${escapeHtml(m.serie || "")}</div></div>
      <div class="row"><div class="k">Turma</div><div class="v">${escapeHtml(m.turma || "")}</div></div>

      <div class="row"><div class="k">Ano Letivo</div><div class="v">${escapeHtml(m.ano || "")}</div></div>
      <div class="row full"><div class="k">Endereço</div><div class="v">${escapeHtml(m.endereco || "")}</div></div>

      <div class="row"><div class="k">Mãe</div><div class="v">${escapeHtml(m.mae || "")}</div></div>
      <div class="row"><div class="k">Pai</div><div class="v">${escapeHtml(m.pai || "")}</div></div>

      <div class="row full obs"><div class="k">Observações</div><div class="v">${escapeHtml(m.obs || "")}</div></div>
    </div>
  </div>
</body>
</html>
    `.trim();

    printHtmlViaIframe(html);
  }

  // ======= Impressão: Lista Piloto por Série/Turma =======
  function imprimirListaPilotoDaSerieTurma() {
    const perfil = loadPerfilEscola();
    const logoDataUrl = perfil.logoDataUrl || "";
    const nomeEscola = perfil.nomeEscola || "Secretaria Escolar";

    const filtroTxt = qs("#filtroPiloto")?.value || "";
    const serieTurmaSel = qs("#filtroTurmaPiloto")?.value || "";

    if (!serieTurmaSel) {
      alert("Selecione uma Série/Turma no filtro para imprimir a Lista Piloto.");
      return;
    }

    const rows = getListaPilotoFiltrada(filtroTxt, serieTurmaSel);

    const linhas = rows
      .map((e, i) => {
        const chamada = i + 1;
        return `
        <tr>
          <td class="c">${chamada}</td>
          <td class="n">${escapeHtml(e.nome || "")}</td>
          <td class="ra">${escapeHtml(e.ra || "")}</td>
          <td class="dt">${escapeHtml(fmtDateBR(e.nascimento))}</td>
          <td class="mae">${escapeHtml(e.mae || "")}</td>
        </tr>
      `;
      })
      .join("");

    const html = `
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lista Piloto - ${escapeHtml(serieTurmaSel)}</title>
<style>
  body{font-family:Arial, Helvetica, sans-serif; margin:22px; color:#111;}
  .topo{display:flex; align-items:center; gap:12px; margin-bottom:10px;}
  .logo{width:64px; height:64px; object-fit:contain;}
  .org{font-weight:900; font-size:14px;}
  .sub{color:#555; font-size:12px; margin-top:2px;}
  .info{margin:10px 0 14px; font-size:12px; color:#334155;}
  table{width:100%; border-collapse:collapse; font-size:12px;}
  thead th{border:1px solid #d1d5db; padding:8px; background:#f8fafc; text-align:left;}
  tbody td{border:1px solid #d1d5db; padding:7px; vertical-align:top;}
  .c{width:70px; text-align:center;}
  .ra{width:110px;}
  .dt{width:130px;}
  .mae{width:280px;}
  @media print{
    body{margin:0;}
    .logo{width:56px; height:56px;}
    thead th{background:#eee !important; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
  }
</style>
</head>
<body>
  <div class="topo">
    ${logoDataUrl ? `<img class="logo" src="${escapeHtml(logoDataUrl)}" alt="Logo da escola">` : ""}
    <div>
      <div class="org">${escapeHtml(nomeEscola)}</div>
      <div class="sub">Lista Piloto — ${escapeHtml(serieTurmaSel)}</div>
      <div class="sub">Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
    </div>
  </div>

  <div class="info">
    Total: <strong>${rows.length}</strong> estudante(s)
  </div>

  <table>
    <thead>
      <tr>
        <th class="c">Número de Chamada</th>
        <th>Nome do Estudante</th>
        <th class="ra">R.A</th>
        <th class="dt">Data de Nascimento</th>
        <th class="mae">Filiação (Mãe)</th>
      </tr>
    </thead>
    <tbody>
      ${linhas || `<tr><td colspan="5" style="text-align:center; padding:14px;">Nenhum estudante encontrado.</td></tr>`}
    </tbody>
  </table>
</body>
</html>
    `.trim();

    printHtmlViaIframe(html);
  }

  // ======= Matrículas: abrir/fechar =======
  function openMatriculaDialog(mode, data) {
    const dlg = qs("#dlgMatricula");
    if (!dlg) return alert("ERRO: Não encontrei o dialog #dlgMatricula no DOM.");

    refreshDatalistEstudantes();

    const abrir = () =>
      typeof dlg.showModal === "function" ? dlg.showModal() : dlg.setAttribute("open", "open");

    const titulo = qs("#dlgTituloMatricula");
    const erro = qs("#matErro");
    if (erro) erro.textContent = "";

    const setVal = (id, val) => {
      const el = qs("#" + id);
      if (el) el.value = val ?? "";
    };

    if (mode === "edit" && data) {
      if (titulo) titulo.textContent = "Editar Matrícula";
      setVal("matId", data.id);
      setVal("matRA", data.ra || "");
      setVal("matEstudante", data.estudante);
      setVal("matNascimento", data.nascimento);
      setVal("matTelefone", data.telefone);
      setVal("matSerie", data.serie);
      setVal("matTurma", data.turma);
      setVal("matStatus", data.status);
      setVal("matAno", data.ano);
      setVal("matEndereco", data.endereco);
      setVal("matMae", data.mae);
      setVal("matPai", data.pai);
      const obsEl = qs("#matObs");
      if (obsEl) obsEl.value = data.obs ?? "";
    } else {
      if (titulo) titulo.textContent = "Nova Matrícula";
      setVal("matId", "");
      setVal("matRA", "");
      setVal("matEstudante", "");
      setVal("matNascimento", "");
      setVal("matTelefone", "");
      setVal("matSerie", "");
      setVal("matTurma", "");
      setVal("matStatus", "");
      setVal("matAno", String(new Date().getFullYear()));
      setVal("matEndereco", "");
      setVal("matMae", "");
      setVal("matPai", "");
      const obsEl = qs("#matObs");
      if (obsEl) obsEl.value = "";
    }

    abrir();
  }

  function closeMatriculaDialog() {
    const dlg = qs("#dlgMatricula");
    if (!dlg) return;
    typeof dlg.close === "function" ? dlg.close() : dlg.removeAttribute("open");
  }

  // ======= LISTENERS GLOBAIS =======
  function hookGlobal() {
    if (window.__secretaria_global_hooked) return;
    window.__secretaria_global_hooked = true;

    document.addEventListener("click", (ev) => {
      // Fechar dialogs
      const fecharMat = ev.target.closest("#btnFecharDlgMat, #btnCancelarMat");
      if (fecharMat) {
        ev.preventDefault();
        closeMatriculaDialog();
        return;
      }

      const fecharDet = ev.target.closest("#btnFecharDlgDet");
      if (fecharDet) {
        ev.preventDefault();
        closeDetalhes();
        return;
      }

      const fecharPiloto = ev.target.closest("#btnFecharDlgPilotoDet");
      if (fecharPiloto) {
        ev.preventDefault();
        closePilotoDetalhes();
        return;
      }

      // Nova Matrícula
      const nova = ev.target.closest("#btnNovaMatricula");
      if (nova) {
        ev.preventDefault();
        openMatriculaDialog("new");
        return;
      }

      // Ações Matrículas
      const btnAcao = ev.target.closest("#tblMatriculas button[data-action]");
      if (btnAcao) {
        ev.preventDefault();

        const action = btnAcao.dataset.action;
        const id = btnAcao.dataset.id;

        const list = loadMatriculas();
        const item = list.find((m) => String(m.id) === String(id));
        if (!item) return;

        if (action === "view") return openDetalhes(item);
        if (action === "edit") return openMatriculaDialog("edit", item);
        if (action === "print") return imprimirFichaCadastral(item);

        if (action === "del") {
          if (!confirm(`Excluir a matrícula de "${item.estudante}"?`)) return;

          saveMatriculas(list.filter((m) => String(m.id) !== String(id)));
          refreshFiltroTurmaMat();
          refreshDatalistEstudantes();

          const filtro = qs("#filtroMatriculas");
          const turmaSel = qs("#filtroTurmaMat");
          renderMatriculas(filtro ? filtro.value : "", turmaSel ? turmaSel.value : "");
        }
        return;
      }

      // Ações Lista Piloto
      const btnPiloto = ev.target.closest("#tblPiloto button[data-piloto-action]");
      if (btnPiloto) {
        ev.preventDefault();
        const key = btnPiloto.dataset.key;
        if (key) openPilotoDetalhesByKey(key);
        return;
      }

      // Imprimir Lista Piloto
      const btnImp = ev.target.closest("#btnImprimirListaPiloto");
      if (btnImp) {
        ev.preventDefault();
        imprimirListaPilotoDaSerieTurma();
        return;
      }
    });

    // Submit do formulário de matrícula
    document.addEventListener(
      "submit",
      (e) => {
        const form = e.target;
        if (!form || form.id !== "formMatricula") return;

        e.preventDefault();

        const erro = qs("#matErro");
        if (erro) erro.textContent = "";

        const get = (id) => (qs("#" + id)?.value || "").trim();

        const id = get("matId");
        const ra = get("matRA");
        const estudante = get("matEstudante");
        const nascimento = get("matNascimento");
        const telefone = get("matTelefone");
        const serie = get("matSerie");
        const turma = get("matTurma");
        const status = qs("#matStatus")?.value || "";
        const ano = get("matAno");
        const endereco = get("matEndereco");
        const mae = get("matMae");
        const pai = get("matPai");
        const obs = (qs("#matObs")?.value || "").trim();

        if (!ra || !estudante || !serie || !turma || !status) {
          if (erro) erro.textContent = "Preencha os campos obrigatórios (*).";
          return;
        }

        const list = loadMatriculas();

        // ✅ NÃO bloqueia R.A duplicado (transferência/retorno)
        if (id) {
          const idx = list.findIndex((m) => String(m.id) === String(id));
          if (idx >= 0) {
            list[idx] = {
              ...list[idx],
              ra,
              estudante,
              nascimento,
              telefone,
              serie,
              turma,
              status,
              ano,
              endereco,
              mae,
              pai,
              obs
            };
            saveMatriculas(list);
          }
        } else {
          list.push({
            id: nextMatriculaId(list),
            ra,
            estudante,
            nascimento,
            telefone,
            serie,
            turma,
            status,
            ano,
            endereco,
            mae,
            pai,
            obs
          });
          saveMatriculas(list);
        }

        closeMatriculaDialog();
        refreshFiltroTurmaMat();
        refreshDatalistEstudantes();

        const filtro = qs("#filtroMatriculas");
        const turmaSel = qs("#filtroTurmaMat");
        renderMatriculas(filtro ? filtro.value : "", turmaSel ? turmaSel.value : "");
      },
      true
    );
  }

  // ======= Init UI: Matrículas =======
  function initMatriculasUI() {
    loadMatriculas();

    refreshFiltroTurmaMat();
    refreshDatalistEstudantes();

    const filtro = qs("#filtroMatriculas");
    const turmaSel = qs("#filtroTurmaMat");

    renderMatriculas(filtro ? filtro.value : "", turmaSel ? turmaSel.value : "");

    if (filtro && !filtro.dataset.bound) {
      filtro.addEventListener("input", () =>
        renderMatriculas(filtro.value, turmaSel ? turmaSel.value : "")
      );
      filtro.dataset.bound = "1";
    }

    if (turmaSel && !turmaSel.dataset.bound) {
      turmaSel.addEventListener("change", () =>
        renderMatriculas(filtro ? filtro.value : "", turmaSel.value)
      );
      turmaSel.dataset.bound = "1";
    }
  }

  // ======= Init UI: Lista Piloto =======
  function initListaPilotoUI() {
    loadMatriculas();
    refreshFiltroTurmaPiloto();

    const filtro = qs("#filtroPiloto");
    const serieTurmaSel = qs("#filtroTurmaPiloto");

    renderListaPiloto(filtro ? filtro.value : "", serieTurmaSel ? serieTurmaSel.value : "");

    if (filtro && !filtro.dataset.bound) {
      filtro.addEventListener("input", () =>
        renderListaPiloto(filtro.value, serieTurmaSel ? serieTurmaSel.value : "")
      );
      filtro.dataset.bound = "1";
    }

    if (serieTurmaSel && !serieTurmaSel.dataset.bound) {
      serieTurmaSel.addEventListener("change", () =>
        renderListaPiloto(filtro ? filtro.value : "", serieTurmaSel.value)
      );
      serieTurmaSel.dataset.bound = "1";
    }
  }

  // ======= Menu Handling =======
  function hookMenu() {
    const items = qsa(".sidebar .menu-item");
    items.forEach((it) => {
      const label = it.textContent.trim();

      if (label.toLowerCase().includes("sair")) {
        it.addEventListener("click", () => {
          if (confirm("Deseja realmente sair do sistema?")) {
            if (window.SEDSME && typeof window.SEDSME.logout === "function") {
              window.SEDSME.logout();
            } else {
              localStorage.removeItem("sedsme_session");
              window.location.href = "index1.html";
            }
          }
        });
        return;
      }

      it.addEventListener("click", () => {
        setActiveMenuByText(label);
        renderModule(label);
      });
    });

    setActiveMenuByText("Matrículas");
    renderModule("Matrículas");
  }

  // ======= Init =======
  function init() {
    applyHeaderInfo();
    hookGlobal();
    hookMenu();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
