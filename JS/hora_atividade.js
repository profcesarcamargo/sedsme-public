// Sistema de Abas
function abrirAba(aba) {
    // Remove active de todas as abas
    document.querySelectorAll('.ha-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.ha-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Adiciona active na aba clicada
    document.querySelector(`.ha-tab[onclick="abrirAba('${aba}')"]`).classList.add('active');
    document.getElementById(`aba-${aba}`).classList.add('active');
}

// Funções do Modal
function abrirModalAtividade() {
    document.getElementById('modalAtividade').classList.add('active');
    document.getElementById('atividadeData').value = new Date().toISOString().split('T')[0];
}

function fecharModalAtividade() {
    document.getElementById('modalAtividade').classList.remove('active');
    document.getElementById('formAtividade').reset();
}

function salvarAtividade() {
    const form = document.getElementById('formAtividade');
    
    if (!form.checkValidity()) {
        alert('Preencha todos os campos obrigatórios!');
        return;
    }
    
    const atividade = {
        tipo: document.getElementById('atividadeTipo').value,
        data: document.getElementById('atividadeData').value,
        descricao: document.getElementById('atividadeDescricao').value,
        observacoes: document.getElementById('atividadeObservacoes').value,
        dataRegistro: new Date().toISOString()
    };
    
    // Salvar no localStorage (exemplo)
    let atividades = JSON.parse(localStorage.getItem('atividadesHA')) || [];
    atividades.push(atividade);
    localStorage.setItem('atividadesHA', JSON.stringify(atividades));
    
    console.log('Atividade salva:', atividade);
    alert('Atividade registrada com sucesso! ✅');
    fecharModalAtividade();
    
    // Atualizar a lista de atividades
    carregarAtividades();
}

function carregarAtividades() {
    const atividades = JSON.parse(localStorage.getItem('atividadesHA')) || [];
    const listaAtividades = document.getElementById('lista-atividades');
    
    if (atividades.length === 0) {
        listaAtividades.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h4>Nenhuma atividade registrada</h4>
                <p>Clique em "Nova Atividade" para registrar sua primeira atividade do H.A</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    atividades.forEach((atividade, index) => {
        const tipoClass = getTipoClass(atividade.tipo);
        const tipoTexto = getTipoTexto(atividade.tipo);
        
        html += `
            <div class="atividade-card ${atividade.tipo}">
                <div class="atividade-header">
                    <div class="atividade-info">
                        <h4>${atividade.descricao.substring(0, 60)}${atividade.descricao.length > 60 ? '...' : ''}</h4>
                        <div class="atividade-meta">
                            <div class="meta-item">
                                <span>📅</span>
                                ${formatarData(atividade.data)}
                            </div>
                            <div class="meta-item">
                                <span>⏰</span>
                                ${formatarDataHora(atividade.dataRegistro)}
                            </div>
                        </div>
                    </div>
                    <span class="atividade-tipo ${tipoClass}">${tipoTexto}</span>
                </div>
                <div class="atividade-descricao">
                    ${atividade.descricao}
                </div>
                ${atividade.observacoes ? `
                <div class="atividade-descricao" style="font-style: italic; color: #888;">
                    <strong>Observações:</strong> ${atividade.observacoes}
                </div>
                ` : ''}
                <div class="atividade-footer">
                    <div class="atividade-actions">
                        <button class="btn-icon-small" onclick="editarAtividade(${index})" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon-small" onclick="excluirAtividade(${index})" title="Excluir">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    listaAtividades.innerHTML = html;
    atualizarResumo(atividades);
}

function atualizarResumo(atividades) {
    const totalAtividades = atividades.length;
    const totalPlanejamentos = atividades.filter(a => a.tipo === 'planejamento').length;
    const totalCorrecoes = atividades.filter(a => a.tipo === 'correcao').length;
    const totalReunioes = atividades.filter(a => a.tipo === 'reuniao').length;
    
    document.getElementById('totalAtividades').textContent = totalAtividades;
    document.getElementById('totalPlanejamentos').textContent = totalPlanejamentos;
    document.getElementById('totalCorrecoes').textContent = totalCorrecoes;
    document.getElementById('totalReunioes').textContent = totalReunioes;
}

function getTipoClass(tipo) {
    const classes = {
        'planejamento': 'tipo-planejamento',
        'correcao': 'tipo-correcao',
        'reuniao': 'tipo-reuniao',
        'formacao': 'tipo-reuniao',
        'avaliacao': 'tipo-planejamento',
        'material': 'tipo-correcao'
    };
    return classes[tipo] || 'tipo-planejamento';
}

function getTipoTexto(tipo) {
    const textos = {
        'planejamento': 'Planejamento',
        'correcao': 'Correção',
        'reuniao': 'Reunião',
        'formacao': 'Formação',
        'avaliacao': 'Avaliação',
        'material': 'Material'
    };
    return textos[tipo] || 'Outro';
}

function formatarData(dataString) {
    const data = new Date(dataString + 'T00:00:00');
    return data.toLocaleDateString('pt-BR');
}

function formatarDataHora(dataString) {
    const data = new Date(dataString);
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function editarAtividade(index) {
    alert(`Editar atividade ${index + 1} - Funcionalidade em desenvolvimento`);
}

function excluirAtividade(index) {
    if (confirm('Tem certeza que deseja excluir esta atividade?')) {
        let atividades = JSON.parse(localStorage.getItem('atividadesHA')) || [];
        atividades.splice(index, 1);
        localStorage.setItem('atividadesHA', JSON.stringify(atividades));
        carregarAtividades();
        alert('Atividade excluída com sucesso!');
    }
}

function irParaPlanejamento() {
    window.location.href = 'planejamento_aulas.html';
}

// Fechar modal ao clicar fora
document.addEventListener('click', function(event) {
    const modal = document.getElementById('modalAtividade');
    if (event.target === modal) {
        fecharModalAtividade();
    }
});

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    carregarAtividades();
    
    // Menu ativo
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
});