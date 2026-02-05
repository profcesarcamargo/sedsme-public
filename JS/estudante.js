// ===== CONFIGURAÇÃO INICIAL =====
const estudanteData = {
    documentos: [
        { id: 1, tipo: "Declaração de Matrícula", data: "10/11/2024", status: "Pendente", retirada: "Aguardando liberação" },
        { id: 2, tipo: "Declaração de Frequência", data: "02/11/2024", status: "Pronto", retirada: "Disponível para retirada" },
        { id: 3, tipo: "Histórico Parcial", data: "05/11/2024", status: "Pronto", retirada: "Retirado em 08/11" }
    ],
    atividades: [
        { id: 1, titulo: "Entrega Tarefa 1", prazo: "12/11/2024", status: "Pendente" },
        { id: 2, titulo: "Projeto História", prazo: "20/11/2024", status: "Em Andamento" },
        { id: 3, titulo: "Exercício Matemática", prazo: "15/11/2024", status: "Concluído" }
    ]
};

// ===== VERIFICAÇÃO DE AUTENTICAÇÃO =====
function verificarAutenticacao() {
    const token = localStorage.getItem('sed_token');
    const user = JSON.parse(localStorage.getItem('sed_user') || '{}');
    
    if (!token || user.perfil !== 'estudante') {
        window.location.href = '/';
        return false;
    }
    return true;
}

// ===== INICIALIZAÇÃO =====
document.addEventListener("DOMContentLoaded", ()=>{
    
    // Verificar autenticação primeiro
    if (!verificarAutenticacao()) return;
    
    // Carregar dados do usuário
    carregarDadosUsuario();
    
    // Atualizar data atual
    atualizarData();
    
    // Carregar dados iniciais
    carregarDadosIniciais();

    // ===== NAVEGAÇÃO DA SIDEBAR =====
    const items = document.querySelectorAll(".est-item");
    const pages = document.querySelectorAll(".page");
    const title = document.getElementById("pageTitle");
    const subtitle = document.getElementById("pageSubtitle");

    items.forEach(btn=>{
        btn.addEventListener("click", ()=>{
            // Remover active de todos
            items.forEach(i=>i.classList.remove("active"));
            btn.classList.add("active");

            // Mostrar a page correspondente
            const pageId = btn.getAttribute("data-page") || btn.getAttribute("onclick")?.replace("navegar('", "").replace("')", "");
            
            pages.forEach(pg=>{
                if(pg.id === pageId || pg.id === pageId + '-content'){ 
                    pg.classList.add("page-active"); 
                    atualizarTituloPagina(pageId, title, subtitle);
                }
                else pg.classList.remove("page-active");
            });
        });
    });

    // ===== AÇÕES PRINCIPAIS =====
    document.getElementById("btnSair").addEventListener("click", sair);

    document.getElementById("novaSolic").addEventListener("click", ()=>{
        // Simular nova solicitação
        const novoId = estudanteData.documentos.length + 1;
        estudanteData.documentos.unshift({
            id: novoId,
            tipo: "Declaração Escolar",
            data: new Date().toLocaleDateString('pt-BR'),
            status: "Pendente",
            retirada: "Aguardando liberação"
        });
        
        alert("Solicitação enviada! Aguarde a liberação para retirada na secretaria.");
        carregarDocumentos();
        atualizarBadges();
    });

    document.getElementById("novaAtiv").addEventListener("click", ()=>{
        alert("Sistema de anotações pessoais em desenvolvimento...");
    });

    // ===== CARREGAR CONTEÚDO INICIAL =====
    carregarDocumentos();
    carregarAtividades();
    atualizarBadges();
});

// ===== FUNÇÕES DE CARREGAMENTO =====
function carregarDadosUsuario() {
    const user = JSON.parse(localStorage.getItem('sed_user') || '{}');
    
    // Atualizar informações do usuário na sidebar
    const userName = document.getElementById('userName');
    const userTurma = document.getElementById('userTurma');
    const userMatricula = document.getElementById('userMatricula');
    const schoolInfo = document.getElementById('schoolInfo');
    
    if (userName) userName.textContent = user.nome || 'Estudante';
    if (userTurma) userTurma.textContent = `Turma: ${user.turma || '--'}`;
    if (userMatricula) userMatricula.textContent = `Matrícula: ${user.matricula || '--'}`;
    if (schoolInfo) schoolInfo.textContent = user.escola || 'EMEF Santa Branca';
    
    // Gerar avatar com iniciais
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar && user.nome) {
        const iniciais = user.nome.split(' ').map(n => n[0]).join('').toUpperCase();
        userAvatar.textContent = iniciais.substring(0, 2);
    }
}

function atualizarData() {
    const currentDate = document.getElementById('currentDate');
    if (currentDate) {
        currentDate.textContent = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

function carregarDadosIniciais() {
    // Atualizar cards do dashboard
    const pendentes = document.getElementById('pendentes');
    const boletins = document.getElementById('boletins');
    const atividadesNum = document.getElementById('atividadesNum');
    
    if (pendentes) pendentes.textContent = estudanteData.documentos.filter(d => d.status === "Pendente").length;
    if (boletins) boletins.textContent = "1"; // Sempre tem pelo menos um boletim
    if (atividadesNum) atividadesNum.textContent = estudanteData.atividades.filter(a => a.status !== "Concluído").length;
}

function carregarDocumentos() {
    const docsTable = document.getElementById('docsTable');
    if (!docsTable) return;
    
    docsTable.innerHTML = estudanteData.documentos.map(doc => `
        <tr>
            <td>${doc.id.toString().padStart(3, '0')}</td>
            <td>${doc.tipo}</td>
            <td>${doc.data}</td>
            <td>
                <span class="status-badge ${doc.status === 'Pendente' ? 'pending' : 'completed'}">
                    ${doc.status}
                </span>
            </td>
            <td>
                <span class="retirada-status ${doc.retirada.includes('Disponível') ? 'available' : doc.retirada.includes('Retirado') ? 'collected' : ''}">
                    ${doc.retirada}
                </span>
            </td>
        </tr>
    `).join('');
}

function carregarAtividades() {
    const listaAtividades = document.getElementById('listaAtividades');
    if (!listaAtividades) return;
    
    listaAtividades.innerHTML = estudanteData.atividades.map(atividade => `
        <li>
            <strong>${atividade.titulo}</strong> 
            — Prazo ${atividade.prazo} 
            <span class="activity-status ${atividade.status === 'Pendente' ? 'urgent' : atividade.status === 'Em Andamento' ? 'warning' : 'normal'}">
                ${atividade.status}
            </span>
            <button class="btn-sm" onclick="detalhesAtividade(${atividade.id})">Abrir</button>
        </li>
    `).join('');
}

// ===== FUNÇÕES AUXILIARES =====
function atualizarTituloPagina(pagina, titleElement, subtitleElement) {
    const titulos = {
        'documentos': 'Solicitação de Documentos',
        'boletim': 'Boletim Escolar', 
        'atividades': 'Atividades',
        'dashboard': 'Dashboard do Estudante'
    };
    
    const subtitulos = {
        'documentos': 'Solicite documentos escolares. Retirada pessoal na secretaria.',
        'boletim': 'Acompanhe suas notas e desempenho acadêmico.',
        'atividades': 'Gerencie suas atividades, trabalhos e prazos importantes.',
        'dashboard': 'Bem-vindo(a)! Acompanhe suas atividades e desempenho escolar.'
    };
    
    if (titleElement) titleElement.innerText = titulos[pagina] || 'Portal do Estudante';
    if (subtitleElement) subtitleElement.innerText = subtitulos[pagina] || '';
}

function atualizarBadges() {
    const docsPendentes = estudanteData.documentos.filter(d => d.status === "Pendente").length;
    const atividadesPendentes = estudanteData.atividades.filter(a => a.status !== "Concluído").length;
    
    // Atualizar badges no menu (se existirem)
    const badgeDocs = document.getElementById('badgeDocs');
    const badgeAtividades = document.getElementById('badgeAtividades');
    
    if (badgeDocs) badgeDocs.textContent = docsPendentes;
    if (badgeAtividades) badgeAtividades.textContent = atividadesPendentes;
}

function detalhesAtividade(id) {
    const atividade = estudanteData.atividades.find(a => a.id === id);
    if (atividade) {
        alert(`📚 ${atividade.titulo}\n\n📅 Prazo: ${atividade.prazo}\n📊 Status: ${atividade.status}\n\nDescrição completa em desenvolvimento...`);
    }
}

// ===== LOGOUT SEGURO =====
function sair() {
    if (confirm('Deseja realmente sair do sistema?')) {
        localStorage.removeItem('sed_token');
        localStorage.removeItem('sed_user');
        window.location.href = '/';
    }
}

// ===== FUNÇÕES DE NAVEGAÇÃO (para onclick no HTML) =====
function navegar(pagina) {
    const items = document.querySelectorAll(".est-item");
    const pages = document.querySelectorAll(".page");
    const title = document.getElementById("pageTitle");
    const subtitle = document.getElementById("pageSubtitle");

    // Remover active de todos
    items.forEach(i => i.classList.remove("active"));
    
    // Adicionar active ao item correspondente (simulação de clique)
    const activeItem = Array.from(items).find(item => 
        item.getAttribute('onclick')?.includes(`navegar('${pagina}')`)
    );
    if (activeItem) activeItem.classList.add("active");

    // Mostrar página correspondente
    pages.forEach(pg => {
        if (pg.id === pagina + '-content') { 
            pg.classList.add("page-active"); 
            atualizarTituloPagina(pagina, title, subtitle);
        }
        else pg.classList.remove("page-active");
    });
}