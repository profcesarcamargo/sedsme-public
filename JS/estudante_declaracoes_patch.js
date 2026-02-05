// public/js/estudante_declaracoes_patch.js
// ✅ Patch para o Perfil Estudante: solicitar e acompanhar Declarações/Documentos.
//
// Como usar (modo simples):
// 1) Inclua este script na página do Estudante (após guard.js e após seu estudante.js):
//    <script src="/js/estudante_declaracoes_patch.js"></script>
//
// 2) No HTML do Estudante, crie um container onde deseja mostrar "Declarações/Documentos":
//    <div id="areaSolicitacoesEstudante"></div>
//
// 3) Chame (por exemplo ao abrir o menu "Declarações"):
//    window.SEDSME_EstudanteDocs.render("#areaSolicitacoesEstudante");
//
// Armazenamento (por escola):
// - sedsme_solicitacoes_documentos:<escolaKey>

(function () {
  const qs = (sel, root = document) => root.querySelector(sel);

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeKey(s) {
    return String(s || "")
      .trim()
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

  const LS_KEY_SOLICITACOES_PREFIX = "sedsme_solicitacoes_documentos:";

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

  function solicitacoesKey() {
    return LS_KEY_SOLICITACOES_PREFIX + getEscolaKey();
  }

  function loadSolicitacoes() {
    const raw = localStorage.getItem(solicitacoesKey());
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveSolicitacoes(list) {
    localStorage.setItem(solicitacoesKey(), JSON.stringify(list));
  }

  function nextSolicitacaoId(list) {
    return list.reduce((acc, it) => Math.max(acc, Number(it.id) || 0), 0) + 1;
  }

  function statusLabel(status) {
    const s = String(status || "").toUpperCase();
    if (s === "SOLICITADA") return "Solicitada";
    if (s === "PRONTA") return "✅ Pronta para retirada na Secretaria da Escola";
    if (s === "ENTREGUE") return "Entregue";
    return s || "—";
  }

  function badge(status) {
    const s = String(status || "").toUpperCase();
    const map = {
      SOLICITADA: { bg: "#fff7ed", bd: "#fed7aa", tx: "#9a3412" },
      PRONTA: { bg: "#ecfdf5", bd: "#a7f3d0", tx: "#065f46" },
      ENTREGUE: { bg: "#eff6ff", bd: "#bfdbfe", tx: "#1e40af" }
    };
    const st = map[s] || { bg: "#f8fafc", bd: "#e2e8f0", tx: "#334155" };
    return `<span style="display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid ${st.bd}; background:${st.bg}; color:${st.tx}; font-weight:900;">${escapeHtml(statusLabel(s))}</span>`;
  }

  function getSessionStudent() {
    const session =
      window.SEDSME && typeof window.SEDSME.getSession === "function"
        ? window.SEDSME.getSession()
        : null;

    const ra = session?.ra || session?.RA || session?.estudanteRa || "";
    const estudante = session?.nome || session?.estudante || session?.usuario || "";
    return { ra: String(ra || ""), estudante: String(estudante || "") };
  }

  function render(containerSel) {
    const root = typeof containerSel === "string" ? qs(containerSel) : containerSel;
    if (!root) return;

    const { ra, estudante } = getSessionStudent();
    const listAll = loadSolicitacoes();

    const list = listAll
      .filter((s) => {
        if (ra) return String(s.ra || "") === String(ra);
        if (estudante) return String(s.estudante || "").toLowerCase() === String(estudante).toLowerCase();
        return false;
      })
      .sort((a, b) => {
        const da = String(a.dataSolicitacao || a.createdAt || "");
        const db = String(b.dataSolicitacao || b.createdAt || "");
        if (da !== db) return db.localeCompare(da);
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });

    root.innerHTML = `
      <div style="border:1px solid #eee; border-radius:12px; padding:14px; background:#fff;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:900; color:#0f172a;">Declarações e Documentos</div>
            <div style="font-size:12px; color:#64748b;">Solicite e acompanhe o status das suas solicitações.</div>
          </div>

          <button id="btnNovaSolicitacaoEst" style="padding:10px 14px; border-radius:8px; border:0; background:#1b4da1; color:#fff; cursor:pointer;">
            + Nova Solicitação
          </button>
        </div>

        <div id="areaFormSolic" style="display:none; margin-top:12px; border-top:1px solid #eee; padding-top:12px;">
          <div id="errSolic" style="color:#c0392b; margin-bottom:10px;"></div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div>
              <div style="font-size:12px; color:#64748b; font-weight:900;">R.A</div>
              <input id="solRA" value="${escapeHtml(ra)}" placeholder="R.A"
                style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
            </div>

            <div>
              <div style="font-size:12px; color:#64748b; font-weight:900;">Data</div>
              <input id="solData" type="date" value="${escapeHtml(nowIsoDate())}"
                style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
            </div>

            <div style="grid-column:1/-1;">
              <div style="font-size:12px; color:#64748b; font-weight:900;">Estudante</div>
              <input id="solEstudante" value="${escapeHtml(estudante)}" placeholder="Nome do estudante"
                style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
            </div>

            <div>
              <div style="font-size:12px; color:#64748b; font-weight:900;">Tipo</div>
              <select id="solTipo" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
                <option value="">Selecione</option>
                <option value="Declaração de Matrícula">Declaração de Matrícula</option>
                <option value="Declaração de Transferência">Declaração de Transferência</option>
                <option value="Declaração de Vaga">Declaração de Vaga</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <div style="font-size:12px; color:#64748b; font-weight:900;">Destinatário (opcional)</div>
              <input id="solDest" placeholder="Ex.: Empresa, INSS..."
                style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
            </div>

            <div style="grid-column:1/-1;">
              <div style="font-size:12px; color:#64748b; font-weight:900;">Observação (opcional)</div>
              <input id="solObs" placeholder="Ex.: urgência, finalidade..."
                style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px;">
            </div>
          </div>

          <div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
            <button id="btnCancSolic" style="padding:10px 14px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer;">Cancelar</button>
            <button id="btnEnviarSolic" style="padding:10px 14px; border-radius:8px; border:0; background:#16a34a; color:#fff; cursor:pointer;">Enviar Solicitação</button>
          </div>
        </div>

        <div style="margin-top:14px; overflow:auto;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid #eee;">
                <th style="padding:10px;">Data</th>
                <th style="padding:10px;">Protocolo</th>
                <th style="padding:10px;">Tipo</th>
                <th style="padding:10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                list.length
                  ? list
                      .map(
                        (s) => `
                    <tr style="border-bottom:1px solid #f1f1f1;">
                      <td style="padding:10px;">${escapeHtml(fmtDateBR(s.dataSolicitacao || s.createdAt?.slice(0, 10) || ""))}</td>
                      <td style="padding:10px; font-weight:900; color:#0f172a;">${escapeHtml(s.protocolo || `SOL-${String(s.id).padStart(5, "0")}`)}</td>
                      <td style="padding:10px;">${escapeHtml(s.tipo || "")}</td>
                      <td style="padding:10px;">${badge(s.status)}</td>
                    </tr>
                  `
                      )
                      .join("")
                  : `<tr><td colspan="4" style="padding:14px; text-align:center; color:#64748b;">Nenhuma solicitação encontrada.</td></tr>`
              }
            </tbody>
          </table>
        </div>

        <div style="margin-top:10px; font-size:12px; color:#94a3b8;">
          Quando o status ficar <strong>Pronta</strong>, você poderá retirar na Secretaria da Escola.
        </div>
      </div>
    `;

    const btnNova = qs("#btnNovaSolicitacaoEst", root);
    const areaForm = qs("#areaFormSolic", root);
    const btnCanc = qs("#btnCancSolic", root);
    const btnEnviar = qs("#btnEnviarSolic", root);

    btnNova?.addEventListener("click", () => {
      areaForm.style.display = areaForm.style.display === "none" ? "block" : "none";
    });

    btnCanc?.addEventListener("click", () => {
      areaForm.style.display = "none";
    });

    btnEnviar?.addEventListener("click", () => {
      const err = qs("#errSolic", root);
      if (err) err.textContent = "";

      const raV = (qs("#solRA", root)?.value || "").trim();
      const estV = (qs("#solEstudante", root)?.value || "").trim();
      const tipoV = (qs("#solTipo", root)?.value || "").trim();
      const dataV = (qs("#solData", root)?.value || nowIsoDate()).trim();
      const destV = (qs("#solDest", root)?.value || "").trim();
      const obsV = (qs("#solObs", root)?.value || "").trim();

      if (!raV || !estV || !tipoV) {
        if (err) err.textContent = "Preencha R.A, Estudante e Tipo.";
        return;
      }

      const all = loadSolicitacoes();
      const id = nextSolicitacaoId(all);
      const protocolo = `SOL-${String(id).padStart(5, "0")}`;

      all.push({
        id,
        protocolo,
        ra: raV,
        estudante: estV,
        tipo: tipoV,
        destinatario: destV,
        obs: obsV,
        status: "SOLICITADA",
        dataSolicitacao: dataV,
        createdAt: new Date().toISOString(),
      });

      saveSolicitacoes(all);
      render(root);
      alert("Solicitação enviada! Você poderá acompanhar o status por aqui.");
    });
  }

  window.SEDSME_EstudanteDocs = { render };
})();
