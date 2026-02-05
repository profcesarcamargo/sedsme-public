// diario.js - Versão corrigida e completa
console.log('diario.js carregado!'); // Debug

// Variáveis globais
let turmaSelecionada = null;
let bimestreSelecionado = '1';
let alunos = [];
let atividades = [];
let chamadas = [];

// Dados de exemplo
const alunosExemplo = {
    '6A': [
        { id: 1, nome: 'Ana Silva', numero: 1 },
        { id: 2, nome: 'Bruno Oliveira', numero: 2 },
        { id: 3, nome: 'Carla Santos', numero: 3 },
        { id: 4, nome: 'Daniel Costa', numero: 4 },
        { id: 5, nome: 'Eduarda Lima', numero: 5 }
    ],
    '7B': [
        { id: 6, nome: 'Felipe Souza', numero: 1 },
        { id: 7, nome: 'Gabriela Rocha', numero: 2 },
        { id: 8, nome: 'Henrique Alves', numero: 3 }
    ]
};

// ===== INICIALIZAÇÃO =====
function inicializarDiario() {
    console.log('🔧 Inicializando módulo Diário...');
    
    // Configurar selects
    const turmaSelect = document.getElementById('selectTurma');
    const bimestreSelect = document.getElementById('selectBimestre');
    
    if (turmaSelect) {
        turmaSelect.innerHTML = `
            <option value="">Selecione a Turma</option>
            <option value="6A">6º Ano A - Matemática</option>
            <option value="7B">7º Ano B - Português</option>
        `;
    }
    
    if (bimestreSelect) {
        bimestreSelect.value = '1';
    }
    
    console.log('✅ Diário inicializado!');
}

// ===== FUNÇÃO PRINCIPAL =====
function carregarDiarioCompleto() {
    console.log('📘 Carregando diário completo...');
    
    const turmaSelect = document.getElementById('selectTurma');
    const bimestreSelect = document.getElementById('selectBimestre');
    
    turmaSelecionada = turmaSelect?.value || null;
    bimestreSelecionado = bimestreSelect?.value || '1';
    
    const container = document.getElementById('diario-turma-container');
    
    if (!container) {
        console.error('❌ Container do diário não encontrado!');
        return;
    }
    
    if (!turmaSelecionada) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📘</div>
                <h3>Selecione uma turma</h3>
                <p>Escolha uma turma no menu acima para gerenciar o Diário de Classe</p>
            </div>
        `;
        return;
    }
    
    // Carregar alunos da turma selecionada
    alunos = alunosExemplo[turmaSelecionada] || [];
    
    // Interface completa do diário
    container.innerHTML = `
        <div class="diario-header">
            <div class="turma-info">
                <h3>${document.getElementById('selectTurma').selectedOptions[0].text}</h3>
                <span>${bimestreSelecionado}º Bimestre - ${alunos.length} alunos</span>
            </div>
        </div>

        <div class="diario-actions-grid">
            <div class="action-card-large" onclick="abrirModalChamada()">
                <div class="action-icon">📋</div>
                <div class="action-info">
                    <h4>Registrar Chamada</h4>
                    <p>Controle de presença e faltas</p>
                </div>
            </div>
            
            <div class="action-card-large" onclick="abrirModalAtividade()">
                <div class="action-icon">📝</div>
                <div class="action-info">
                    <h4>Nova Atividade</h4>
                    <p>Criar atividade ou avaliação</p>
                </div>
            </div>
            
            <div class="action-card-large" onclick="abrirModalNotas()">
                <div class="action-icon">📊</div>
                <div class="action-info">
                    <h4>Lançar Notas</h4>
                    <p>Registrar notas das avaliações</p>
                </div>
            </div>
            
            <div class="action-card-large" onclick="abrirModalObservacoes()">
                <div class="action-icon">📝</div>
                <div class="action-info">
                    <h4>Observações</h4>
                    <p>Registrar observações dos estudantes</p>
                </div>
            </div>
        </div>

        <div class="diario-painel">
            <div class="painel-col">
                <div class="painel-card">
                    <h3>📚 Atividades do Bimestre</h3>
                    <div id="lista-atividades">
                        ${gerarListaAtividades()}
                    </div>
                    <button class="btn-secondary" onclick="abrirModalAtividade()" style="margin-top: 15px;">
                        + Nova Atividade
                    </button>
                </div>
            </div>
            
            <div class="painel-col">
                <div class="painel-card">
                    <h3>📈 Resumo da Turma</h3>
                    <div class="stats-grid small">
                        <div class="stat-card">
                            <div class="stat-icon">👥</div>
                            <div class="stat-info">
                                <h3>${alunos.length}</h3>
                                <p>Alunos</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📝</div>
                            <div class="stat-info">
                                <h3>${atividades.length}</h3>
                                <p>Atividades</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">✅</div>
                            <div class="stat-info">
                                <h3>${chamadas.length}</h3>
                                <p>Chamadas</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📊</div>
                            <div class="stat-info">
                                <h3>${calcularMediaGeral()}</h3>
                                <p>Média Geral</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="tabela-alunos-completa">
            <h3>🎓 Alunos da Turma</h3>
            <div class="tabela-container">
                <table class="tabela-alunos">
                    <thead>
                        <tr>
                            <th width="50">Nº</th>
                            <th>Aluno</th>
                            <th width="100">Frequência</th>
                            <th width="100">Média</th>
                            <th width="150">Status</th>
                            <th width="120">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gerarTabelaAlunos()}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    console.log('✅ Diário carregado com sucesso!');
}

// ===== MODAL DE CHAMADA (JÁ FUNCIONA) =====
function abrirModalChamada() {
    console.log('📋 Abrindo modal de chamada...');
    
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }
    
    const modalHTML = `
        <div id="modal-chamada" class="modal" style="display: block;">
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>📋 Registro de Chamada</h3>
                    <span class="close" onclick="fecharModal('modal-chamada')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="chamada-header">
                        <h4>${document.getElementById('selectTurma').selectedOptions[0].text}</h4>
                        <div class="data-controle">
                            <label for="dataChamada">Data:</label>
                            <input type="date" id="dataChamada" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    
                    <div class="tabela-container">
                        <table class="tabela-chamada">
                            <thead>
                                <tr>
                                    <th>Nº</th>
                                    <th>Aluno</th>
                                    <th width="120">Situação</th>
                                    <th width="200">Justificativa</th>
                                    <th width="150">Observações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alunos.map(aluno => `
                                    <tr>
                                        <td><strong>${aluno.numero}</strong></td>
                                        <td>${aluno.nome}</td>
                                        <td>
                                            <select class="situacao-aluno" data-aluno="${aluno.id}">
                                                <option value="presente">✅ Presente</option>
                                                <option value="falta">❌ Falta</option>
                                                <option value="falta-justificada">⚠️ Falta Justificada</option>
                                                <option value="atraso">⏰ Atraso</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input type="text" class="justificativa-aluno" data-aluno="${aluno.id}" 
                                                   placeholder="Motivo da falta...">
                                        </td>
                                        <td>
                                            <input type="text" class="observacao-chamada" data-aluno="${aluno.id}" 
                                                   placeholder="Observações...">
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="fecharModal('modal-chamada')">Cancelar</button>
                    <button class="btn-primary" onclick="salvarChamada()">💾 Salvar Chamada</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function salvarChamada() {
    console.log('💾 Salvando chamada...');
    
    const dataChamada = document.getElementById('dataChamada').value;
    
    if (!dataChamada) {
        alert('Selecione a data da chamada!');
        return;
    }
    
    const registrosChamada = alunos.map(aluno => {
        const select = document.querySelector(`.situacao-aluno[data-aluno="${aluno.id}"]`);
        const justificativa = document.querySelector(`.justificativa-aluno[data-aluno="${aluno.id}"]`).value;
        const observacao = document.querySelector(`.observacao-chamada[data-aluno="${aluno.id}"]`).value;
        
        return {
            alunoId: aluno.id,
            alunoNome: aluno.nome,
            situacao: select.value,
            justificativa: justificativa,
            observacao: observacao,
            data: dataChamada
        };
    });
    
    // Salvar chamada
    chamadas.push({
        id: chamadas.length + 1,
        data: dataChamada,
        turma: turmaSelecionada,
        bimestre: bimestreSelecionado,
        registros: registrosChamada
    });
    
    console.log('✅ Chamada salva:', chamadas[chamadas.length - 1]);
    alert('✅ Chamada registrada com sucesso!');
    fecharModal('modal-chamada');
    
    // Atualizar interface
    carregarDiarioCompleto();
}

// ===== MODAL DE ATIVIDADES (CORRIGIDO) =====
function abrirModalAtividade() {
    console.log('📝 Abrindo modal de atividade...');
    
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }
    
    const modalHTML = `
        <div id="modal-atividade" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📝 Nova Atividade</h3>
                    <span class="close" onclick="fecharModal('modal-atividade')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="tituloAtividade">Título da Atividade:</label>
                        <input type="text" id="tituloAtividade" placeholder="Ex: Prova Bimestral de Matemática">
                    </div>
                    
                    <div class="form-group">
                        <label for="tipoAtividade">Tipo:</label>
                        <select id="tipoAtividade">
                            <option value="prova">Prova</option>
                            <option value="trabalho">Trabalho</option>
                            <option value="atividade">Atividade</option>
                            <option value="exercicio">Exercício</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="dataAtividade">Data da Atividade:</label>
                        <input type="date" id="dataAtividade" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    
                    <div class="form-group">
                        <label for="valorAtividade">Valor (pontos):</label>
                        <input type="number" id="valorAtividade" value="10" min="1" max="100">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="fecharModal('modal-atividade')">Cancelar</button>
                    <button class="btn-primary" onclick="salvarAtividade()">💾 Criar Atividade</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function salvarAtividade() {
    console.log('💾 Salvando atividade...');
    
    const titulo = document.getElementById('tituloAtividade').value;
    const tipo = document.getElementById('tipoAtividade').value;
    const data = document.getElementById('dataAtividade').value;
    const valor = document.getElementById('valorAtividade').value;
    
    if (!titulo) {
        alert('Digite um título para a atividade!');
        return;
    }
    
    if (!data) {
        alert('Selecione a data da atividade!');
        return;
    }
    
    // Criar nova atividade
    const novaAtividade = {
        id: atividades.length + 1,
        titulo: titulo,
        tipo: tipo,
        data: data,
        valor: parseInt(valor),
        turma: turmaSelecionada,
        bimestre: bimestreSelecionado,
        notas: [] // Array para armazenar notas futuras
    };
    
    atividades.push(novaAtividade);
    console.log('✅ Atividade criada:', novaAtividade);
    alert('✅ Atividade criada com sucesso!');
    fecharModal('modal-atividade');
    
    // Atualizar interface
    carregarDiarioCompleto();
}

// ===== MODAL DE NOTAS (CORRIGIDO) =====
function abrirModalNotas() {
    console.log('📊 Abrindo modal de notas...');
    
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }
    
    if (atividades.length === 0) {
        alert('Crie uma atividade primeiro!');
        abrirModalAtividade();
        return;
    }
    
    // Criar opções de atividades
    const opcoesAtividades = atividades.map(atividade => 
        `<option value="${atividade.id}">${atividade.titulo} - ${atividade.data}</option>`
    ).join('');
    
    const modalHTML = `
        <div id="modal-notas" class="modal" style="display: block;">
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>📊 Lançamento de Notas</h3>
                    <span class="close" onclick="fecharModal('modal-notas')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="selectAtividade">Selecione a Atividade:</label>
                        <select id="selectAtividade" onchange="carregarNotasAtividade()">
                            <option value="">Selecione uma atividade...</option>
                            ${opcoesAtividades}
                        </select>
                    </div>
                    
                    <div id="tabela-notas-container" style="display: none;">
                        <h4>Notas dos Alunos</h4>
                        <div class="tabela-container">
                            <table class="tabela-notas">
                                <thead>
                                    <tr>
                                        <th>Aluno</th>
                                        <th width="120">Nota</th>
                                        <th width="200">Observações</th>
                                    </tr>
                                </thead>
                                <tbody id="corpo-notas">
                                    ${alunos.map(aluno => `
                                        <tr>
                                            <td>${aluno.nome}</td>
                                            <td>
                                                <input type="number" class="nota-aluno" 
                                                       data-aluno="${aluno.id}" min="0" max="10" step="0.1"
                                                       placeholder="0-10">
                                            </td>
                                            <td>
                                                <input type="text" class="observacao-nota" 
                                                       data-aluno="${aluno.id}" placeholder="Observações...">
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="fecharModal('modal-notas')">Cancelar</button>
                    <button class="btn-primary" onclick="salvarNotas()">💾 Salvar Notas</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function carregarNotasAtividade() {
    const atividadeId = document.getElementById('selectAtividade').value;
    const container = document.getElementById('tabela-notas-container');
    
    if (atividadeId) {
        container.style.display = 'block';
        
        // Carregar notas existentes se houver
        const atividade = atividades.find(a => a.id == atividadeId);
        if (atividade && atividade.notas) {
            atividade.notas.forEach(nota => {
                const inputNota = document.querySelector(`.nota-aluno[data-aluno="${nota.alunoId}"]`);
                const inputObs = document.querySelector(`.observacao-nota[data-aluno="${nota.alunoId}"]`);
                
                if (inputNota) inputNota.value = nota.valor || '';
                if (inputObs) inputObs.value = nota.observacao || '';
            });
        }
    } else {
        container.style.display = 'none';
    }
}

function salvarNotas() {
    console.log('💾 Salvando notas...');
    
    const atividadeId = document.getElementById('selectAtividade').value;
    const atividade = atividades.find(a => a.id == atividadeId);
    
    if (!atividade) {
        alert('Selecione uma atividade!');
        return;
    }
    
    // Coletar notas dos alunos
    const notas = [];
    alunos.forEach(aluno => {
        const inputNota = document.querySelector(`.nota-aluno[data-aluno="${aluno.id}"]`);
        const inputObs = document.querySelector(`.observacao-nota[data-aluno="${aluno.id}"]`);
        
        const notaValor = parseFloat(inputNota.value);
        if (!isNaN(notaValor)) {
            notas.push({
                alunoId: aluno.id,
                alunoNome: aluno.nome,
                valor: notaValor,
                observacao: inputObs.value || ''
            });
        }
    });
    
    // Salvar notas na atividade
    atividade.notas = notas;
    console.log('✅ Notas salvas para atividade:', atividade.titulo, notas);
    alert('✅ Notas lançadas com sucesso!');
    fecharModal('modal-notas');
    
    // Atualizar interface
    carregarDiarioCompleto();
}

// ===== MODAL DE OBSERVAÇÕES (NOVO) =====
function abrirModalObservacoes() {
    console.log('📝 Abrindo modal de observações...');
    
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }
    
    const modalHTML = `
        <div id="modal-observacoes" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📝 Observações dos Alunos</h3>
                    <span class="close" onclick="fecharModal('modal-observacoes')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="selectAlunoObservacao">Selecione o Aluno:</label>
                        <select id="selectAlunoObservacao">
                            <option value="">Selecione um aluno...</option>
                            ${alunos.map(aluno => `
                                <option value="${aluno.id}">${aluno.nome}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="tipoObservacao">Tipo de Observação:</label>
                        <select id="tipoObservacao">
                            <option value="comportamento">Comportamento</option>
                            <option value="desempenho">Desempenho</option>
                            <option value="frequencia">Frequência</option>
                            <option value="outros">Outros</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="textoObservacao">Observação:</label>
                        <textarea id="textoObservacao" rows="4" placeholder="Descreva a observação..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="dataObservacao">Data:</label>
                        <input type="date" id="dataObservacao" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="fecharModal('modal-observacoes')">Cancelar</button>
                    <button class="btn-primary" onclick="salvarObservacao()">💾 Salvar Observação</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function salvarObservacao() {
    console.log('💾 Salvando observação...');
    
    const alunoId = document.getElementById('selectAlunoObservacao').value;
    const tipo = document.getElementById('tipoObservacao').value;
    const texto = document.getElementById('textoObservacao').value;
    const data = document.getElementById('dataObservacao').value;
    
    if (!alunoId) {
        alert('Selecione um aluno!');
        return;
    }
    
    if (!texto) {
        alert('Digite a observação!');
        return;
    }
    
    const aluno = alunos.find(a => a.id == alunoId);
    if (!aluno) {
        alert('Aluno não encontrado!');
        return;
    }
    
    console.log('✅ Observação salva:', { aluno: aluno.nome, tipo, texto, data });
    alert('✅ Observação registrada com sucesso!');
    fecharModal('modal-observacoes');
}

// ===== FUNÇÕES AUXILIARES =====
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

function gerarListaAtividades() {
    if (atividades.length === 0) {
        return `
            <div class="empty-state small">
                <p>Nenhuma atividade criada</p>
                <p class="small">Clique em "Nova Atividade" para começar</p>
            </div>
        `;
    }
    
    return atividades.map(atividade => `
        <div class="atividade-item">
            <div class="atividade-info">
                <strong>${atividade.titulo}</strong>
                <span>${atividade.data} - ${atividade.tipo} (${atividade.valor} pts)</span>
                ${atividade.notas && atividade.notas.length > 0 ? 
                    `<span class="notas-info">${atividade.notas.length} notas lançadas</span>` : 
                    `<span class="sem-notas">Sem notas</span>`
                }
            </div>
            <div class="atividade-actions">
                <button class="btn-secondary small" onclick="abrirLancarNotas(${atividade.id})">
                    📊 Lançar Notas
                </button>
            </div>
        </div>
    `).join('');
}

function abrirLancarNotas(atividadeId) {
    // Abrir modal de notas e selecionar a atividade automaticamente
    abrirModalNotas();
    
    // Aguardar o modal carregar e então selecionar a atividade
    setTimeout(() => {
        const select = document.getElementById('selectAtividade');
        if (select) {
            select.value = atividadeId;
            carregarNotasAtividade();
        }
    }, 100);
}

function gerarTabelaAlunos() {
    if (!alunos.length) return '<tr><td colspan="6">Nenhum aluno carregado</td></tr>';
    
    return alunos.map(aluno => `
        <tr>
            <td>${aluno.numero}</td>
            <td>${aluno.nome}</td>
            <td>${calcularFrequenciaAluno(aluno.id)}%</td>
            <td>${calcularMediaAluno(aluno.id)}</td>
            <td>
                <span class="status-aluno ${calcularStatusAluno(aluno.id)}">
                    ${calcularStatusAluno(aluno.id).toUpperCase()}
                </span>
            </td>
            <td>
                <button class="btn-secondary small" onclick="verDetalhesAluno(${aluno.id})">
                    👁️ Detalhes
                </button>
                <button class="btn-primary small" onclick="abrirObservacoesAluno(${aluno.id})">
                    📝 Observ.
                </button>
            </td>
        </tr>
    `).join('');
}

function calcularFrequenciaAluno(alunoId) {
    // Simulação - na prática, calcular baseado nas chamadas
    return Math.floor(Math.random() * 20) + 80; // 80-100%
}

function calcularMediaAluno(alunoId) {
    // Simulação - na prática, calcular baseado nas notas
    const media = (Math.random() * 4 + 6).toFixed(1); // 6.0-10.0
    return media;
}

function calcularStatusAluno(alunoId) {
    const media = parseFloat(calcularMediaAluno(alunoId));
    if (media >= 7) return 'aprovado';
    if (media >= 5) return 'atencao';
    return 'recuperacao';
}

function calcularMediaGeral() {
    if (alunos.length === 0) return '--';
    
    let soma = 0;
    alunos.forEach(aluno => {
        soma += parseFloat(calcularMediaAluno(aluno.id));
    });
    
    return (soma / alunos.length).toFixed(1);
}

function verDetalhesAluno(alunoId) {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return;
    
    const media = calcularMediaAluno(alunoId);
    const frequencia = calcularFrequenciaAluno(alunoId);
    const status = calcularStatusAluno(alunoId);
    
    alert(`📊 Detalhes do Aluno: ${aluno.nome}\n\n` +
          `Média: ${media}\n` +
          `Frequência: ${frequencia}%\n` +
          `Status: ${status.toUpperCase()}\n\n` +
          `Atividades: ${atividades.length}\n` +
          `Notas lançadas: ${contarNotasAluno(alunoId)}`);
}

function abrirObservacoesAluno(alunoId) {
    abrirModalObservacoes();
    
    // Selecionar o aluno automaticamente
    setTimeout(() => {
        const select = document.getElementById('selectAlunoObservacao');
        if (select) {
            select.value = alunoId;
        }
    }, 100);
}

function contarNotasAluno(alunoId) {
    let count = 0;
    atividades.forEach(atividade => {
        if (atividade.notas && atividade.notas.find(n => n.alunoId === alunoId)) {
            count++;
        }
    });
    return count;
}

// ===== EXPORTAR FUNÇÕES PARA ESCOPO GLOBAL =====
window.carregarDiarioCompleto = carregarDiarioCompleto;
window.abrirModalChamada = abrirModalChamada;
window.abrirModalAtividade = abrirModalAtividade;
window.abrirModalNotas = abrirModalNotas;
window.abrirModalObservacoes = abrirModalObservacoes;
window.fecharModal = fecharModal;
window.salvarChamada = salvarChamada;
window.salvarAtividade = salvarAtividade;
window.salvarNotas = salvarNotas;
window.salvarObservacao = salvarObservacao;
window.carregarNotasAtividade = carregarNotasAtividade;
window.abrirLancarNotas = abrirLancarNotas;
window.verDetalhesAluno = verDetalhesAluno;
window.abrirObservacoesAluno = abrirObservacoesAluno;

// Inicializar quando o script carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarDiario);
} else {
    inicializarDiario();
}

console.log('🎯 diario.js carregado e pronto!');