// professor.js - Versão melhorada para carregar estudantes das turmas atribuídas

(function () {
    "use strict";

    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

    let TURMAS_CACHE = [];
    let turmaAtiva = null;
    let estudantesTurma = [];

    // =========================
    // Funções Auxiliares
    // =========================
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

    function isUuid(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || "").trim());
    }


    function lsGet(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch {
            return fallback;
        }
    }

    function lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }

    function toCSV(rows, headers) {
        const esc = (v) => {
            const s = String(v ?? "");
            if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
            return s;
        };
        const out = [];
        if (headers?.length) out.push(headers.map(esc).join(","));
        for (const r of rows) out.push(r.map(esc).join(","));
        return out.join("\n");
    }

    function downloadCSV(filename, csvText) {
        const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // =========================
    // Exportação PDF (jsPDF)
    // =========================
    function ensureJsPDF() {
        const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (!jsPDF) {
            alert("Biblioteca de PDF não carregada (jsPDF). Verifique os scripts no professor.html.");
            return null;
        }
        return jsPDF;
    }

    function downloadPDF(filename, doc) {
        try { doc.save(filename); } catch (e) {
            console.warn("Falha ao salvar PDF:", e);
            alert("Não foi possível gerar o PDF. Veja o console.");
        }
    }

    // =========================
    // Persistência no Supabase (Diário)
    // =========================
    async function getProfessorId() {
        const session = await getSession();
        return session?.user?.id || null;
    }

    async function salvarChamadaNoSupabase(turmaId, dataChamada, registros) {
        const supa = window.supabaseClient;
        const profId = await getProfessorId();
        if (!supa || !profId) throw new Error("Sessão/Supabase indisponível.");

        const { data: cab, error: e1 } = await supa
            .from("diario_chamadas")
            .upsert([{ turma_id: turmaId, professor_id: profId, data: dataChamada }], { onConflict: "turma_id,professor_id,data" })
            .select("id")
            .single();
        if (e1) throw e1;

        const chamadaId = cab.id;

        const { error: eDel } = await supa
            .from("diario_chamada_itens")
            .delete()
            .eq("chamada_id", chamadaId);
        if (eDel) throw eDel;

        const itens = registros.map(r => ({
            chamada_id: chamadaId,
            estudante_id: (isUuid(String(r.estudante_id||"")) ? r.estudante_id : null),
            estudante_nome: r.estudante_nome || "",
            ra: r.ra || null,
            situacao: r.situacao || "",
            justificativa: r.justificativa || ""
        }));

        const { error: eIns } = await supa.from("diario_chamada_itens").insert(itens);
        if (eIns) throw eIns;

        return chamadaId;
    }

    async function carregarChamadaSupabase(turmaId, dataChamada) {
        const supa = window.supabaseClient;
        const profId = await getProfessorId();
        if (!supa || !profId) return null;

        const { data: cab, error: e1 } = await supa
            .from("diario_chamadas")
            .select("id")
            .eq("turma_id", turmaId)
            .eq("professor_id", profId)
            .eq("data", dataChamada)
            .maybeSingle();
        if (e1 || !cab?.id) return null;

        const { data: itens, error: e2 } = await supa
            .from("diario_chamada_itens")
            .select("estudante_id, estudante_nome, ra, situacao, justificativa")
            .eq("chamada_id", cab.id);
        if (e2) return null;

        return { chamada_id: cab.id, itens: itens || [] };
    }

    async function salvarConteudoNoSupabase(payload) {
        const supa = window.supabaseClient;
        const profId = await getProfessorId();
        if (!supa || !profId) throw new Error("Sessão/Supabase indisponível.");

        const row = {
            turma_id: payload.turma_id,
            professor_id: profId,
            data: payload.data,
            bimestre: payload.bimestre || null,
            atividade: payload.atividade || null,
            conteudo: payload.conteudo || null,
            habilidade_bncc: payload.habilidade_bncc || null,
            objeto_conhecimento: payload.objeto_conhecimento || null,
            observacoes: payload.observacoes || null,
        };

        const { error } = await supa
            .from("diario_conteudos")
            .upsert([row], { onConflict: "turma_id,professor_id,data" });

        if (error) throw error;
    }

    async function listarConteudosSupabase(turmaId) {
        const supa = window.supabaseClient;
        const profId = await getProfessorId();
        if (!supa || !profId) return [];

        const { data, error } = await supa
            .from("diario_conteudos")
            .select("data, bimestre, atividade, conteudo, habilidade_bncc, objeto_conhecimento, observacoes")
            .eq("turma_id", turmaId)
            .eq("professor_id", profId)
            .order("data", { ascending: true });

        if (error) return [];
        return data || [];
    }



    async function getSession() {
        const supa = window.supabaseClient;
        if (!supa) return null;
        const { data } = await supa.auth.getSession();
        return data?.session || null;
    }

    // =========================
    // Carregar Perfil do Professor
    // =========================
    async function loadProfile() {
        const supa = window.supabaseClient;
        if (!supa) return;

        const session = await getSession();
        if (!session) return;

        const userId = session.user.id;
        
        // Buscar perfil do professor
        const { data: prof, error } = await supa
            .from("educsb")
            .select("nome, escola")
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            console.warn("[educsb] Erro ao carregar perfil:", error.message);
        }

        const nome = safeText(prof?.nome) || safeText(session.user.email) || "Professor(a)";
        const escola = safeText(prof?.escola) || "EMEF Santa Branca";

        // Atualizar interface
        qs("#userName").textContent = nome;
        qs("#welcomeName").textContent = nome;
        qs("#userSchool").textContent = `Escola: ${escola}`;
    }

    // =========================
    // Carregar Turmas Atribuídas
    // =========================
    async function loadTurmasAtribuidas() {
        const supa = window.supabaseClient;
        const session = await getSession();
        
        if (!supa || !session) {
            console.error("Supabase ou sessão não disponível");
            return [];
        }

        try {
            // Método 1: Via relação professor_turmas -> turmas
            const { data, error } = await supa
                .from("professor_turmas")
                .select(`
                    turma:turmas (
                        id,
                        nome,
                        escola,
                        periodo,
                        criado_em
                    )
                `)
                .eq("professor_id", session.user.id)
                .order("criado_em", { foreignTable: "turmas", ascending: true });

            if (!error && Array.isArray(data)) {
                const turmas = data
                    .map((r) => r.turma)
                    .filter(Boolean)
                    .map((t) => ({
                        id: t.id,
                        nome: safeText(t.nome) || "Turma sem nome",
                        escola: safeText(t.escola),
                        periodo: safeText(t.periodo),
                        criado_em: t.criado_em
                    }));

                console.log("Turmas carregadas (via relacionamento):", turmas);
                return turmas;
            }

            // Método 2: Fallback - duas consultas separadas
            console.log("Tentando método fallback...");
            const { data: links, error: e1 } = await supa
                .from("professor_turmas")
                .select("turma_id")
                .eq("professor_id", session.user.id);

            if (e1) throw new Error("Erro ao carregar professor_turmas: " + e1.message);

            const turmaIds = (links || []).map((x) => x.turma_id).filter(Boolean);
            
            if (turmaIds.length === 0) {
                console.log("Nenhuma turma atribuída a este professor");
                return [];
            }

            const { data: turmas, error: e2 } = await supa
                .from("turmas")
                .select("id, nome, escola, periodo, criado_em")
                .in("id", turmaIds)
                .order("estudante_nome", { ascending: true });

            if (e2) throw new Error("Erro ao carregar turmas: " + e2.message);

            const turmasFormatadas = (turmas || []).map((t) => ({
                id: t.id,
                nome: safeText(t.nome) || "Turma sem nome",
                escola: safeText(t.escola),
                periodo: safeText(t.periodo),criado_em: t.criado_em
            }));

            console.log("Turmas carregadas (via fallback):", turmasFormatadas);
            return turmasFormatadas;

        } catch (error) {
            console.error("Erro ao carregar turmas:", error);
            alert("Erro ao carregar turmas: " + error.message);
            return [];
        }
    }

    // =========================
    // Carregar Estudantes da Turma
    // =========================
    async function loadEstudantesDaTurma(turmaId) {
        const supa = window.supabaseClient;
        if (!supa) {
            console.error("Supabase não disponível");
            return [];
        }

        try {
            // Método 1: Buscar da tabela turma_estudantes (formato atual)
            let { data, error } = await supa
                .from("turma_estudantes")
                .select("estudante_id, estudante_nome, estudante_ra")
                .eq("turma_id", turmaId)
                .order("estudante_nome", { ascending: true });

            // Se sua tabela não tiver 'estudante_id' ou 'ra', tenta novamente só com 'estudante_nome'
            if (error && /column .* does not exist/i.test(error.message || "")) {
                const retry = await supa
                    .from("turma_estudantes")
                    .select("estudante_nome")
                    .eq("turma_id", turmaId)
                    .order("estudante_nome", { ascending: true });

                data = retry.data;
                error = retry.error;
            }

            if (!error && Array.isArray(data)) {
                const estudantes = data.map((estudante, index) => ({
                    id: (isUuid(String(estudante.estudante_id||"")) ? estudante.estudante_id : `${turmaId}-${index}`),
                    numero: index + 1,
                    nome: safeText(estudante.estudante_nome) || "Estudante sem nome",
                    ra: safeText(estudante.estudante_ra || estudante.ra) || ""
                }));

                console.log(`Estudantes carregados para turma ${turmaId}:`, estudantes);
                return estudantes;
            }

            // Método 2: Fallback - relação turma_estudantes -> estudantes
            console.log("Tentando método fallback para estudantes...");
            const { data: relacoes, error: e1 } = await supa
                .from("turma_estudantes")
                .select("estudante_id")
                .eq("turma_id", turmaId);

            if (e1) throw new Error("Erro ao carregar relação estudantes: " + e1.message);

            const estudanteIds = (relacoes || []).map((r) => r.estudante_id).filter(Boolean);
            
            if (estudanteIds.length === 0) {
                console.log("Nenhum estudante encontrado nesta turma");
                return [];
            }

            const { data: estudantes, error: e2 } = await supa
                .from("estudantes")
                .select("id, estudante_nome, estudante_ra")
                .in("id", estudanteIds)
                .order("estudante_nome", { ascending: true });

            if (e2) throw new Error("Erro ao carregar dados dos estudantes: " + e2.message);

            const estudantesFormatados = estudantes.map((estudante, index) => ({
                id: estudante.id,
                numero: index + 1,
                nome: safeText(estudante.estudante_nome || estudante.nome) || "Estudante sem nome",
                ra: safeText(estudante.estudante_ra || estudante.ra) || ""
            }));

            console.log(`Estudantes carregados (fallback) para turma ${turmaId}:`, estudantesFormatados);
            return estudantesFormatados;

        } catch (error) {
            console.error(`Erro ao carregar estudantes da turma ${turmaId}:`, error);
            alert("Erro ao carregar estudantes: " + error.message);
            return [];
        }
    }

    // =========================
    // Renderizar Turmas no Dashboard
    // =========================
    function renderMinhasTurmas(turmas) {
        const container = qs("#sbTurmasList");
        const msg = qs("#sbTurmasMsg");
        
        if (!container) return;

        // Limpar mensagem
        if (msg) msg.textContent = "";

        if (!turmas || turmas.length === 0) {
            container.innerHTML = `
                <div class="turma-card" style="border-left-color:#94a3b8;">
                    <div class="turma-header">
                        <h3>Nenhuma turma atribuída</h3>
                        <span class="turma-periodo">---</span>
                    </div>
                    <div class="turma-info">
                        <div class="turma-stats">
                            <span>⚠️ Aguarde a SME atribuir turmas ao seu perfil</span>
                        </div>
                    </div>
                </div>
            `;
            if (msg) msg.textContent = "Nenhuma turma atribuída no momento.";
            return;
        }

        // Renderizar cards das turmas
        container.innerHTML = turmas.map((turma) => {
            const subtitulo = [turma.escola, turma.periodo].filter(Boolean).join(" • ");
            
            return `
                <div class="turma-card">
                    <div class="turma-header">
                        <h3>${escapeHtml(turma.nome)}</h3>
                        <span class="turma-periodo">${escapeHtml(turma.periodo || "-")}</span>
                    </div>
                    <div class="turma-info">
                        <div class="turma-stats">
                            ${subtitulo ? `<span>🏫 ${escapeHtml(subtitulo)}</span>` : ''}</div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // =========================
    // Renderizar Turmas no Diário
    // =========================
    function renderDiarioCards(turmas) {
        const container = qs("#turmas-container");
        if (!container) return;

        if (!turmas || turmas.length === 0) {
            container.innerHTML = `
                <div class="turma-card" style="border-left-color:#94a3b8;">
                    <div class="turma-header">
                        <h3>Sem turmas para exibir</h3>
                        <span class="turma-periodo">Diário</span>
                    </div>
                    <div class="turma-info">
                        <div class="turma-stats">
                            <span>⚠️ Ajuste os filtros ou aguarde atribuição de turmas</span>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = turmas.map((turma) => {
            const subtitulo = [turma.escola, turma.periodo].filter(Boolean).join(" • ");
            
            return `
                <div class="turma-card">
                    <div class="turma-header">
                        <h3>${escapeHtml(turma.nome)}</h3>
                        <span class="turma-periodo">${escapeHtml(turma.periodo || "-")}</span>
                    </div>
                    <div class="turma-info">
                        <div class="turma-stats">
                            ${subtitulo ? `<span>🏫 ${escapeHtml(subtitulo)}</span>` : ''}
                        </div>
                    </div>
                    <div class="turma-actions">
                        <button class="btn-action" onclick="abrirRegistroChamada('${escapeHtml(turma.id)}')">
                            📋 Chamada
                        </button>
                        <button class="btn-action" onclick="abrirRegistroConteudo('${escapeHtml(turma.id)}')">
                            📚 Conteúdo
                        </button>
                        <button class="btn-action" onclick="abrirRegistroNotas('${escapeHtml(turma.id)}')">
                            📝 Notas
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }

    // =========================
    // Filtros do Diário
    // =========================
    function setupFilters() {
        const filtroEscola = qs("#filtroEscola");
        const filtroTurma = qs("#filtroTurma");
        const btnLimpar = qs("#btnLimparFiltros");

        if (!filtroEscola || !filtroTurma || !btnLimpar) return;

        // Popular filtro de escolas
        const escolas = [...new Set(TURMAS_CACHE.map(t => t.escola).filter(Boolean))].sort();
        escolas.forEach(escola => {
            const option = document.createElement("option");
            option.value = escola;
            option.textContent = escola;
            filtroEscola.appendChild(option);
        });

        // Popular filtro de turmas
        TURMAS_CACHE.forEach(turma => {
            const option = document.createElement("option");
            option.value = turma.id;
            option.textContent = turma.nome;
            filtroTurma.appendChild(option);
        });

        // Eventos dos filtros
        filtroEscola.addEventListener("change", aplicarFiltros);
        filtroTurma.addEventListener("change", aplicarFiltros);
        
        btnLimpar.addEventListener("click", () => {
            filtroEscola.value = "";
            filtroTurma.value = "";
            aplicarFiltros();
        });
    }

    function aplicarFiltros() {
        const filtroEscola = qs("#filtroEscola");
        const filtroTurma = qs("#filtroTurma");

        const escolaSelecionada = filtroEscola ? filtroEscola.value : "";
        const turmaSelecionada = filtroTurma ? filtroTurma.value : "";

        let turmasFiltradas = [...TURMAS_CACHE];

        if (escolaSelecionada) {
            turmasFiltradas = turmasFiltradas.filter(t => t.escola === escolaSelecionada);
        }

        if (turmaSelecionada) {
            turmasFiltradas = turmasFiltradas.filter(t => t.id === turmaSelecionada);
        }

        renderDiarioCards(turmasFiltradas);
    }

    // =========================
    // Modal de Chamada
    // =========================
    window.abrirRegistroChamada = async function(turmaId) {
        turmaAtiva = TURMAS_CACHE.find(t => t.id === turmaId);
        if (!turmaAtiva) {
            alert("Turma não encontrada!");
            return;
        }

        // Carregar estudantes da turma
        estudantesTurma = await loadEstudantesDaTurma(turmaId);

        // Atualizar modal
        qs("#chamada-turma-titulo").textContent = `Turma: ${turmaAtiva.nome}`;
        usarDataHoje("dataChamada");

        // Renderizar tabela
        renderTabelaChamada();

        // Mostrar modal
        qs("#modal-chamada").style.display = "block";
    };

    function renderTabelaChamada() {
        const tbody = qs("#corpo-chamada");
        if (!tbody) return;

        if (estudantesTurma.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding:20px; text-align:center; color:#666;">
                        Nenhum estudante encontrado nesta turma.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = estudantesTurma.map(estudante => `
            <tr>
                <td><strong>${estudante.numero}</strong></td>
                <td>${escapeHtml(estudante.nome)}</td>
                <td>
                    <select class="situacao-estudante" data-estudante-id="${estudante.id}">
                        <option value="presente">✅ Presente</option>
                        <option value="falta">❌ Falta</option>
                        <option value="falta-justificada">⚠️ Falta Justificada</option>
                        <option value="atraso">⏰ Atraso</option>
                    </select>
                </td>
                <td>
                    <input type="text" 
                           class="justificativa-estudante" 
                           data-estudante-id="${estudante.id}"
                           placeholder="Motivo da falta/atraso..." 
                           style="width:100%; padding:6px;">
                </td>
            </tr>
        `).join("");
    }

    window.salvarChamada = async function() {
        if (!turmaAtiva) {
            alert("Nenhuma turma selecionada!");
            return;
        }

        const dataChamada = qs("#dataChamada")?.value;
        if (!dataChamada) {
            alert("Selecione uma data!");
            return;
        }

        const registros = [];
        (estudantesTurma || []).forEach(estudante => {
            const select = qs(`.situacao-estudante[data-estudante-id="${estudante.id}"]`);
            const justificativa = qs(`.justificativa-estudante[data-estudante-id="${estudante.id}"]`);
            if (!select) return;

            registros.push({
                estudante_id: (isUuid(String(estudante.id||"")) ? estudante.id : null),
                estudante_nome: estudante.nome,
                ra: estudante.ra || "",
                situacao: select.value,
                justificativa: justificativa ? justificativa.value : ""
            });
        });

        // 1) Tenta salvar no Supabase
        try {
            await salvarChamadaNoSupabase(turmaAtiva.id, dataChamada, registros);
            alert(`Chamada salva no Supabase para ${dataChamada}!\nTotal de registros: ${registros.length}`);
            fecharModal("modal-chamada");
            return;
        } catch (e) {
            console.warn("Falha ao salvar no Supabase. Salvando localmente.", e?.message || e);
        }

        // 2) Fallback: localStorage
        const key = `sedsme_chamada_${turmaAtiva.id}`;
        const historico = lsGet(key, []);
        historico.push({ data: dataChamada, turma_id: turmaAtiva.id, turma_nome: turmaAtiva.nome, registros });
        lsSet(key, historico);

        alert(`Chamada salva localmente para ${dataChamada}!\nTotal de registros: ${registros.length}\n\n(Obs.: Supabase não pôde ser usado, veja o console.)`);
        fecharModal("modal-chamada");
    };

    // =========================
    // Modal de Conteúdo
    // =========================
    window.abrirRegistroConteudo = function(turmaId) {
        turmaAtiva = TURMAS_CACHE.find(t => t.id === turmaId);
        if (!turmaAtiva) {
            alert("Turma não encontrada!");
            return;
        }

        usarDataHoje("dataAula");
        qs("#modal-conteudo").style.display = "block";
    };

    window.salvarConteudo = async function() {
        if (!turmaAtiva) { alert("Nenhuma turma selecionada!"); return; }

        const form = qs("#form-conteudo");
        if (form && !form.checkValidity()) { alert("Preencha todos os campos obrigatórios!"); return; }

        const payload = {
            turma_id: turmaAtiva.id,
            data: qs("#dataAula")?.value,
            bimestre: qs("#bimestreConteudo")?.value,
            atividade: qs("#atividadeAula")?.value,
            conteudo: qs("#conteudoAula")?.value,
            habilidade_bncc: qs("#habilidadeBNCC")?.value,
            objeto_conhecimento: qs("#objetoConhecimento")?.value,
            observacoes: qs("#observacoesAula")?.value
        };

        if (!payload.data) { alert("Informe a data da aula."); return; }

        try {
            await salvarConteudoNoSupabase(payload);
            alert("Conteúdo registrado e salvo no Supabase!");
            fecharModal("modal-conteudo");
            if (form) form.reset();
            return;
        } catch (e) {
            console.warn("Falha ao salvar conteúdo no Supabase:", e?.message || e);
        }

        const key = `sedsme_conteudo_${turmaAtiva.id}`;
        const lista = lsGet(key, []);
        lista.push({ ...payload, turma_nome: turmaAtiva.nome, created_at: new Date().toISOString() });
        lsSet(key, lista);

        alert("Conteúdo salvo localmente (Supabase indisponível). Veja o console.");
        fecharModal("modal-conteudo");
        if (form) form.reset();
    };

    // =========================
    // Logout
    // =========================
    window.sair = function() {
        if (confirm("Deseja realmente sair do sistema?")) {
            // Limpar sessão local
            try {
                localStorage.removeItem("sedsme_session");
                sessionStorage.clear();
            } catch (e) {
                console.warn("Erro ao limpar sessão:", e);
            }
            
            // Redirecionar para login
            window.location.href = "/index1.html";
        }
    };

    // =========================
    // Inicialização
    // =========================
    window.initProfessor = async function() {
        try {
            // Verificar autenticação
            const session = await getSession();
            if (!session) {
                window.location.href = "/index1.html";
                return;
            }

            // Carregar perfil
            await loadProfile();

            // Carregar turmas atribuídas
            TURMAS_CACHE = await loadTurmasAtribuidas();
            
            // Atualizar estatísticas
            updateStats(TURMAS_CACHE);

            // Renderizar turmas no dashboard
            renderMinhasTurmas(TURMAS_CACHE);

            // Configurar filtros do diário
            setupFilters();
            aplicarFiltros();

        } catch (error) {
            console.error("Erro na inicialização:", error);
            alert("Erro ao carregar dados do professor: " + error.message);
        }
    };

    function updateStats(turmas) {
        // Calcular estatísticas básicas
        const totalEstudantes = turmas.length * 25; // Aproximação
        
        qs("#totalDiarios").textContent = turmas.length;
        qs("#totalHA").textContent = "12"; // Exemplo
        qs("#totalAtividades").textContent = "8"; // Exemplo
        qs("#totalEstudantes").textContent = totalEstudantes;
        
        // Atualizar badges
        qs("#badge-diario").textContent = turmas.length;
        qs("#badge-ha").textContent = "5";
        qs("#badge-atividades").textContent = "2";
    }

    // Inicializar quando o DOM estiver pronto
    document.addEventListener("DOMContentLoaded", function() {
        if (window.supabaseClient) {
            

    window.exportarCSVChamada = async function() {
        if (!turmaAtiva) { alert("Abra uma turma na Chamada primeiro."); return; }
        const dataChamada = qs("#dataChamada")?.value;
        if (!dataChamada) { alert("Selecione a data."); return; }

        try {
            const existente = await carregarChamadaSupabase(turmaAtiva.id, dataChamada);
            if (existente?.itens?.length) {
                const rows = existente.itens.map((it, i) => ([
                    dataChamada, turmaAtiva.nome || "", String(i + 1),
                    it.estudante_nome || "", it.ra || "", it.situacao || "", it.justificativa || ""
                ]));
                const csv = toCSV(rows, ["data","turma","numero","estudante_nome","ra","situacao","justificativa"]);
                downloadCSV(`chamada_${(turmaAtiva.nome||"turma").replaceAll(" ","_")}_${dataChamada}.csv`, csv);
                return;
            }
        } catch {}

        const key = `sedsme_chamada_${turmaAtiva.id}`;
        const historico = lsGet(key, []);
        const bloco = historico.find(h => h.data === dataChamada);
        if (!bloco) { alert("Não há chamada salva para esta data."); return; }

        const rows = (bloco.registros || []).map((r, i) => ([
            dataChamada, bloco.turma_nome || turmaAtiva.nome || "", String(i + 1),
            r.estudante_nome || "", r.ra || "", r.situacao || "", r.justificativa || ""
        ]));
        const csv = toCSV(rows, ["data","turma","numero","estudante_nome","ra","situacao","justificativa"]);
        downloadCSV(`chamada_${(turmaAtiva.nome||"turma").replaceAll(" ","_")}_${dataChamada}.csv`, csv);
    };

    window.exportarPDFChamada = async function() {
        if (!turmaAtiva) { alert("Abra uma turma na Chamada primeiro."); return; }
        const dataChamada = qs("#dataChamada")?.value;
        if (!dataChamada) { alert("Selecione a data."); return; }

        const jsPDF = ensureJsPDF();
        if (!jsPDF) return;

        let itens = [];
        try {
            const existente = await carregarChamadaSupabase(turmaAtiva.id, dataChamada);
            itens = existente?.itens || [];
        } catch {}

        if (!itens.length) {
            const key = `sedsme_chamada_${turmaAtiva.id}`;
            const historico = lsGet(key, []);
            const bloco = historico.find(h => h.data === dataChamada);
            itens = (bloco?.registros || []).map(r => ({
                estudante_nome: r.estudante_nome,
                ra: r.ra,
                situacao: r.situacao,
                justificativa: r.justificativa
            }));
        }

        if (!itens.length) { alert("Não há chamada salva para esta data."); return; }

        const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
        doc.setFontSize(14);
        doc.text("Registro de Chamada", 40, 40);
        doc.setFontSize(11);
        doc.text(`Turma: ${turmaAtiva.nome || ""}`, 40, 60);
        doc.text(`Data: ${dataChamada}`, 40, 76);

        const rows = itens.map((it, i) => [String(i+1), it.estudante_nome || "", it.ra || "", it.situacao || "", it.justificativa || ""]);
        if (doc.autoTable) {
            doc.autoTable({ head: [["Nº","Estudante","RA","Situação","Justificativa"]], body: rows, startY: 95, styles: { fontSize: 9 } });
        } else {
            let y = 110;
            doc.setFontSize(9);
            doc.text("Nº | Estudante | RA | Situação | Justificativa", 40, y);
            y += 14;
            rows.slice(0, 40).forEach(r => { doc.text(r.join(" | ").slice(0, 140), 40, y); y += 12; });
        }

        downloadPDF(`chamada_${(turmaAtiva.nome||"turma").replaceAll(" ","_")}_${dataChamada}.pdf`, doc);
    };


window.initProfessor();
        } else {
            console.error("Supabase client não carregado!");
            alert("Erro: Supabase não configurado. Verifique o carregamento dos scripts.");
        }
    });



    window.exportarCSVConteudo = async function() {
        if (!turmaAtiva) { alert("Abra uma turma no Conteúdo primeiro."); return; }

        let rows = [];
        try {
            const itens = await listarConteudosSupabase(turmaAtiva.id);
            if (itens.length) {
                rows = itens.map(it => ([
                    it.data || "",
                    turmaAtiva.nome || "",
                    it.bimestre || "",
                    it.atividade || "",
                    it.habilidade_bncc || "",
                    it.objeto_conhecimento || "",
                    it.conteudo || "",
                    it.observacoes || ""
                ]));
            }
        } catch {}

        if (!rows.length) {
            const key = `sedsme_conteudo_${turmaAtiva.id}`;
            const lista = lsGet(key, []);
            rows = (lista || []).map(it => ([
                it.data || "",
                it.turma_nome || turmaAtiva.nome || "",
                it.bimestre || "",
                it.atividade || "",
                it.habilidade_bncc || "",
                it.objeto_conhecimento || "",
                it.conteudo || "",
                it.observacoes || ""
            ]));
        }

        if (!rows.length) { alert("Não há registros de conteúdo para exportar."); return; }

        const csv = toCSV(rows, ["data","turma","bimestre","atividade","habilidade_bncc","objeto_conhecimento","conteudo","observacoes"]);
        downloadCSV(`conteudo_${(turmaAtiva.nome||"turma").replaceAll(" ","_")}.csv`, csv);
    };

    window.exportarPDFConteudo = async function() {
        if (!turmaAtiva) { alert("Abra uma turma no Conteúdo primeiro."); return; }

        const jsPDF = ensureJsPDF();
        if (!jsPDF) return;

        let itens = [];
        try { itens = await listarConteudosSupabase(turmaAtiva.id); } catch {}

        if (!itens.length) {
            const key = `sedsme_conteudo_${turmaAtiva.id}`;
            itens = lsGet(key, []);
        }

        if (!itens.length) { alert("Não há registros de conteúdo para exportar."); return; }

        const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
        doc.setFontSize(14);
        doc.text("Registro de Conteúdo", 40, 40);
        doc.setFontSize(11);
        doc.text(`Turma: ${turmaAtiva.nome || ""}`, 40, 60);

        const rows = itens.map(it => [
            it.data || "",
            it.bimestre || "",
            it.atividade || "",
            it.habilidade_bncc || "",
            it.objeto_conhecimento || ""
        ]);

        let startY = 80;
        if (doc.autoTable) {
            doc.autoTable({
                head: [["Data","Bim.","Atividade","Habilidade BNCC","Objeto de Conhecimento"]],
                body: rows,
                startY,
                styles: { fontSize: 8 }
            });
            startY = (doc.lastAutoTable?.finalY || startY) + 18;
        }

        let y = startY;
        doc.setFontSize(10);
        itens.slice(0, 25).forEach((it) => {
            if (y > 760) { doc.addPage(); y = 40; }
            doc.text(`${it.data || ""} • ${it.atividade || ""}`, 40, y); y += 12;
            doc.setFontSize(9);
            const texto = String(it.conteudo || "").replace(/\s+/g, " ").trim().slice(0, 260);
            doc.text(texto || "-", 40, y); y += 18;
            doc.setFontSize(10);
        });

        downloadPDF(`conteudo_${(turmaAtiva.nome||"turma").replaceAll(" ","_")}.pdf`, doc);
    };



    // =========================
    // Notas (Boletim por Turma) - Gradebook (Supabase + Export)
    // =========================
    let NOTAS_ATIVIDADES = []; // [{nome, data}]
    let NOTAS_MATRIZ = {};     // { estudanteKey: { [atividadeKey]: notaString } }

    function estudanteKeyFrom(est) {
        // Preferir RA, senão nome
        const ra = safeText(est?.ra);
        if (ra) return `ra:${ra}`;
        return `nome:${safeText(est?.nome)}`;
    }

    function atividadeKeyFrom(a, idx) {
        return `${idx}:${safeText(a?.nome) || "Atividade"}`;
    }

    function mediaFromNotas(vals) {
        const nums = vals
            .map(v => String(v ?? "").replace(",", ".").trim())
            .map(v => (v === "" ? null : Number(v)))
            .filter(v => typeof v === "number" && !Number.isNaN(v));
        if (!nums.length) return "";
        const m = nums.reduce((s, n) => s + n, 0) / nums.length;
        return (Math.round(m * 100) / 100).toFixed(2);
    }

    function renderNotasGradebook() {
        const thead = qs("#thead-notas-gradebook");
        const tbody = qs("#tbody-notas-gradebook");
        if (!thead || !tbody) return;

        // Cabeçalho
        const colsAtiv = NOTAS_ATIVIDADES.length ? NOTAS_ATIVIDADES : [{ nome: "Atividade 1" }];
        if (!NOTAS_ATIVIDADES.length) NOTAS_ATIVIDADES = colsAtiv;

        const head1 = `
            <tr>
                <th style="min-width:240px;">Estudante</th>
                ${colsAtiv.map((a, idx) => `
                    <th style="min-width:170px;">
                        <input
                            type="text"
                            class="nota-atividade-nome"
                            data-idx="${idx}"
                            value="${escapeHtml(a.nome || "")}"
                            placeholder="Nome da atividade"
                            style="width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px;"
                        />
                        <div style="margin-top:6px;">
                            <input
                                type="date"
                                class="nota-atividade-data"
                                data-idx="${idx}"
                                value="${escapeHtml(a.data || "")}"
                                style="width:100%; padding:6px; border:1px solid #e5e7eb; border-radius:8px;"
                            />
                        </div>
                    </th>
                `).join("")}
                <th style="min-width:120px;">Média</th>
            </tr>
        `;
        thead.innerHTML = head1;

        // Corpo
        if (!(estudantesTurma || []).length) {
            tbody.innerHTML = `<tr><td colspan="${(NOTAS_ATIVIDADES?.length || 1) + 2}" style="padding:16px; text-align:center; color:#666;">Sem estudantes para exibir nesta turma.</td></tr>`;
            return;
        }

        const rows = (estudantesTurma || []).map((est) => {
            const eKey = estudanteKeyFrom(est);
            NOTAS_MATRIZ[eKey] = NOTAS_MATRIZ[eKey] || {};
            const notas = colsAtiv.map((a, idx) => {
                const aKey = atividadeKeyFrom(a, idx);
                const v = (NOTAS_MATRIZ[eKey][aKey] ?? "");
                return `
                    <td>
                        <input
                            class="nota-grade"
                            data-estudante-key="${escapeHtml(eKey)}"
                            data-atividade-key="${escapeHtml(aKey)}"
                            type="text"
                            inputmode="decimal"
                            placeholder="0 a 10"
                            value="${escapeHtml(v)}"
                            style="width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px;"
                        />
                    </td>
                `;
            }).join("");

            return `
                <tr>
                    <td>
                        <div style="font-weight:600;">${escapeHtml(est.nome)}</div>
                        <div style="color:#666; font-size:12px;">RA: ${escapeHtml(est.ra || "-")}</div>
                    </td>
                    ${notas}
                    <td><span class="media-estudante" data-estudante-key="${escapeHtml(eKey)}"></span></td>
                </tr>
            `;
        }).join("");

        tbody.innerHTML = rows;

        // eventos
        qsa(".nota-grade").forEach(inp => inp.addEventListener("input", () => {
            const eKey = inp.getAttribute("data-estudante-key");
            const aKey = inp.getAttribute("data-atividade-key");
            NOTAS_MATRIZ[eKey] = NOTAS_MATRIZ[eKey] || {};
            NOTAS_MATRIZ[eKey][aKey] = inp.value;
            atualizarMedias();
        }));

        qsa(".nota-atividade-nome").forEach(inp => inp.addEventListener("input", () => {
            const idx = Number(inp.getAttribute("data-idx"));
            NOTAS_ATIVIDADES[idx].nome = inp.value;
        }));
        qsa(".nota-atividade-data").forEach(inp => inp.addEventListener("change", () => {
            const idx = Number(inp.getAttribute("data-idx"));
            NOTAS_ATIVIDADES[idx].data = inp.value;
        }));

        atualizarMedias();
    }

    function atualizarMedias() {
        const colsAtiv = NOTAS_ATIVIDADES;
        (estudantesTurma || []).forEach(est => {
            const eKey = estudanteKeyFrom(est);
            const vals = colsAtiv.map((a, idx) => {
                const aKey = atividadeKeyFrom(a, idx);
                return NOTAS_MATRIZ?.[eKey]?.[aKey] ?? "";
            });
            const media = mediaFromNotas(vals);
            const el = qs(`.media-estudante[data-estudante-key="${CSS.escape(eKey)}"]`);
            if (el) el.textContent = media || "-";
        });
    }

    window.adicionarColunaAtividade = function() {
        NOTAS_ATIVIDADES = NOTAS_ATIVIDADES || [];
        NOTAS_ATIVIDADES.push({ nome: `Atividade ${NOTAS_ATIVIDADES.length + 1}`, data: "" });
        renderNotasGradebook();
    };

    window.removerUltimaAtividade = function() {
        if (!NOTAS_ATIVIDADES?.length || NOTAS_ATIVIDADES.length <= 1) {
            alert("Mantenha pelo menos 1 atividade.");
            return;
        }
        const removed = NOTAS_ATIVIDADES.pop();
        // limpa notas relacionadas
        const idx = NOTAS_ATIVIDADES.length; // índice removido
        const aKeyPrefix = `${idx}:`;
        Object.keys(NOTAS_MATRIZ || {}).forEach(eKey => {
            Object.keys(NOTAS_MATRIZ[eKey] || {}).forEach(k => {
                if (k.startsWith(aKeyPrefix)) delete NOTAS_MATRIZ[eKey][k];
            });
        });
        renderNotasGradebook();
    };

    async function salvarNotasAtividadeNoSupabase(turmaId, atividadeNome, atividadeData, registros) {
        const supa = window.supabaseClient;
        const profId = await getProfessorId();
        if (!supa || !profId) throw new Error("Sessão/Supabase indisponível.");

        const data = atividadeData || new Date().toISOString().slice(0,10);

        const { data: cab, error: e1 } = await supa
            .from("diario_notas")
            .upsert([{ turma_id: turmaId, professor_id: profId, data, atividade: atividadeNome }], { onConflict: "turma_id,professor_id,data,atividade" })
            .select("id")
            .single();
        if (e1) throw e1;

        const notaId = cab.id;

        const { error: eDel } = await supa.from("diario_nota_itens").delete().eq("nota_id", notaId);
        if (eDel) throw eDel;

        const itens = registros.map(r => ({
            nota_id: notaId,
            estudante_id: (isUuid(String(r.estudante_id||"")) ? r.estudante_id : null),
            estudante_nome: r.estudante_nome || "",
            ra: r.ra || null,
            nota: r.nota === "" ? null : Number(String(r.nota).replace(",", ".")),
            observacao: null
        }));

        const { error: eIns } = await supa.from("diario_nota_itens").insert(itens);
        if (eIns) throw eIns;
    }

    async function carregarNotasGradebookSupabase(turmaId) {
        const supa = window.supabaseClient;
        const profId = await getProfessorId();
        if (!supa || !profId) return { atividades: [], matriz: {} };

        const { data: cab, error } = await supa
            .from("diario_notas")
            .select("id, data, atividade")
            .eq("turma_id", turmaId)
            .eq("professor_id", profId)
            .order("data", { ascending: true });

        if (error || !cab?.length) return { atividades: [], matriz: {} };

        const atividades = cab.map(c => ({ id: c.id, data: c.data, nome: c.atividade }));

        // carregar itens por nota_id
        const matriz = {};
        for (let idx = 0; idx < atividades.length; idx++) {
            const a = atividades[idx];
            const { data: itens, error: e2 } = await supa
                .from("diario_nota_itens")
                .select("estudante_nome, ra, nota")
                .eq("nota_id", a.id);

            if (e2) continue;

            (itens || []).forEach(it => {
                const eKey = it.ra ? `ra:${safeText(it.ra)}` : `nome:${safeText(it.estudante_nome)}`;
                matriz[eKey] = matriz[eKey] || {};
                const aKey = atividadeKeyFrom({ nome: a.nome }, idx);
                matriz[eKey][aKey] = (it.nota ?? "") === null ? "" : String(it.nota);
            });
        }

        return { atividades: atividades.map(a => ({ nome: a.nome, data: a.data })), matriz };
    }

    window.abrirRegistroNotas = async function(turmaId) {
        turmaAtiva = TURMAS_CACHE.find(t => t.id === turmaId);
        if (!turmaAtiva) { alert("Turma não encontrada!"); return; }

        estudantesTurma = await loadEstudantesDaTurma(turmaAtiva.id);

        console.log('[NOTAS] estudantesTurma:', (estudantesTurma||[]).length, estudantesTurma);
        const titulo = qs("#notas-turma-titulo");
        if (titulo) titulo.textContent = turmaAtiva.nome;

        // Carregar do Supabase (se existir)
        try {
            const res = await carregarNotasGradebookSupabase(turmaAtiva.id);
            NOTAS_ATIVIDADES = res.atividades?.length ? res.atividades : [{ nome: "Atividade 1", data: "" }];
            NOTAS_MATRIZ = res.matriz || {};
        } catch {
            NOTAS_ATIVIDADES = [{ nome: "Atividade 1", data: "" }];
            NOTAS_MATRIZ = {};
        }

        // Garantir keys existentes para os estudantes atuais
        (estudantesTurma || []).forEach(est => {
            const eKey = estudanteKeyFrom(est);
            NOTAS_MATRIZ[eKey] = NOTAS_MATRIZ[eKey] || {};
        });

        renderNotasGradebook();
        qs("#modal-notas").style.display = "block";
    };

    window.salvarNotasGradebook = async function() {
        if (!turmaAtiva) { alert("Nenhuma turma selecionada!"); return; }
        const bimestre = qs("#notasBimestre")?.value || "";

        // Atualiza nomes/datas a partir do cabeçalho
        qsa(".nota-atividade-nome").forEach(inp => {
            const idx = Number(inp.getAttribute("data-idx"));
            NOTAS_ATIVIDADES[idx].nome = inp.value;
        });
        qsa(".nota-atividade-data").forEach(inp => {
            const idx = Number(inp.getAttribute("data-idx"));
            NOTAS_ATIVIDADES[idx].data = inp.value;
        });

        // valida
        const atividadesValidas = (NOTAS_ATIVIDADES || []).map(a => ({
            nome: safeText(a.nome),
            data: safeText(a.data)
        })).filter(a => a.nome);

        if (!atividadesValidas.length) { alert("Informe pelo menos 1 atividade."); return; }

        // Monta registros por atividade
        try {
            for (let idx = 0; idx < atividadesValidas.length; idx++) {
                const a = atividadesValidas[idx];
                const aKey = atividadeKeyFrom({ nome: a.nome }, idx);

                const registros = (estudantesTurma || []).map(est => {
                    const eKey = estudanteKeyFrom(est);
                    const nota = NOTAS_MATRIZ?.[eKey]?.[aKey] ?? "";
                    return {
                        estudante_id: est.id || null,
                        estudante_nome: est.nome,
                        ra: est.ra || null,
                        nota
                    };
                });

                await salvarNotasAtividadeNoSupabase(turmaAtiva.id, `${bimestre} - ${a.nome}`.trim(), a.data, registros);
            }

            alert("Notas salvas no Supabase!");
            fecharModal("modal-notas");
            return;
        } catch (e) {
            console.warn("Falha ao salvar notas no Supabase. Salvando localmente.", e?.message || e);
        }

        // fallback localStorage
        const key = `sedsme_gradebook_${turmaAtiva.id}`;
        const payload = {
            turma_id: turmaAtiva.id,
            turma_nome: turmaAtiva.nome,
            bimestre,
            atividades: NOTAS_ATIVIDADES,
            matriz: NOTAS_MATRIZ,
            created_at: new Date().toISOString()
        };
        lsSet(key, payload);
        alert("Notas salvas localmente (Supabase indisponível). Veja o console.");
        fecharModal("modal-notas");
    };

    window.exportarCSVNotasGradebook = async function() {
        if (!turmaAtiva) { alert("Abra uma turma em Notas primeiro."); return; }

        // garantir nomes atualizados
        qsa(".nota-atividade-nome").forEach(inp => {
            const idx = Number(inp.getAttribute("data-idx"));
            NOTAS_ATIVIDADES[idx].nome = inp.value;
        });

        const atividades = (NOTAS_ATIVIDADES || []).map(a => safeText(a.nome)).filter(Boolean);
        if (!atividades.length) { alert("Informe ao menos 1 atividade."); return; }

        const headers = ["estudante_nome","ra", ...atividades, "media"];
        const rows = (estudantesTurma || []).map(est => {
            const eKey = estudanteKeyFrom(est);
            const notas = atividades.map((nome, idx) => {
                const aKey = atividadeKeyFrom({ nome }, idx);
                return (NOTAS_MATRIZ?.[eKey]?.[aKey] ?? "");
            });
            const media = mediaFromNotas(notas);
            return [est.nome || "", est.ra || "", ...notas, media];
        });

        const csv = toCSV(rows, headers);
        downloadCSV(`notas_${(turmaAtiva.nome||"turma").replaceAll(" ","_")}.csv`, csv);
    };

    window.exportarPDFNotasGradebook = async function() {
        if (!turmaAtiva) { alert("Abra uma turma em Notas primeiro."); return; }

        const jsPDF = ensureJsPDF();
        if (!jsPDF) return;

        qsa(".nota-atividade-nome").forEach(inp => {
            const idx = Number(inp.getAttribute("data-idx"));
            NOTAS_ATIVIDADES[idx].nome = inp.value;
        });

        const atividades = (NOTAS_ATIVIDADES || []).map(a => safeText(a.nome)).filter(Boolean);
        if (!atividades.length) { alert("Informe ao menos 1 atividade."); return; }

        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        doc.setFontSize(14);
        doc.text("Registro de Notas", 40, 40);
        doc.setFontSize(11);
        doc.text(`Turma: ${turmaAtiva.nome || ""}`, 40, 60);

        const head = [["Estudante","RA", ...atividades, "Média"]];
        const body = (estudantesTurma || []).map(est => {
            const eKey = estudanteKeyFrom(est);
            const notas = atividades.map((nome, idx) => {
                const aKey = atividadeKeyFrom({ nome }, idx);
                return (NOTAS_MATRIZ?.[eKey]?.[aKey] ?? "");
            });
            const media = mediaFromNotas(notas) || "-";
            return [est.nome || "", est.ra || "", ...notas, media];
        });

        if (doc.autoTable) {
            doc.autoTable({
                head,
                body,
                startY: 80,
                styles: { fontSize: 8 }
            });
        } else {
            doc.setFontSize(9);
            doc.text("autoTable não disponível para PDF.", 40, 90);
        }

        downloadPDF(`notas_${(turmaAtiva.nome||"turma").replaceAll(" ","_")}.pdf`, doc);
    };

})();