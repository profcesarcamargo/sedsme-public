// public/js/secretaria_declaracoes_patch.js
// ✅ Patch "Declarações" para o Painel da Secretaria Escolar (modo local).
//
// Objetivo:
// - Criar o módulo "Declarações" sem precisar reescrever o secretaria.js.
// - Permite: emitir/imprimir declarações, upload de documentos (PDF/IMG),
//   e gerenciar solicitações vindas do perfil Estudante.
//
// Como usar:
// 1) Adicione o script depois do secretaria.js na página secretaria.html:
//    <script src="/js/secretaria.js"></script>
//    <script src="/js/secretaria_declaracoes_patch.js"></script>
//
// 2) O patch adiciona automaticamente o item "Declarações" no menu lateral (se não existir).
//
// Armazenamento (por escola):
// - Declarações emitidas/upload:  sedsme_secretaria_declaracoes:<escolaKey>
// - Solicitações Estudante:       sedsme_solicitacoes_documentos:<escolaKey>
//
// Observação: arquivos salvos em dataURL via localStorage têm limite. Prefira PDFs/imagens leves (~2,5MB).

(function () {
  // ===== Helpers =====
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

  function safeText(s) {
    return String(s ?? "").trim();
  }

  function normalizeKey(s) {
    return safeText(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
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

  function nowIsoDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function tryJsonParse(raw, fallback) {
    try {
      const obj = JSON.parse(raw);
      return obj ?? fallback;
    } catch {
      return fallback;
    }
  }

  function uniqSorted(arr) {
    return [...new Set((arr || []).filter(Boolean).map((s) => String(s).trim()))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }

  function getSession() {
    return window.SEDSME && typeof window.SEDSME.getSession === "function"
      ? window.SEDSME.getSession()
      : null;
  }

  function getEscolaKey() {
    const session = getSession();
    const escolaId =
      session?.escolaId ||
      session?.unidadeId ||
      session?.unidade ||
      session?.escola ||
      "padrao";
    return normalizeKey(escolaId);
  }

  // ===== Storage Keys =====
  const LS_KEY_MATRICULAS = "sedsme_secretaria_matriculas";
  const LS_KEY_ESCOLA_PERFIL_PREFIX = "sedsme_escola_perfil:";
  const LS_KEY_DECLARACOES_PREFIX = "sedsme_secretaria_declaracoes:"; // + escolaKey
  const LS_KEY_SOLICITACOES_PREFIX = "sedsme_solicitacoes_documentos:"; // + escolaKey

  function perfilKey() {
    return LS_KEY_ESCOLA_PERFIL_PREFIX + getEscolaKey();
  }

  function loadPerfilEscola() {
    const raw = localStorage.getItem(perfilKey());
    const obj = raw ? tryJsonParse(raw, {}) : {};
    return { logoDataUrl: safeText(obj.logoDataUrl), nomeEscola: safeText(obj.nomeEscola) };
  }

  function declaracoesKey() {
    return LS_KEY_DECLARACOES_PREFIX + getEscolaKey();
  }
  function solicitacoesKey() {
    return LS_KEY_SOLICITACOES_PREFIX + getEscolaKey();
  }

  function loadMatriculas() {
    const raw = localStorage.getItem(LS_KEY_MATRICULAS);
    const arr = raw ? tryJsonParse(raw, []) : [];
    return Array.isArray(arr) ? arr : [];
  }

  function getListaPiloto() {
    const mats = loadMatriculas();
    const map = new Map();
    const ordered = [...mats].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    for (const m of ordered) {
      const nome = safeText(m.estudante);
      const ra = safeText(m.ra);
      if (!nome && !ra) continue;
      const key = ra ? `ra:${normalizeKey(ra)}` : `nm:${normalizeKey(nome)}`;
      map.set(key, {
        nome: nome,
        ra: ra,
        nascimento: safeText(m.nascimento),
        telefone: safeText(m.telefone),
        serie: safeText(m.serie),
        turma: safeText(m.turma),
        status: safeText(m.status),
        endereco: safeText(m.endereco),
        mae: safeText(m.mae),
        pai: safeText(m.pai),
        ano: safeText(m.ano),
      });
    }
    return [...map.values()].sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" })
    );
  }

  function loadDeclaracoes() {
    const raw = localStorage.getItem(declaracoesKey());
    const arr = raw ? tryJsonParse(raw, []) : [];
    return Array.isArray(arr) ? arr : [];
  }
  function saveDeclaracoes(list) {
    localStorage.setItem(declaracoesKey(), JSON.stringify(list || []));
  }
  function nextDeclaracaoId(list) {
    return (list || []).reduce((acc, it) => Math.max(acc, Number(it.id) || 0), 0) + 1;
  }

  function loadSolicitacoes() {
    const raw = localStorage.getItem(solicitacoesKey());
    const arr = raw ? tryJsonParse(raw, []) : [];
    return Array.isArray(arr) ? arr : [];
  }
  function saveSolicitacoes(list) {
    localStorage.setItem(solicitacoesKey(), JSON.stringify(list || []));
  }
  function updateSolicitacaoStatus(id, status) {
    const sols = loadSolicitacoes();
    const idx = sols.findIndex((s) => String(s.id) === String(id));
    if (idx < 0) return false;
    const now = new Date().toISOString();
    sols[idx] = {
      ...sols[idx],
      status: String(status || "").toUpperCase(),
      updatedAt: now,
      readyAt: String(status || "").toUpperCase() === "PRONTA" ? now : sols[idx].readyAt,
      entregueAt: String(status || "").toUpperCase() === "ENTREGUE" ? now : sols[idx].entregueAt,
    };
    saveSolicitacoes(sols);
    return true;
  }

  // ===== File -> dataURL (PDF/IMG) =====
  function fileToDocDataUrl(file, { maxBytes = 2500000 } = {}) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("Selecione um arquivo."));
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        return reject(new Error("Formato inválido. Use PDF, JPG, PNG ou WEBP."));
      }
      if (file.size > maxBytes) {
        return reject(new Error("Arquivo muito grande. Tente até ~2,5MB."));
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  // ===== Print helper =====
  function printHtmlViaIframe(html) {
    const old = document.getElementById("printFrameDec");
    if (old) old.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "printFrameDec";
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!win || !doc) {
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
        setTimeout(() => iframe.remove(), 800);
      }
    };

    // fallback
    setTimeout(() => {
      if (!document.getElementById("printFrameDec")) return;
      try {
        win.focus();
        win.print();
      } finally {
        setTimeout(() => iframe.remove(), 800);
      }
    }, 400);
  }

  function downloadDataUrl({ dataUrl, filename }) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename || `arquivo_${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ===== Templates =====
  function templateTexto(tipo, payload) {
    const nome = payload.estudante || "estudante";
    const ra = payload.ra || "";
    const serie = payload.serie || "";
    const turma = payload.turma || "";
    const ano = payload.ano || String(new Date().getFullYear());
    const escola = payload.nomeEscola || "a escola";
    const dataExt = payload.dataExtenso || fmtDateBR(payload.data) || "";

    const baseCab = `Declaramos, para os devidos fins, que ${nome}${ra ? ` (R.A ${ra})` : ""}`;

    if (tipo === "Declaração de Matrícula") {
      return `${baseCab} encontra-se regularmente matriculado(a) nesta unidade escolar, no ano letivo de ${ano}${serie ? `, na série ${serie}` : ""}${turma ? `, turma ${turma}` : ""}.\n\n${payload.destinatario ? `Esta declaração é destinada a: ${payload.destinatario}.\n\n` : ""}Por ser verdade, firmamos a presente.\n\n${escola}, ${dataExt}.`;
    }
    if (tipo === "Declaração de Transferência") {
      return `${baseCab} solicita/necessita de transferência${serie ? `, série ${serie}` : ""}${turma ? `, turma ${turma}` : ""}.\n\n${payload.destinatario ? `Destinatário: ${payload.destinatario}.\n\n` : ""}Por ser verdade, firmamos a presente.\n\n${escola}, ${dataExt}.`;
    }
    if (tipo === "Declaração de Vaga") {
      return `Declaramos, para os devidos fins, que há vaga disponível nesta unidade escolar${serie ? ` para a série ${serie}` : ""}${turma ? `, turma ${turma}` : ""}, para o ano letivo de ${ano}.\n\n${payload.destinatario ? `Destinatário: ${payload.destinatario}.\n\n` : ""}Por ser verdade, firmamos a presente.\n\n${escola}, ${dataExt}.`;
    }
    return `${baseCab}.\n\n${payload.destinatario ? `Destinatário: ${payload.destinatario}.\n\n` : ""}Por ser verdade, firmamos a presente.\n\n${escola}, ${dataExt}.`;
  }

  function buildDeclaracaoHtmlPrint(payload) {
    const perfil = loadPerfilEscola();
    const logoDataUrl = perfil.logoDataUrl || "";
    const nomeEscola = perfil.nomeEscola || "Secretaria Escolar";
    const titulo = payload.tipo || "Declaração";

    const texto = String(payload.texto || "")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");

    const sub = [
      payload.protocolo ? `Protocolo: ${payload.protocolo}` : "",
      payload.ra ? `R.A: ${payload.ra}` : "",
      payload.data ? `Data: ${fmtDateBR(payload.data)}` : "",
    ].filter(Boolean).join(" • ");

    const destinatario = safeText(payload.destinatario);

    return `
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titulo)}</title>
<style>
  body{font-family:Arial, Helvetica, sans-serif; margin:22px; color:#111;}
  .topo{display:flex; align-items:center; gap:12px; margin-bottom:10px;}
  .logo{width:72px; height:72px; object-fit:contain;}
  .org{font-weight:900; font-size:14px;}
  .sub{color:#555; font-size:12px; margin-top:2px;}
  .tit{margin:18px 0 10px; font-size:16px; font-weight:900; text-align:center; text-transform:uppercase;}
  .box{border:1px solid #ddd; border-radius:10px; padding:16px;}
  .texto p{margin:0 0 10px; line-height:1.55;}
  .rodape{margin-top:26px; font-size:12px; color:#555; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;}
  .linha{margin-top:36px; display:flex; justify-content:flex-end;}
  .ass{width:320px; text-align:center;}
  .ass .tr{border-top:1px solid #111; padding-top:8px; font-size:12px;}
  @media print{
    body{margin:0;}
    .box{border:none;}
    .logo{width:64px; height:64px;}
  }
</style>
</head>
<body>
  <div class="topo">
    ${logoDataUrl ? `<img class="logo" src="${escapeHtml(logoDataUrl)}" alt="Logo da escola">` : ""}
    <div>
      <div class="org">${escapeHtml(nomeEscola)}</div>
      <div class="sub">${escapeHtml(sub || "")}</div>
      ${destinatario ? `<div class="sub">Destinatário: ${escapeHtml(destinatario)}</div>` : ""}
    </div>
  </div>

  <div class="tit">${escapeHtml(titulo)}</div>

  <div class="box">
    <div class="texto">
      ${texto || `<p>${escapeHtml(payload.texto || "")}</p>`}
    </div>

    <div class="linha">
      <div class="ass">
        <div style="height:40px;"></div>
        <div class="tr">Secretaria Escolar</div>
      </div>
    </div>
  </div>

  <div class="rodape">
    <div>Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
    <div>${escapeHtml(getEscolaKey())}</div>
  </div>
</body>
</html>
    `.trim();
  }

  // ===== UI: module injection =====
  function ensureMenuItem() {
    const sidebar = qs(".sidebar");
    const menu = qs(".sidebar");
    if (!sidebar || !menu) return;

    const already = qsa(".sidebar .menu-item").find(
      (el) => el.textContent.trim().toLowerCase() === "declarações"
    );
    if (already) return;

    // cria após "Matrículas" se existir; senão no final
    const items = qsa(".sidebar .menu-item");
    const anchor =
      items.find((el) => el.textContent.trim().toLowerCase() === "matrículas") ||
      items[0] ||
      null;

    const btn = document.createElement("div");
    btn.className = "menu-item";
    btn.textContent = "Declarações";

    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(btn, anchor.nextSibling);
    } else {
      sidebar.appendChild(btn);
    }
  }

  function setActiveMenu(label) {
    qsa(".sidebar .menu-item").forEach((it) => {
      it.classList.toggle("active", it.textContent.trim().toLowerCase() === label.toLowerCase());
    });
  }

  function ensureDialogs() {
    if (!qs("#dlgDecEmitir")) {
      const dlg = document.createElement("dialog");
      dlg.id = "dlgDecEmitir";
      dlg.style.maxWidth = "860px";
      dlg.style.width = "96%";
      dlg.innerHTML = `
        <form method="dialog" style="padding:0; border:0;">
          <div style="padding:18px 18px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h3 style="margin:0;">Emitir Declaração</h3>
            <button id="btnFecharDlgDecEmitir" value="cancel" style="border:none; background:transparent; font-size:20px; cursor:pointer;">✕</button>
          </div>

          <div style="padding:18px;">
            <div id="decEmitirErro" style="color:#c0392b; margin-bottom:10px;"></div>
            <input type="hidden" id="decSolicId">

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <label style="display:block;">
                <span style="font-weight:800;">R.A *</span>
                <input id="decRA" required placeholder="Digite o R.A"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Data *</span>
                <input id="decData" type="date" required
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block; grid-column:1 / -1;">
                <span style="font-weight:800;">Estudante *</span>
                <input id="decEstudante" list="dlDecEstudantes" required
                  placeholder="Nome do estudante"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
                <datalist id="dlDecEstudantes"></datalist>
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Tipo *</span>
                <select id="decTipo" required style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
                  <option value="">Selecione</option>
                  <option value="Declaração de Matrícula">Declaração de Matrícula</option>
                  <option value="Declaração de Transferência">Declaração de Transferência</option>
                  <option value="Declaração de Vaga">Declaração de Vaga</option>
                  <option value="Outros">Outros</option>
                </select>
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Destinatário (opcional)</span>
                <input id="decDest" placeholder="Ex.: Empresa, INSS..."
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Ano Letivo</span>
                <input id="decAno" value="${new Date().getFullYear()}"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Série</span>
                <input id="decSerie" placeholder="Ex.: 6º Ano"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Turma</span>
                <input id="decTurma" placeholder="Ex.: A"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block; grid-column:1 / -1;">
                <span style="font-weight:800;">Texto da declaração *</span>
                <textarea id="decTexto" rows="7" required
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;"
                  placeholder="O texto será preenchido automaticamente, mas você pode editar."></textarea>
                <div style="font-size:12px; color:#64748b; margin-top:6px;">
                  Dica: você pode personalizar o texto antes de salvar/imprimir.
                </div>
              </label>
            </div>
          </div>

          <div style="padding:14px 18px; border-top:1px solid #eee; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
            <button id="btnCancelarDecEmitir" value="cancel"
              style="padding:10px 14px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer;">
              Cancelar
            </button>

            <button id="btnSalvarDecEmitir" value="default"
              style="padding:10px 14px; border-radius:8px; border:0; background:#1b4da1; color:#fff; cursor:pointer;">
              Salvar (Pronta)
            </button>
          </div>
        </form>
      `;
      document.body.appendChild(dlg);

      const form = dlg.querySelector("form");
      form.id = "formDecEmitir";
      dlg.querySelector("#btnSalvarDecEmitir").type = "submit";
    }

    if (!qs("#dlgDecUpload")) {
      const dlg = document.createElement("dialog");
      dlg.id = "dlgDecUpload";
      dlg.style.maxWidth = "860px";
      dlg.style.width = "96%";
      dlg.innerHTML = `
        <form method="dialog" style="padding:0; border:0;">
          <div style="padding:18px 18px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h3 style="margin:0;">Upload de Documento</h3>
            <button id="btnFecharDlgDecUpload" value="cancel" style="border:none; background:transparent; font-size:20px; cursor:pointer;">✕</button>
          </div>

          <div style="padding:18px;">
            <div id="decUploadErro" style="color:#c0392b; margin-bottom:10px;"></div>
            <input type="hidden" id="upSolicId">

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <label style="display:block;">
                <span style="font-weight:800;">R.A *</span>
                <input id="upRA" required placeholder="Digite o R.A"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Data *</span>
                <input id="upData" type="date" required
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>

              <label style="display:block; grid-column:1 / -1;">
                <span style="font-weight:800;">Estudante *</span>
                <input id="upEstudante" list="dlUpEstudantes" required
                  placeholder="Nome do estudante"
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
                <datalist id="dlUpEstudantes"></datalist>
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Tipo *</span>
                <select id="upTipo" required style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
                  <option value="">Selecione</option>
                  <option value="Declaração de Matrícula">Declaração de Matrícula</option>
                  <option value="Declaração de Transferência">Declaração de Transferência</option>
                  <option value="Declaração de Vaga">Declaração de Vaga</option>
                  <option value="Outros">Outros</option>
                </select>
              </label>

              <label style="display:block;">
                <span style="font-weight:800;">Arquivo *</span>
                <input id="upArquivo" type="file" required
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  style="width:100%; margin-top:6px;">
                <div style="font-size:12px; color:#64748b; margin-top:6px;">
                  PDF, JPG, PNG ou WEBP. Prefira arquivos até ~2,5MB.
                </div>
              </label>

              <label style="display:block; grid-column:1 / -1;">
                <span style="font-weight:800;">Descrição (opcional)</span>
                <input id="upDesc" placeholder="Ex.: documento digitalizado, 2ª via..."
                  style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
              </label>
            </div>
          </div>

          <div style="padding:14px 18px; border-top:1px solid #eee; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
            <button id="btnCancelarDecUpload" value="cancel"
              style="padding:10px 14px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer;">
              Cancelar
            </button>

            <button id="btnSalvarDecUpload" value="default"
              style="padding:10px 14px; border-radius:8px; border:0; background:#1b4da1; color:#fff; cursor:pointer;">
              Salvar (Pronto)
            </button>
          </div>
        </form>
      `;
      document.body.appendChild(dlg);

      const form = dlg.querySelector("form");
      form.id = "formDecUpload";
      dlg.querySelector("#btnSalvarDecUpload").type = "submit";
    }

    if (!qs("#dlgDecViewPatch")) {
      const dlg = document.createElement("dialog");
      dlg.id = "dlgDecViewPatch";
      dlg.style.maxWidth = "920px";
      dlg.style.width = "97%";
      dlg.innerHTML = `
        <form method="dialog" style="padding:0; border:0;">
          <div style="padding:18px 18px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h3 style="margin:0;">Visualizar</h3>
            <button id="btnFecharDlgDecViewPatch" value="cancel" style="border:none; background:transparent; font-size:20px; cursor:pointer;">✕</button>
          </div>
          <div style="padding:18px;">
            <div id="decViewInfoPatch" style="margin-bottom:10px; color:#334155;"></div>
            <div id="decViewBodyPatch" style="border:1px solid #eee; border-radius:12px; overflow:hidden;"></div>
          </div>
        </form>
      `;
      document.body.appendChild(dlg);
    }
  }

  function badge(status) {
    const s = String(status || "").toUpperCase();
    const map = {
      SOLICITADA: { bg: "#fff7ed", bd: "#fed7aa", tx: "#9a3412", label: "Solicitada" },
      PRONTA: { bg: "#ecfdf5", bd: "#a7f3d0", tx: "#065f46", label: "Pronta" },
      ENTREGUE: { bg: "#eff6ff", bd: "#bfdbfe", tx: "#1e40af", label: "Entregue" },
    };
    const st = map[s] || { bg: "#f8fafc", bd: "#e2e8f0", tx: "#334155", label: s || "—" };
    return `<span style="display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid ${st.bd}; background:${st.bg}; color:${st.tx}; font-weight:900;">${escapeHtml(st.label)}</span>`;
  }

  function mergeItens() {
    const decs = loadDeclaracoes();
    const sols = loadSolicitacoes();

    const itensS = sols.map((s) => ({
      kind: "solicitacao",
      sid: s.id,
      data: s.dataSolicitacao || s.createdAt?.slice(0, 10) || "",
      protocolo: s.protocolo || `SOL-${String(s.id).padStart(5, "0")}`,
      ra: s.ra || "",
      estudante: s.estudante || "",
      tipo: s.tipo || "",
      status: s.status || "SOLICITADA",
    }));

    const itensD = decs.map((d) => ({
      kind: "declaracao",
      did: d.id,
      data: d.data || "",
      protocolo: d.protocolo || `DEC-${String(d.id).padStart(5, "0")}`,
      ra: d.ra || "",
      estudante: d.estudante || "",
      tipo: d.tipoExibicao || d.tipo || "",
      status: d.status || "PRONTA",
      mime: d.mime || "",
      dataUrl: d.dataUrl || "",
      html: d.html || "",
      solicitacaoId: d.solicitacaoId || null,
    }));

    return [...itensS, ...itensD].sort((a, b) => {
      const da = String(a.data || "");
      const db = String(b.data || "");
      if (da !== db) return db.localeCompare(da);
      return String(b.protocolo || "").localeCompare(String(a.protocolo || ""));
    });
  }

  function renderModule() {
    const root = qs(".content");
    if (!root) return;

    root.innerHTML = `
      <div class="card"><h2>Declarações</h2></div>

      <div class="card">
        <p style="margin-top:0; color:#64748b;">
          Emita e imprima declarações (Matrícula, Transferência, Vaga e Outros) e faça upload de documentos arquivados.
          Também gerencia solicitações feitas no perfil Estudante.
        </p>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button id="btnEmitirDec" class="btn-primary" type="button">+ Emitir Declaração</button>

            <button id="btnUploadDec" type="button"
              style="padding:10px 14px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer;">
              Upload de Documento
            </button>

            <select id="fDecStatus" style="padding:10px; border:1px solid #ddd; border-radius:8px;">
              <option value="">Todos os status</option>
              <option value="SOLICITADA">Solicitada</option>
              <option value="PRONTA">Pronta para retirada</option>
              <option value="ENTREGUE">Entregue</option>
            </select>

            <select id="fDecTipo" style="padding:10px; border:1px solid #ddd; border-radius:8px;">
              <option value="">Todos os tipos</option>
              <option value="Declaração de Matrícula">Declaração de Matrícula</option>
              <option value="Declaração de Transferência">Declaração de Transferência</option>
              <option value="Declaração de Vaga">Declaração de Vaga</option>
              <option value="Outros">Outros</option>
              <option value="Upload">Upload</option>
            </select>

            <input id="fDecTxt" type="text"
              placeholder="Buscar por R.A, estudante, tipo, status, protocolo..."
              style="padding:10px; border:1px solid #ddd; border-radius:8px; min-width:260px;">
          </div>

          <div style="color:#666; font-size:14px;">
            <span id="decCountPatch">0</span> item(ns)
          </div>
        </div>

        <div style="margin-top:16px; overflow:auto;">
          <table id="tblDecPatch" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid #eee;">
                <th style="padding:10px;">Data</th>
                <th style="padding:10px;">Protocolo</th>
                <th style="padding:10px;">R.A</th>
                <th style="padding:10px;">Estudante</th>
                <th style="padding:10px;">Tipo</th>
                <th style="padding:10px;">Status</th>
                <th style="padding:10px;">Ações</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div style="margin-top:10px; font-size:12px; color:#94a3b8;">
          Quando marcar como <strong>Pronta</strong>, o perfil Estudante verá “Pode retirar na Secretaria da Escola”.
        </div>
      </div>
    `;

    ensureDialogs();
    bindModuleEvents();
    refreshList();
  }

  function refreshDatalists() {
    const lista = getListaPiloto();
    const nomes = uniqSorted(lista.map((e) => e.nome).filter(Boolean));
    const html = nomes.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("");

    const dl1 = qs("#dlDecEstudantes");
    const dl2 = qs("#dlUpEstudantes");
    if (dl1) dl1.innerHTML = html;
    if (dl2) dl2.innerHTML = html;
  }

  function refreshList() {
    const tbody = qs("#tblDecPatch tbody");
    const countEl = qs("#decCountPatch");
    if (!tbody) return;

    const fTxt = (qs("#fDecTxt")?.value || "").trim().toLowerCase();
    const fTipo = (qs("#fDecTipo")?.value || "").trim().toLowerCase();
    const fStatus = (qs("#fDecStatus")?.value || "").trim().toLowerCase();

    const rows = mergeItens().filter((it) => {
      if (fStatus && String(it.status || "").toUpperCase() !== fStatus.toUpperCase()) return false;

      if (fTipo) {
        const tipo = String(it.tipo || "").toLowerCase();
        if (fTipo === "upload") {
          if (it.kind !== "declaracao") return false;
          return tipo === "upload";
        }
        return tipo === fTipo;
      }

      if (!fTxt) return true;

      return (
        String(it.protocolo || "").toLowerCase().includes(fTxt) ||
        String(it.ra || "").toLowerCase().includes(fTxt) ||
        String(it.estudante || "").toLowerCase().includes(fTxt) ||
        String(it.tipo || "").toLowerCase().includes(fTxt) ||
        String(it.status || "").toLowerCase().includes(fTxt)
      );
    });

    if (countEl) countEl.textContent = String(rows.length);

    tbody.innerHTML = rows.map((it) => {
      const actions = it.kind === "solicitacao"
        ? `
          <button class="btn-sm" data-act="emitir" data-sid="${escapeHtml(it.sid)}">Emitir</button>
          <button class="btn-sm" data-act="pronta" data-sid="${escapeHtml(it.sid)}">Marcar Pronta</button>
          <button class="btn-sm" data-act="entregue" data-sid="${escapeHtml(it.sid)}">Entregue</button>
          <button class="btn-sm" data-act="del-s" data-sid="${escapeHtml(it.sid)}" style="background:#ffe5e5; border:1px solid #ffb3b3;">Excluir</button>
        `
        : `
          <button class="btn-sm" data-act="ver" data-did="${escapeHtml(it.did)}">Ver</button>
          <button class="btn-sm" data-act="imprimir" data-did="${escapeHtml(it.did)}">Imprimir</button>
          <button class="btn-sm" data-act="baixar" data-did="${escapeHtml(it.did)}">Baixar</button>
          <button class="btn-sm" data-act="entregue-d" data-did="${escapeHtml(it.did)}">Entregue</button>
          <button class="btn-sm" data-act="del-d" data-did="${escapeHtml(it.did)}" style="background:#ffe5e5; border:1px solid #ffb3b3;">Excluir</button>
        `;

      return `
        <tr style="border-bottom:1px solid #f1f1f1;">
          <td style="padding:10px;">${escapeHtml(fmtDateBR(it.data))}</td>
          <td style="padding:10px; font-weight:900; color:#0f172a;">${escapeHtml(it.protocolo)}</td>
          <td style="padding:10px;">${escapeHtml(it.ra || "")}</td>
          <td style="padding:10px;">${escapeHtml(it.estudante || "")}</td>
          <td style="padding:10px;">${escapeHtml(it.tipo || "")}</td>
          <td style="padding:10px;">${badge(it.status)}</td>
          <td style="padding:10px; display:flex; gap:8px; flex-wrap:wrap;">${actions}</td>
        </tr>
      `;
    }).join("");
  }

  function openDialog(id) {
    const dlg = qs(id);
    if (!dlg) return;
    typeof dlg.showModal === "function" ? dlg.showModal() : dlg.setAttribute("open", "open");
  }
  function closeDialog(id) {
    const dlg = qs(id);
    if (!dlg) return;
    typeof dlg.close === "function" ? dlg.close() : dlg.removeAttribute("open");
  }

  function openEmitir({ sid = null, preset = null } = {}) {
    refreshDatalists();

    qs("#decEmitirErro") && (qs("#decEmitirErro").textContent = "");
    qs("#decSolicId").value = sid ? String(sid) : "";
    qs("#decData").value = nowIsoDate();

    qs("#decRA").value = preset?.ra || "";
    qs("#decEstudante").value = preset?.estudante || "";
    qs("#decTipo").value = preset?.tipo || "";
    qs("#decAno").value = preset?.ano || String(new Date().getFullYear());
    qs("#decSerie").value = preset?.serie || "";
    qs("#decTurma").value = preset?.turma || "";
    qs("#decDest").value = preset?.destinatario || "";

    const perfil = loadPerfilEscola();
    const payload = {
      ra: qs("#decRA").value,
      estudante: qs("#decEstudante").value,
      serie: qs("#decSerie").value,
      turma: qs("#decTurma").value,
      ano: qs("#decAno").value,
      destinatario: qs("#decDest").value,
      data: qs("#decData").value,
      nomeEscola: perfil.nomeEscola || "Secretaria Escolar",
    };
    const tipo = qs("#decTipo").value || "Declaração de Matrícula";
    qs("#decTexto").value = templateTexto(tipo, payload);

    openDialog("#dlgDecEmitir");
  }

  function openUpload({ sid = null, preset = null } = {}) {
    refreshDatalists();

    qs("#decUploadErro") && (qs("#decUploadErro").textContent = "");
    qs("#upSolicId").value = sid ? String(sid) : "";
    qs("#upData").value = nowIsoDate();

    qs("#upRA").value = preset?.ra || "";
    qs("#upEstudante").value = preset?.estudante || "";
    qs("#upTipo").value = preset?.tipo || "";
    qs("#upDesc").value = preset?.descricao || "";
    qs("#upArquivo").value = "";

    openDialog("#dlgDecUpload");
  }

  function openView(did) {
    const dlg = qs("#dlgDecViewPatch");
    const info = qs("#decViewInfoPatch");
    const body = qs("#decViewBodyPatch");
    if (!dlg || !info || !body) return;

    const dec = loadDeclaracoes().find((d) => String(d.id) === String(did));
    if (!dec) return;

    info.innerHTML = `
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="font-weight:900; color:#0f172a;">
            ${escapeHtml(dec.tipoExibicao || dec.tipo || "Documento")} — ${escapeHtml(dec.estudante || "")}
          </div>
          <div style="font-size:12px; color:#64748b;">
            Protocolo: <strong>${escapeHtml(dec.protocolo || "")}</strong> • R.A: <strong>${escapeHtml(dec.ra || "")}</strong> • Data: <strong>${escapeHtml(fmtDateBR(dec.data))}</strong>
          </div>
          ${dec.descricao ? `<div style="font-size:12px; color:#475569; margin-top:4px;">${escapeHtml(dec.descricao)}</div>` : ""}
        </div>
        <div style="font-size:12px; color:#64748b;">
          ${escapeHtml(dec.filename || "")}
        </div>
      </div>
    `;

    if (dec.kind === "upload") {
      const isPdf = String(dec.mime || "").includes("pdf");
      if (isPdf) {
        body.innerHTML = `<iframe src="${escapeHtml(dec.dataUrl)}" style="width:100%; height:70vh; border:0;" title="PDF"></iframe>`;
      } else {
        body.innerHTML = `
          <div style="background:#0b1220; display:flex; justify-content:center; align-items:center; padding:12px;">
            <img src="${escapeHtml(dec.dataUrl)}" alt="Documento" style="max-width:100%; max-height:70vh; object-fit:contain; border-radius:10px;">
          </div>
        `;
      }
    } else {
      body.innerHTML = `<iframe srcdoc="${escapeHtml(dec.html || "")}" style="width:100%; height:70vh; border:0; background:#fff;" title="Declaração"></iframe>`;
    }

    openDialog("#dlgDecViewPatch");
  }

  function bindModuleEvents() {
    const fTxt = qs("#fDecTxt");
    const fTipo = qs("#fDecTipo");
    const fStatus = qs("#fDecStatus");
    fTxt && fTxt.addEventListener("input", refreshList);
    fTipo && fTipo.addEventListener("change", refreshList);
    fStatus && fStatus.addEventListener("change", refreshList);

    qs("#btnEmitirDec")?.addEventListener("click", () => openEmitir());
    qs("#btnUploadDec")?.addEventListener("click", () => openUpload());

    // tipo change -> atualiza texto
    qs("#decTipo")?.addEventListener("change", () => {
      const perfil = loadPerfilEscola();
      const payload = {
        ra: qs("#decRA")?.value || "",
        estudante: qs("#decEstudante")?.value || "",
        serie: qs("#decSerie")?.value || "",
        turma: qs("#decTurma")?.value || "",
        ano: qs("#decAno")?.value || "",
        destinatario: qs("#decDest")?.value || "",
        data: qs("#decData")?.value || nowIsoDate(),
        nomeEscola: perfil.nomeEscola || "Secretaria Escolar",
      };
      const tipo = qs("#decTipo")?.value || "Declaração de Matrícula";
      qs("#decTexto").value = templateTexto(tipo, payload);
    });

    // tabela actions (delegação)
    qs("#tblDecPatch")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-act]");
      if (!btn) return;
      ev.preventDefault();

      const act = btn.dataset.act;
      const sid = btn.dataset.sid;
      const did = btn.dataset.did;

      if (sid) {
        if (act === "emitir") {
          const sol = loadSolicitacoes().find((s) => String(s.id) === String(sid));
          if (!sol) return alert("Solicitação não encontrada.");

          const mat = loadMatriculas().find((m) => safeText(m.ra) === safeText(sol.ra)) || null;

          return openEmitir({
            sid,
            preset: {
              ra: sol.ra || "",
              estudante: sol.estudante || "",
              tipo: sol.tipo || "Declaração de Matrícula",
              ano: mat?.ano || String(new Date().getFullYear()),
              serie: mat?.serie || "",
              turma: mat?.turma || "",
              destinatario: sol.destinatario || "",
            },
          });
        }

        if (act === "pronta") {
          if (!confirm("Marcar como PRONTA para retirada?")) return;
          updateSolicitacaoStatus(sid, "PRONTA");
          refreshList();
          return;
        }

        if (act === "entregue") {
          if (!confirm("Marcar como ENTREGUE?")) return;
          updateSolicitacaoStatus(sid, "ENTREGUE");
          refreshList();
          return;
        }

        if (act === "del-s") {
          const sols = loadSolicitacoes();
          const item = sols.find((s) => String(s.id) === String(sid));
          const nome = item?.estudante ? `"${item.estudante}"` : "esta solicitação";
          if (!confirm(`Excluir ${nome}?`)) return;
          saveSolicitacoes(sols.filter((s) => String(s.id) !== String(sid)));
          refreshList();
          return;
        }
      }

      if (did) {
        if (act === "ver") return openView(did);

        const decs = loadDeclaracoes();
        const dec = decs.find((d) => String(d.id) === String(did));
        if (!dec) return;

        if (act === "imprimir") {
          if (dec.kind === "upload") {
            openView(did);
            alert("Para PDF/imagem, use Ctrl+P na visualização.");
            return;
          }
          printHtmlViaIframe(dec.html || "");
          return;
        }

        if (act === "baixar") {
          if (dec.kind === "upload") {
            return downloadDataUrl({ dataUrl: dec.dataUrl, filename: dec.filename || `arquivo_${dec.id}` });
          }
          const blob = new Blob([dec.html || ""], { type: "text/html;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          downloadDataUrl({ dataUrl: url, filename: `${dec.protocolo || "declaracao"}.html` });
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          return;
        }

        if (act === "entregue-d") {
          if (dec.solicitacaoId) {
            if (!confirm("Marcar a solicitação vinculada como ENTREGUE?")) return;
            updateSolicitacaoStatus(dec.solicitacaoId, "ENTREGUE");
          } else {
            if (!confirm("Marcar este item como ENTREGUE?")) return;
            dec.status = "ENTREGUE";
            dec.updatedAt = new Date().toISOString();
            saveDeclaracoes(decs);
          }
          refreshList();
          return;
        }

        if (act === "del-d") {
          const nome = dec?.estudante ? `"${dec.estudante}"` : "este item";
          if (!confirm(`Excluir ${nome}?`)) return;
          saveDeclaracoes(decs.filter((d) => String(d.id) !== String(did)));
          refreshList();
          return;
        }
      }
    });

    // close dialogs
    document.addEventListener("click", (ev) => {
      if (ev.target.closest("#btnFecharDlgDecEmitir, #btnCancelarDecEmitir")) {
        ev.preventDefault();
        closeDialog("#dlgDecEmitir");
      }
      if (ev.target.closest("#btnFecharDlgDecUpload, #btnCancelarDecUpload")) {
        ev.preventDefault();
        closeDialog("#dlgDecUpload");
      }
      if (ev.target.closest("#btnFecharDlgDecViewPatch")) {
        ev.preventDefault();
        closeDialog("#dlgDecViewPatch");
      }
    });

    // submit emitir
    document.addEventListener("submit", (e) => {
      const form = e.target;
      if (!form || form.id !== "formDecEmitir") return;

      e.preventDefault();
      const err = qs("#decEmitirErro");
      err && (err.textContent = "");

      const sid = safeText(qs("#decSolicId")?.value);
      const ra = safeText(qs("#decRA")?.value);
      const estudante = safeText(qs("#decEstudante")?.value);
      const tipo = safeText(qs("#decTipo")?.value);
      const data = safeText(qs("#decData")?.value) || nowIsoDate();
      const destinatario = safeText(qs("#decDest")?.value);
      const ano = safeText(qs("#decAno")?.value) || String(new Date().getFullYear());
      const serie = safeText(qs("#decSerie")?.value);
      const turma = safeText(qs("#decTurma")?.value);
      const texto = safeText(qs("#decTexto")?.value);

      if (!ra || !estudante || !tipo || !data || !texto) {
        err && (err.textContent = "Preencha os campos obrigatórios (*).");
        return;
      }

      const decs = loadDeclaracoes();
      const id = nextDeclaracaoId(decs);
      const protocolo = `DEC-${String(id).padStart(5, "0")}`;

      const html = buildDeclaracaoHtmlPrint({
        protocolo, tipo, ra, estudante, data, destinatario, ano, serie, turma, texto,
      });

      decs.push({
        id,
        kind: "emitida",
        protocolo,
        tipoExibicao: tipo,
        tipo,
        ra,
        estudante,
        data,
        destinatario,
        ano,
        serie,
        turma,
        texto,
        html,
        status: "PRONTA",
        solicitacaoId: sid ? Number(sid) : null,
        createdAt: new Date().toISOString(),
        escolaKey: getEscolaKey(),
      });

      saveDeclaracoes(decs);

      if (sid) updateSolicitacaoStatus(sid, "PRONTA");

      closeDialog("#dlgDecEmitir");
      refreshList();

      if (confirm("Declaração salva como PRONTA. Deseja imprimir agora?")) {
        printHtmlViaIframe(html);
      }
    }, true);

    // submit upload
    document.addEventListener("submit", async (e) => {
      const form = e.target;
      if (!form || form.id !== "formDecUpload") return;

      e.preventDefault();
      const err = qs("#decUploadErro");
      err && (err.textContent = "");

      const sid = safeText(qs("#upSolicId")?.value);
      const ra = safeText(qs("#upRA")?.value);
      const estudante = safeText(qs("#upEstudante")?.value);
      const tipo = safeText(qs("#upTipo")?.value);
      const data = safeText(qs("#upData")?.value) || nowIsoDate();
      const descricao = safeText(qs("#upDesc")?.value);
      const file = qs("#upArquivo")?.files?.[0];

      if (!ra || !estudante || !tipo || !data || !file) {
        err && (err.textContent = "Preencha os campos obrigatórios (*).");
        return;
      }

      try {
        const dataUrl = await fileToDocDataUrl(file, { maxBytes: 2500000 });

        const decs = loadDeclaracoes();
        const id = nextDeclaracaoId(decs);
        const protocolo = `DEC-${String(id).padStart(5, "0")}`;

        decs.push({
          id,
          kind: "upload",
          protocolo,
          tipoExibicao: "Upload",
          tipo: "Upload",
          ra,
          estudante,
          data,
          descricao,
          filename: safeText(file.name) || `documento_${Date.now()}`,
          mime: safeText(file.type) || "",
          dataUrl,
          status: "PRONTA",
          solicitacaoId: sid ? Number(sid) : null,
          createdAt: new Date().toISOString(),
          escolaKey: getEscolaKey(),
        });

        saveDeclaracoes(decs);

        if (sid) updateSolicitacaoStatus(sid, "PRONTA");

        closeDialog("#dlgDecUpload");
        refreshList();

        if (confirm("Documento salvo como PRONTO. Deseja visualizar agora?")) {
          openView(id);
        }
      } catch (e2) {
        err && (err.textContent = e2?.message || "Não foi possível salvar o documento.");
      }
    }, true);
  }

  // ===== Hook menu click =====
  function hookMenuClicks() {
    // delega para o sidebar: quando clicar em "Declarações", renderiza
    const sidebar = qs(".sidebar");
    if (!sidebar) return;

    if (window.__dec_patch_menu_hooked) return;
    window.__dec_patch_menu_hooked = true;

    sidebar.addEventListener("click", (ev) => {
      const item = ev.target.closest(".menu-item");
      if (!item) return;
      if (item.textContent.trim().toLowerCase() !== "declarações") return;

      ev.preventDefault();
      setActiveMenu("Declarações");
      renderModule();
    });
  }

  function init() {
    ensureMenuItem();
    hookMenuClicks();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
