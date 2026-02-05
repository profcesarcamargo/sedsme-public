class DirecaoPedagogica {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardData();
        this.setupMenuNavigation();
    }

    setupEventListeners() {
        // Menu toggle para mobile
        document.querySelector('.menu-toggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });

        // Logout
        document.querySelector('.logout').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    }

    setupMenuNavigation() {
        const menuItems = document.querySelectorAll('.menu-item:not(.logout)');
        
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        // Remove active class from all pages and menu items
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

        // Add active class to current page and menu item
        document.getElementById(`${page}-page`).classList.add('active');
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // Update page title
        this.updatePageTitle(page);

        // Load page specific data
        this.loadPageData(page);
    }

    updatePageTitle(page) {
        const titles = {
            'dashboard': 'Dashboard Pedagógico',
            'diario': 'Diário de Classe',
            'lista-piloto': 'Lista Piloto',
            'mural': 'Mural de Avisos',
            'controle-ha': 'Controle de H.A',
            'planos-ensino': 'Planos de Ensino'
        };

        document.getElementById('page-title').textContent = titles[page];
    }

    async loadDashboardData() {
        try {
            // Simulando dados do dashboard pedagógico
            const response = await fetch('/api/direcao-pedagogica/dashboard');
            const data = await response.json();

            // Atualizar estatísticas
            document.getElementById('total-teachers').textContent = data.totalTeachers || '45';
            document.getElementById('submitted-plans').textContent = data.submittedPlans || '38';
            document.getElementById('approved-plans').textContent = data.approvedPlans || '25';
            document.getElementById('pending-ha').textContent = data.pendingHA || '12';

            // Acompanhamento pedagógico
            document.getElementById('plans-under-review').textContent = data.plansUnderReview || '8';
            document.getElementById('diaries-with-issues').textContent = data.diariesWithIssues || '3';

            // Próximas ações
            this.loadNextActions(data.nextActions);

        } catch (error) {
            console.error('Erro ao carregar dados do dashboard:', error);
            this.loadDefaultData();
        }
    }

    loadDefaultData() {
        // Valores padrão em caso de erro
        document.getElementById('total-teachers').textContent = '45';
        document.getElementById('submitted-plans').textContent = '38';
        document.getElementById('approved-plans').textContent = '25';
        document.getElementById('pending-ha').textContent = '12';
        document.getElementById('plans-under-review').textContent = '8';
        document.getElementById('diaries-with-issues').textContent = '3';
        
        this.loadNextActions([
            'Revisar planos de ensino pendentes',
            'Acompanhamento de diários com pendências',
            'Planejamento de formação docente'
        ]);
    }

    loadNextActions(actions) {
        const actionsList = document.getElementById('next-actions-list');
        
        if (!actions || actions.length === 0) {
            actions = [
                'Revisar planos de ensino pendentes',
                'Acompanhamento de diários com pendências',
                'Planejamento de formação docente'
            ];
        }

        actionsList.innerHTML = actions.map(action => `
            <div class="progress-item">
                <span>${action}</span>
                <i class="fas fa-chevron-right" style="color: var(--primary-color);"></i>
            </div>
        `).join('');
    }

    loadPageData(page) {
        switch(page) {
            case 'diario':
                this.loadDiarioData();
                break;
            case 'lista-piloto':
                this.loadListaPilotoData();
                break;
            case 'mural':
                this.loadMuralData();
                break;
            case 'controle-ha':
                this.loadControleHAData();
                break;
            case 'planos-ensino':
                this.loadPlanosEnsinoData();
                break;
        }
    }

    loadDiarioData() {
        const pageContent = document.getElementById('diario-page');
        pageContent.innerHTML = `
            <div class="page-header">
                <h2>Diário de Classe - Acompanhamento Pedagógico</h2>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="direcaoPedagogica.exportRelatorioDiarios()">
                        <i class="fas fa-download"></i> Exportar Relatório
                    </button>
                    <button class="btn btn-secondary" onclick="direcaoPedagogica.filtrarDiariosComPendencias()">
                        <i class="fas fa-exclamation-triangle"></i> Ver Pendências
                    </button>
                </div>
            </div>
            <div class="filters">
                <select id="turma-filter">
                    <option value="">Todas as Turmas</option>
                </select>
                <select id="professor-filter">
                    <option value="">Todos os Professores</option>
                </select>
                <select id="status-filter">
                    <option value="">Todos os Status</option>
                    <option value="completo">Completo</option>
                    <option value="pendente">Com Pendências</option>
                </select>
            </div>
            <div id="diarios-container">
                <p>Carregando diários para análise pedagógica...</p>
            </div>
        `;
    }

    loadPlanosEnsinoData() {
        const pageContent = document.getElementById('planos-ensino-page');
        pageContent.innerHTML = `
            <div class="page-header">
                <h2>Planos de Ensino - Análise Pedagógica</h2>
                <button class="btn btn-primary" onclick="direcaoPedagogica.novaAnalise()">
                    <i class="fas fa-plus"></i> Nova Análise
                </button>
            </div>
            <div class="analysis-filters">
                <select id="disciplina-filter">
                    <option value="">Todas as Disciplinas</option>
                </select>
                <select id="status-analise-filter">
                    <option value="">Todos os Status</option>
                    <option value="pendente">Pendente de Análise</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="ajustes">Necessita Ajustes</option>
                </select>
            </div>
            <div id="planos-container">
                <p>Carregando planos para análise pedagógica...</p>
            </div>
        `;
    }

    // Métodos específicos para Direção Pedagógica
    async exportRelatorioDiarios() {
        // Implementar exportação de relatório de diários
        console.log('Exportando relatório de diários...');
    }

    async filtrarDiariosComPendencias() {
        // Implementar filtro de diários com pendências
        console.log('Filtrando diários com pendências...');
    }

    async novaAnalise() {
        // Implementar nova análise de plano de ensino
        console.log('Iniciando nova análise...');
    }

    logout() {
        if (confirm('Deseja realmente sair do sistema?')) {
            window.location.href = 'login.html';
        }
    }
}

// Inicializar a aplicação
const direcaoPedagogica = new DirecaoPedagogica();