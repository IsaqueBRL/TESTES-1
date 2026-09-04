    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getDatabase, ref, set, push, onValue, onChildAdded, onChildChanged, onChildRemoved, remove, update, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

    const firebaseConfig = {
        apiKey: "AIzaSyCaVDJ4LtJu-dlvSi4QrDygfhx1hBGSdDM",
        authDomain: "banco-de-dados-invest.firebaseapp.com",
        databaseURL: "https://banco-de-dados-invest-default-rtdb.firebaseio.com",
        projectId: "banco-de-dados-invest",
        storageBucket: "banco-de-dados-invest.firebasestorage.app",
        messagingSenderId: "5603892998",
        appId: "1:5603892998:web:459556f888d31629050887"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    window.dbReference = db;
    window.firebaseRemove = remove;
    window.firebaseRef = ref;

    // ===== SISTEMA DE POP-UP CUSTOMIZADO (SUBSTITUI ALERT()/CONFIRM() NATIVOS DO NAVEGADOR) =====
    function customPopup({ title, message, type = 'info', okText = 'OK', cancelText = null }) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('app-popup-overlay');
            const iconEl = document.getElementById('app-popup-icon');
            const titleEl = document.getElementById('app-popup-title');
            const msgEl = document.getElementById('app-popup-message');
            const btnOk = document.getElementById('app-popup-btn-confirm');
            const btnCancel = document.getElementById('app-popup-btn-cancel');

            const icons = { info: 'i', success: '\u2713', warning: '!', danger: '\u2715' };
            iconEl.className = `app-popup-icon ${type}`;
            iconEl.textContent = icons[type] || icons.info;
            titleEl.textContent = title || 'Aviso';
            msgEl.textContent = message || '';
            btnOk.textContent = okText;
            btnOk.className = `app-popup-btn app-popup-btn-confirm ${type}`;

            if (cancelText) {
                btnCancel.style.display = 'inline-block';
                btnCancel.textContent = cancelText;
            } else {
                btnCancel.style.display = 'none';
            }

            overlay.classList.add('show');

            function cleanup(result) {
                overlay.classList.remove('show');
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlayClick);
                resolve(result);
            }
            function onOk() { cleanup(true); }
            function onCancel() { cleanup(false); }
            function onOverlayClick(e) { if (e.target === overlay && cancelText) cleanup(false); }

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlayClick);
        });
    }

    // Substitui alert(): exibe um pop-up estilizado do site (não bloqueia a execução do código)
    function showAlert(message, type = 'info', title = null) {
        const titles = { info: 'Aviso', success: 'Sucesso', warning: 'Atenção', danger: 'Ação Bloqueada' };
        return customPopup({ title: title || titles[type] || 'Aviso', message, type, okText: 'OK' });
    }

    // Substitui confirm(): retorna uma Promise<boolean> resolvida conforme o botão clicado pelo usuário
    function showConfirm(message, type = 'warning', title = 'Confirmar Ação') {
        return customPopup({ title, message, type, okText: 'Sim, Confirmar', cancelText: 'Cancelar' });
    }

    // ===== ABA 11: QR CODES POR LOCAL =====
    // Gera um QR code por local já cadastrado (mesmo nó "locais" usado no estoque - Aba 3), apontando
    // para o site de autoatendimento com o local já selecionado (?local=chaveDoLocal), para o cliente
    // escanear e cair direto naquele local sem precisar escolher nada.
    const QR_URL_BASE_PATH = 'configuracoes/urlBaseAutoatendimento';
    const qrInputUrlBase = document.getElementById('qr-input-url-base');
    let qrUrlBaseAtual = '';

    // Sincroniza o endereço do site de autoatendimento pelo Firebase (em vez de localStorage),
    // assim ele fica disponível em qualquer computador/navegador que abrir o sistema.
    onValue(ref(db, QR_URL_BASE_PATH), (snap) => {
        qrUrlBaseAtual = snap.val() || '';
        qrInputUrlBase.value = qrUrlBaseAtual;
        renderGridQRCodes();
    });

    document.getElementById('qr-btn-salvar-url').addEventListener('click', () => {
        const v = qrInputUrlBase.value.trim();
        if (!v) { showAlert('Informe um endereço válido para o site de autoatendimento.', 'warning'); return; }
        set(ref(db, QR_URL_BASE_PATH), v).then(() => {
            showAlert('Endereço salvo com sucesso!', 'success');
        }).catch(() => {
            showAlert('Não foi possível salvar o endereço. Verifique sua conexão e tente novamente.', 'danger');
        });
    });

    function montarLinkQRCode(localKey) {
        const base = (qrUrlBaseAtual || '').trim().split('?')[0];
        return base + '?local=' + encodeURIComponent(localKey);
    }

    function renderGridQRCodes() {
        const urlBase = (qrUrlBaseAtual || '').trim();
        const avisoEl = document.getElementById('qr-aviso-sem-url');
        if (!avisoEl) return; // aba ainda não está no DOM (defensivo)
        avisoEl.style.display = urlBase ? 'none' : 'block';

        const grid = document.getElementById('qr-grid-locais');
        const empty = document.getElementById('qr-empty');
        const chaves = localKeysOrdenados();
        document.getElementById('qr-qtd-locais').textContent = `Locais cadastrados (${chaves.length})`;
        grid.innerHTML = '';
        empty.style.display = chaves.length === 0 ? 'block' : 'none';
        if (!urlBase || chaves.length === 0) return;

        chaves.forEach(key => {
            const nome = nomeDoLocal(key);
            const link = montarLinkQRCode(key);
            const qrImg = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(link);

            const card = document.createElement('div');
            card.className = 'qr-card';
            card.innerHTML = `
                <img src="${qrImg}" alt="QR code de ${nome}">
                <h3>📍 ${nome}</h3>
                <div class="qr-link-txt">${link}</div>
                <div class="qr-card-actions no-print">
                    <button type="button" class="btn-info btn-copiar-qr">🔗 Copiar link</button>
                    <a class="btn-baixar" href="${qrImg}" download="qrcode-${nome.replace(/\s+/g,'-').toLowerCase()}.png" target="_blank">⬇️ Baixar</a>
                </div>
            `;
            card.querySelector('.btn-copiar-qr').addEventListener('click', () => {
                navigator.clipboard.writeText(link)
                    .then(() => showAlert('Link copiado!', 'success'))
                    .catch(() => showAlert('Não foi possível copiar automaticamente. Selecione o link manualmente.', 'warning'));
            });
            grid.appendChild(card);
        });
    }

    document.getElementById('qr-btn-imprimir').addEventListener('click', () => window.print());
    // ===== FIM ABA 11: QR CODES POR LOCAL =====

    // ===== HELPERS DE ESTOQUE POR LOCAL (com compatibilidade com produtos ainda não migrados) =====
    // Mesmo modelo de dados usado no site mobile: produtos/{key}/estoquePorLocal = { localKey: quantidade },
    // e produtos/{key}/readyStock sempre recalculado como a soma de todos os locais (mantém os dois
    // sistemas compatíveis entre si, mesmo que um seja atualizado antes do outro).
    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html — ao mudar aqui, mudar lá também (localKeysOrdenados) =====
    function localKeysOrdenados() {
        return Object.keys(allLoadedLocais).sort((a, b) => (allLoadedLocais[a].criadoEm || 0) - (allLoadedLocais[b].criadoEm || 0));
    }
    // ===== FIM LÓGICA COMPARTILHADA (localKeysOrdenados) =====

    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html — ao mudar aqui, mudar lá também (nomeDoLocal) =====
    function nomeDoLocal(localKey) {
        return (allLoadedLocais[localKey] && allLoadedLocais[localKey].nome) || 'Local removido';
    }
    // ===== FIM LÓGICA COMPARTILHADA (nomeDoLocal) =====

    // Retorna o preço de venda do produto para um local específico: usa o preço específico
    // cadastrado na Aba 12 (Preços por Local) se houver; senão cai no Preço Base do produto (Aba 2).
    function getPrecoProdutoNoLocal(prod, localKey) {
        if (!prod) return 0;
        if (localKey && prod.precosPorLocal && prod.precosPorLocal[localKey] !== undefined && prod.precosPorLocal[localKey] !== null && prod.precosPorLocal[localKey] !== '') {
            return parseFloat(prod.precosPorLocal[localKey]) || 0;
        }
        return parseFloat(prod.sellingPrice || 0);
    }

    // Produto que nunca foi migrado (não tem estoquePorLocal): considera que todo o readyStock atual
    // está no local mais antigo cadastrado, e 0 nos demais.
    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html — ao mudar aqui, mudar lá também (construirPorLocalLegado) =====
    function construirPorLocalLegado(prod) {
        const obj = {};
        const chaves = localKeysOrdenados();
        chaves.forEach(k => { obj[k] = 0; });
        if (chaves.length > 0) obj[chaves[0]] = parseFloat(prod?.readyStock || 0);
        return obj;
    }
    // ===== FIM LÓGICA COMPARTILHADA (construirPorLocalLegado) =====

    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html — ao mudar aqui, mudar lá também (getEstoquePorLocalCompleto) =====
    function getEstoquePorLocalCompleto(prod) {
        if (!prod) return {};
        if (prod.estoquePorLocal && typeof prod.estoquePorLocal === 'object') {
            const completo = { ...prod.estoquePorLocal };
            localKeysOrdenados().forEach(k => { if (!(k in completo)) completo[k] = 0; });
            return completo;
        }
        return construirPorLocalLegado(prod);
    }
    // ===== FIM LÓGICA COMPARTILHADA (getEstoquePorLocalCompleto) =====

    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html — ao mudar aqui, mudar lá também (getEstoqueTotal) =====
    function getEstoqueTotal(prod) {
        if (!prod) return 0;
        if (prod.estoquePorLocal && typeof prod.estoquePorLocal === 'object') {
            return Object.values(prod.estoquePorLocal).reduce((s, v) => s + (parseFloat(v) || 0), 0);
        }
        return parseFloat(prod?.readyStock || 0);
    }
    // ===== FIM LÓGICA COMPARTILHADA (getEstoqueTotal) =====

    function getEstoqueNoLocal(prod, localKey) {
        if (!prod || !localKey) return 0;
        return parseFloat(getEstoquePorLocalCompleto(prod)[localKey] || 0);
    }
    // Ajusta o estoque de um produto/local só em memória (sem gravar ainda) - usado durante validações
    // que precisam simular "desfazer" um lançamento antigo antes de checar o novo.
    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html — ao mudar aqui, mudar lá também (ajustarEstoqueMemoria) =====
    function ajustarEstoqueMemoria(prodKey, localKey, delta) {
        const p = allLoadedProducts[prodKey];
        if (!p || !localKey || !delta) return;
        const mapa = getEstoquePorLocalCompleto(p);
        mapa[localKey] = parseFloat(((parseFloat(mapa[localKey]) || 0) + delta).toFixed(3));
        p.estoquePorLocal = mapa;
        p.readyStock = Object.values(mapa).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    }
    // ===== FIM LÓGICA COMPARTILHADA (ajustarEstoqueMemoria) =====

    // Grava no Firebase exatamente o que já está em memória (estoquePorLocal + total) - usado depois
    // que a validação já ajustou tudo via ajustarEstoqueMemoria, evitando somar o delta duas vezes.
    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html — ao mudar aqui, mudar lá também (persistirEstoqueMemoria) =====
    function persistirEstoqueMemoria(prodKey) {
        const p = allLoadedProducts[prodKey];
        if (!p) return Promise.resolve();
        const mapa = getEstoquePorLocalCompleto(p);
        const total = Object.values(mapa).reduce((s, v) => s + (parseFloat(v) || 0), 0);
        p.estoquePorLocal = mapa;
        p.readyStock = total;
        return Promise.all([
            set(ref(db, `produtos/${prodKey}/estoquePorLocal`), mapa),
            set(ref(db, `produtos/${prodKey}/readyStock`), total)
        ]);
    }
    // ===== FIM LÓGICA COMPARTILHADA (persistirEstoqueMemoria) =====

    // Aplica e já grava no Firebase uma variação (delta) de estoque num produto/local específico.
    function aplicarDeltaEstoque(prodKey, localKey, delta) {
        const prod = allLoadedProducts[prodKey];
        if (!prod || !localKey || !delta) return Promise.resolve();
        const mapa = getEstoquePorLocalCompleto(prod);
        mapa[localKey] = parseFloat(((parseFloat(mapa[localKey]) || 0) + delta).toFixed(3));
        const novoTotal = Object.values(mapa).reduce((s, v) => s + (parseFloat(v) || 0), 0);
        prod.estoquePorLocal = mapa;
        prod.readyStock = novoTotal;
        return Promise.all([
            set(ref(db, `produtos/${prodKey}/estoquePorLocal`), mapa),
            set(ref(db, `produtos/${prodKey}/readyStock`), novoTotal)
        ]);
    }

    // ===== BAIXA DE ESTOQUE ATÔMICA (protege contra venda concorrente em vários dispositivos) =====
    // Usada nas vendas (Aba 5): diferente de aplicarDeltaEstoque acima (que grava direto o valor já
    // calculado no cache local), esta usa runTransaction do Firebase, que sempre parte do valor mais
    // recente gravado no SERVIDOR (não do cache local do navegador) e tenta de novo automaticamente se
    // outro dispositivo gravou entre a leitura e a escrita. Isso evita que duas vendas simultâneas em
    // dispositivos diferentes (ex: PC + mobile no mesmo local, ou vários totens de autoatendimento)
    // descontem a mesma unidade de estoque duas vezes.
    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html e sistema_autoatendimento.html — ao mudar aqui, mudar lá também (aplicarDeltaEstoqueTransacao) =====
    function aplicarDeltaEstoqueTransacao(prodKey, localKey, delta) {
        if (!prodKey || !localKey || !delta) return Promise.resolve();
        return runTransaction(ref(db, `produtos/${prodKey}`), (prod) => {
            if (prod === null) return prod; // produto não existe mais - nada a fazer, deixa passar
            const mapa = prod.estoquePorLocal ? { ...prod.estoquePorLocal } : {};
            if (!prod.estoquePorLocal && prod.readyStock) {
                mapa[localKey] = parseFloat(prod.readyStock) || 0; // produto ainda não migrado pra estoque por local
            }
            const atual = parseFloat(mapa[localKey] || 0);
            const novo = parseFloat((atual + delta).toFixed(3));
            if (delta < 0 && novo < -0.001) {
                return; // undefined aborta a transação: outro dispositivo já consumiu esse estoque
            }
            mapa[localKey] = Math.max(0, novo);
            prod.estoquePorLocal = mapa;
            prod.readyStock = Object.values(mapa).reduce((s, v) => s + (parseFloat(v) || 0), 0);
            return prod;
        }).then((resultado) => {
            if (!resultado.committed) {
                const nomeProduto = (allLoadedProducts[prodKey] && allLoadedProducts[prodKey].name) || prodKey;
                const err = new Error(`Estoque insuficiente de "${nomeProduto}"`);
                err.code = 'ESTOQUE_INSUFICIENTE';
                err.nomeProduto = nomeProduto;
                throw err;
            }
            return resultado;
        });
    }

    // Aplica vários deltas de estoque (um por produto) de forma atômica: se algum produto não tiver
    // mais estoque suficiente no exato momento da gravação (porque outro dispositivo vendeu primeiro),
    // desfaz (rollback) os que já tinham sido aplicados com sucesso, e rejeita a promise com a lista de
    // produtos que faltaram — sem deixar estoque descontado "solto" sem a venda correspondente.
    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html e sistema_autoatendimento.html — ao mudar aqui, mudar lá também (aplicarDeltasEstoqueAtomico) =====
    function aplicarDeltasEstoqueAtomico(deltaPorProduto, localKey) {
        const chaves = Object.keys(deltaPorProduto).filter(k => deltaPorProduto[k]);
        if (chaves.length === 0) return Promise.resolve();
        return Promise.all(chaves.map(prodKey =>
            aplicarDeltaEstoqueTransacao(prodKey, localKey, deltaPorProduto[prodKey])
                .then(() => ({ prodKey, ok: true }))
                .catch(err => ({ prodKey, ok: false, nomeProduto: err.nomeProduto || prodKey }))
        )).then(resultados => {
            const falhas = resultados.filter(r => !r.ok);
            if (falhas.length === 0) return;
            const sucessos = resultados.filter(r => r.ok);
            return Promise.all(sucessos.map(s => aplicarDeltaEstoqueTransacao(s.prodKey, localKey, -deltaPorProduto[s.prodKey]).catch(() => {})))
                .then(() => {
                    const err = new Error('Estoque insuficiente para: ' + falhas.map(f => f.nomeProduto).join(', '));
                    err.code = 'ESTOQUE_INSUFICIENTE';
                    err.produtos = falhas.map(f => f.nomeProduto);
                    throw err;
                });
        });
    }
    // ===== FIM LÓGICA COMPARTILHADA (aplicarDeltaEstoqueTransacao / aplicarDeltasEstoqueAtomico) =====

    let currentCalculatedData = null;
    let currentProductionId = null; 
    let currentSaleId = null; 
    let selectedStatus = "RASCUNHO"; 
    let selectedSalesStatus = "RASCUNHO";
    let isSaleLocked = false; // true quando a venda aberta tem status PAGO: bloqueia toda a edição do formulário
    
    let allLoadedProducts = {};
    let allLoadedSuprimentos = {};
    // Próximo código interno sequencial de matéria-prima (usado no cadastro e na prévia do pop-up) -
    // fica no escopo principal (não dentro de initDatabaseSync) pois é chamado também pelos botões
    // que abrem o modal de cadastro, fora daquela função.
    function getNextCodigoInternoInsumo() {
        const arr = Object.values(allLoadedSuprimentos);
        return Math.max(0, ...arr.map(s => parseInt(s.codigoInterno) || 0)) + 1;
    }
    let allLoadedProductions = {};
    let allLoadedUMs = {};
    let allLoadedCategoriasProdutos = {};
    let allLoadedSales = {};
    let allLoadedClientes = {};
    let allLoadedContas = {};
    let allLoadedMovimentacoesCaixa = {};
    let allLoadedComprasSuprimentos = {};
    let allLoadedPedidosCompra = {};
    // Guarda pra qual sub-aba de Compras voltar depois de salvar uma Nova Compra vinda de um atalho de
    // Pedido de Compra ("Receber Nota Fiscal" -> 'notas', "Registrar Recebimento" -> 'recebimentos').
    // Nula/undefined = comportamento padrão (Nova Compra avulsa), sempre pousa em 'notas'.
    let intencaoComprasSubviewAoSalvar = null;
    let allLoadedFornecedores = {};
    let allLoadedLocais = {};
    let allLoadedTransferenciasEstoque = {};
    let allLoadedOrcamentos = {};

    // ===== ATALHOS DE NAVEGAÇÃO: clicar no nome de um produto/insumo em qualquer tabela do sistema
    // leva direto pro cadastro dele (mesmo modal usado nas telas de Catálogo/Suprimentos), sem
    // precisar trocar de aba e procurar manualmente. Como os modais de edição são overlays fixos,
    // funcionam de qualquer aba que estiver ativa no momento do clique.
    // Várias telas (produção, vendas) guardam o produto/insumo pelo NOME em vez da chave - essas duas
    // funções resolvem o nome pra chave antes de abrir o cadastro.
    function findProdutoKeyByName(name) {
        const entry = Object.entries(allLoadedProducts).find(([k, v]) => (v.name || '').toLowerCase() === (name || '').toLowerCase());
        return entry ? entry[0] : null;
    }
    function findInsumoKeyByName(name) {
        const entry = Object.entries(allLoadedSuprimentos).find(([k, v]) => (v.name || '').toLowerCase() === (name || '').toLowerCase());
        return entry ? entry[0] : null;
    }
    window.abrirCadastroProdutoPorNome = function(name) {
        const key = findProdutoKeyByName(name);
        if (!key) { showAlert('Este produto não está mais no catálogo (pode ter sido removido).', 'warning'); return; }
        openModalEditarProduto(key);
    };
    window.abrirCadastroInsumoPorNome = function(name) {
        const key = findInsumoKeyByName(name);
        if (!key) { showAlert('Esta matéria-prima não está mais cadastrada (pode ter sido removida).', 'warning'); return; }
        openModalEditarInsumo(key);
    };
    // Gera o HTML de um nome clicável (link tracejado, mesmo estilo já usado no Catálogo de Produtos).
    // Se a chave não for encontrada (item já foi excluído), mostra só o texto puro, sem link quebrado.
    function nomeClicavelProduto(key, nome) {
        if (!key) return nome || '-';
        return `<a href="javascript:void(0)" class="cliente-nome-link" onclick="event.stopPropagation(); openModalEditarProduto('${key}')">${nome}</a>`;
    }
    function nomeClicavelInsumo(key, nome) {
        if (!key) return nome || '-';
        return `<a href="javascript:void(0)" class="cliente-nome-link" onclick="event.stopPropagation(); openModalEditarInsumo('${key}')">${nome}</a>`;
    }

    // ===== SINCRONIZAÇÃO INCREMENTAL (evita rebaixar a coleção inteira a cada mudança) =====
    // onValue reenvia a árvore inteira do nó toda vez que QUALQUER registro dentro dela muda -
    // isso fica caro em coleções que só crescem (vendas, produções, compras, movimentações de
    // caixa) e ainda por cima são escritas com frequência. Trocamos por onChildAdded +
    // onChildChanged + onChildRemoved: no carregamento inicial baixa tudo (igual o onValue fazia),
    // mas depois disso só trafega o registro que realmente mudou. O histórico completo continua
    // disponível em memória (necessário pras análises de crescimento/margem/ranking/"Tudo"), só
    // que sem o desperdício de rebaixar tudo de novo a cada nova venda/produção/compra/movimentação.
    function sincronizarColecaoIncremental(nomeNo, storeObj, onChange, delayMs = 50) {
        let renderAgendado = false;
        function agendarOnChange() {
            if (renderAgendado) return;
            renderAgendado = true;
            setTimeout(() => { renderAgendado = false; onChange(); }, delayMs);
        }
        const nodeRef = ref(db, nomeNo);
        onChildAdded(nodeRef, (snap) => { storeObj[snap.key] = snap.val(); agendarOnChange(); });
        onChildChanged(nodeRef, (snap) => { storeObj[snap.key] = snap.val(); agendarOnChange(); });
        onChildRemoved(nodeRef, (snap) => { delete storeObj[snap.key]; agendarOnChange(); });
    }
    const LOCAL_PADRAO_STORAGE_KEY = 'localEstoquePadraoPC';
    let localPadraoKey = localStorage.getItem(LOCAL_PADRAO_STORAGE_KEY) || null;
    let locaisJaCarregadosPC = false;
    let vendasFiltroStatus = new Set(['RASCUNHO', 'CONFIRMADA', 'PAGO']);
    let clientesSort = { key: null, dir: 'asc' };
    let filtroBuscaCatalogo = '';
    let filtroBuscaSuprimentos = '';
    let filtroBuscaClientes = '';
    let filtroCategoriaCatalogo = '';
    let filtroBuscaPopUpInsumo = '';

    // Normaliza texto para busca: ignora maiúsculas/minúsculas, acentos e espaços extras.
    // Assim "acai" encontra "Açaí", "pacoca" encontra "Paçoca", etc.
    function normalizarBusca(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    // ===== CNPJ: normalização (só dígitos, usada para comparar/vincular) e formatação (exibição) =====
    function normalizeCnpj(str) {
        return String(str || '').replace(/\D/g, '');
    }
    function formatCnpj(str) {
        const d = normalizeCnpj(str);
        if (d.length !== 14) return str || '-';
        return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
    }
    // Igual ao formatCnpj, mas usado nos lugares (tabela de fornecedores, compras, etc.) onde o
    // fornecedor pode ser informal/sem CNPJ - deixa isso explícito em vez de mostrar só "-".
    function formatCnpjOuInformal(str) {
        const digits = normalizeCnpj(str);
        if (!digits) return '<span style="color:var(--text-faint);">Sem CNPJ</span>';
        return formatCnpj(str);
    }
    function findFornecedorPorCnpj(digits) {
        if (!digits) return null;
        const found = Object.entries(allLoadedFornecedores).find(([k, f]) => normalizeCnpj(f.cnpj) === digits);
        return found || null;
    }

    // ===== ORDENAÇÃO GENÉRICA DE TABELAS (clique no cabeçalho ordena crescente/decrescente, clique de novo inverte) =====
    // Usado por todas as tabelas do site (Produção, Catálogo, Suprimentos, Vendas, Caixa) para evitar duplicar lógica.
    const tableSortState = {};
    function getSortState(tableId) {
        if (!tableSortState[tableId]) tableSortState[tableId] = { key: null, dir: 'asc' };
        return tableSortState[tableId];
    }
    function ordenarPorEstado(lista, tableId) {
        const state = getSortState(tableId);
        if (!state.key) return lista;
        const dirMult = state.dir === 'asc' ? 1 : -1;
        const arr = lista.slice();
        arr.sort((a, b) => {
            const valA = a[state.key], valB = b[state.key];
            if (typeof valA === 'string' || typeof valB === 'string') {
                return String(valA || '').localeCompare(String(valB || ''), 'pt-BR') * dirMult;
            }
            return ((valA || 0) - (valB || 0)) * dirMult;
        });
        return arr;
    }
    function bindSortableHeaders(containerId, tableId, onSort) {
        document.querySelectorAll(`#${containerId} th.th-sortable`).forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                const state = getSortState(tableId);
                if (state.key === key) {
                    state.dir = state.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    state.key = key;
                    state.dir = 'asc';
                }
                document.querySelectorAll(`#${containerId} th.th-sortable`).forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                th.classList.add(state.dir === 'asc' ? 'sort-asc' : 'sort-desc');
                onSort();
            });
        });
    }
    let chartType = 'linha'; // 'linha' ou 'barra'
    let chartAgrupamento = 'dia'; // 'dia' ou 'mes'

    // ===== CÁLCULO DO SALDO DE CRÉDITO DO CLIENTE (SEMPRE DERIVADO DO HISTÓRICO, NUNCA ARMAZENADO) =====
    // O saldo de crédito de um cliente NÃO é mais um número fixo salvo em `clientes/{key}/credito`.
    // Ele é sempre recalculado, na hora, somando/subtraindo o histórico de transações relacionadas ao cliente:
    //   (+) Créditos "Adicionados" manualmente na Aba 5 (origemCredito=true, retiradaCredito=false)
    //   (-) Créditos "Retirados" manualmente na Aba 5   (origemCredito=true, retiradaCredito=true)
    //   (+) Créditos gerados em vendas PAGAS com valor pago a mais (venda.creditoGerado)
    //   (-) Créditos usados para abater vendas PAGAS     (venda.creditoUsado)
    // Como o saldo é sempre derivado do histórico, excluir qualquer transação (de crédito ou de venda)
    // ajusta o saldo automaticamente e de forma consistente - sem risco de o saldo "dessincronizar"
    // do histórico ou ficar negativo por causa de exclusões feitas fora de ordem.
    // ===== LÓGICA COMPARTILHADA: função também existe em index_MOBILE.html — ao mudar aqui, mudar lá também (calcularCreditoCliente) =====
    function calcularCreditoCliente(nomeCliente) {
        if (!nomeCliente) return 0;
        const nomeLower = nomeCliente.toLowerCase();
        let credito = 0;
        Object.values(allLoadedSales).forEach(s => {
            if ((s.clientName || '').toLowerCase() !== nomeLower) return;
            if (s.origemCredito) {
                // Transação direta de crédito (Aba 5): totalValue já vem com o sinal correto
                // (positivo em "Adicionado", negativo em "Retirada")
                credito += parseFloat(s.totalValue || 0);
            } else if ((s.status || 'PAGO') === 'PAGO') {
                // Crédito gerado/usado dentro de uma venda normal (paga com valor a mais / abatida com crédito)
                credito += parseFloat(s.creditoGerado || 0) - parseFloat(s.creditoUsado || 0);
            }
        });
        return Math.max(0, parseFloat(credito.toFixed(2)));
    }
    // ===== FIM LÓGICA COMPARTILHADA (calcularCreditoCliente) =====


    // ===== SISTEMA DE ALERTAS (ESTOQUE BAIXO E VENDAS VENCIDAS) =====
    // Roda toda vez que produtos, suprimentos ou vendas são atualizados (via onValue). Alimenta os
    // números vermelhos ao lado das abas 2, 3 e 4 na barra lateral, e o painel do sino de notificações.
    function atualizarAlertasSistema() {
        const hojeStr = formatDateInputValue(new Date());

        const produtosBaixoEstoque = Object.values(allLoadedProducts).filter(p => {
            const min = parseFloat(p.estoqueMinimo || 0);
            return min > 0 && (p.readyStock || 0) < min;
        });

        const insumosBaixoEstoque = Object.values(allLoadedSuprimentos).filter(s => {
            const min = parseFloat(s.estoqueMinimo || 0);
            return min > 0 && parseFloat(s.quantity || 0) < min;
        });

        const vendasVencidas = Object.entries(allLoadedSales)
            .filter(([, v]) => v.status === 'CONFIRMADA' && v.salesDueDate && v.salesDueDate < hojeStr)
            .map(([key, v]) => ({ key, ...v }));

        const badgeCatalogo = document.getElementById('badge-alerta-catalogo');
        const badgeSuprimentos = document.getElementById('badge-alerta-suprimentos');
        const badgeVendas = document.getElementById('badge-alerta-vendas');
        if (badgeCatalogo) { badgeCatalogo.innerText = produtosBaixoEstoque.length; badgeCatalogo.style.display = produtosBaixoEstoque.length > 0 ? 'inline-flex' : 'none'; }
        if (badgeSuprimentos) { badgeSuprimentos.innerText = insumosBaixoEstoque.length; badgeSuprimentos.style.display = insumosBaixoEstoque.length > 0 ? 'inline-flex' : 'none'; }
        if (badgeVendas) { badgeVendas.innerText = vendasVencidas.length; badgeVendas.style.display = vendasVencidas.length > 0 ? 'inline-flex' : 'none'; }

        const totalAlertas = produtosBaixoEstoque.length + insumosBaixoEstoque.length + vendasVencidas.length;
        const sinoBadge = document.getElementById('sino-alertas-badge');
        if (sinoBadge) { sinoBadge.innerText = totalAlertas; sinoBadge.style.display = totalAlertas > 0 ? 'flex' : 'none'; }

        const painel = document.getElementById('painel-alertas-lista');
        if (!painel) return;
        painel.innerHTML = '';

        if (totalAlertas === 0) {
            painel.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-faint); font-size:9.5pt;">Nenhum alerta no momento.</div>';
            return;
        }

        produtosBaixoEstoque.forEach(p => {
            painel.innerHTML += `
                <div class="alerta-item" onclick="fecharPainelAlertasEIrPara('sabores')">
                    <span class="alerta-icon">🍦</span>
                    <div><strong>${p.name}</strong><br><span style="color:var(--color-negative);">Estoque: ${p.readyStock || 0} un (mínimo ${p.estoqueMinimo} un)</span></div>
                </div>`;
        });
        insumosBaixoEstoque.forEach(s => {
            painel.innerHTML += `
                <div class="alerta-item" onclick="fecharPainelAlertasEIrPara('suprimentos')">
                    <span class="alerta-icon"></span>
                    <div><strong>${s.name}</strong><br><span style="color:var(--color-negative);">Estoque: ${formatQuantidade(s.quantity || 0)} ${s.unit || ''} (mínimo ${s.estoqueMinimo} ${s.unit || ''})</span></div>
                </div>`;
        });
        vendasVencidas.forEach(v => {
            const diasVencido = Math.floor((new Date(hojeStr) - new Date(v.salesDueDate)) / 86400000);
            painel.innerHTML += `
                <div class="alerta-item" onclick="fecharPainelAlertasEIrPara('vendas')">
                    <span class="alerta-icon">⏰</span>
                    <div><strong>${v.clientName || 'CONSUMIDOR FINAL'}</strong><br><span style="color:var(--color-negative);">R$ ${formatMoeda((v.totalValue || 0))} - vencida há ${diasVencido} dia(s)</span></div>
                </div>`;
        });
    }

    window.fecharPainelAlertasEIrPara = function(tabId) {
        document.getElementById('painel-alertas').classList.remove('show');
        document.getElementById(`tab-link-${tabId}`).click();
    };

    // FORMATA NÚMEROS REMOVENDO ZEROS/DECIMAIS DESNECESSÁRIOS (EX: 1000.0 -> 1000)
    function formatQuantidade(num) {
        const n = parseFloat(num) || 0;
        return parseFloat(n.toFixed(2)).toString();
    }

    // FORMATA VALOR MONETÁRIO NO PADRÃO BRASILEIRO PARA EXIBIÇÃO (EX: 1234.5 -> "1.234,50")
    // Usar apenas para TEXTO exibido na tela (innerText/innerHTML). Nunca usar em campos de
    // input numéricos ou em valores que serão salvos/recalculados - esses continuam com ponto.
    function formatMoeda(num) {
        return (parseFloat(num) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // CUSTO EFETIVO DE UM PRODUTO: usa o preço de custo salvo manualmente no cadastro (costPrice)
    // se ele existir; senão, cai para o custo calculado da última Ordem de Produção do item.
    function getCustoEfetivoProduto(prod) {
        if (prod && prod.costPrice !== undefined && prod.costPrice !== null && prod.costPrice !== '') {
            return parseFloat(prod.costPrice) || 0;
        }
        const opsDoProduto = Object.values(allLoadedProductions).filter(o => o.name.toLowerCase() === (prod.name || '').toLowerCase());
        return opsDoProduto.length > 0 ? (opsDoProduto[opsDoProduto.length - 1].costPerUnit || 0) : 0;
    }

    // BUSCA O ESTOQUE ATUAL E A UM DE UM INSUMO DIRETO DA ABA 3 (SUPRIMENTOS)
    function getEstoqueEUmAtual(name) {
        const match = Object.values(allLoadedSuprimentos).find(s => s.name.toLowerCase() === (name || '').toLowerCase());
        return {
            estoque: match ? (parseFloat(match.quantity) || 0) : 0,
            um: match ? (match.unit || '-') : '-'
        };
    }

    // CONVERSÃO DE DATAS: O SITE SEMPRE EXIBE/DIGITA NO PADRÃO DD/MM/AAAA, MAS ARMAZENA EM AAAA-MM-DD (ISO) NO BANCO
    function dataISOparaBR(iso) {
        if(!iso) return '';
        const partes = iso.split('-');
        if(partes.length !== 3) return '';
        const [ano, mes, dia] = partes;
        return `${dia}/${mes}/${ano}`;
    }

    function dataBRparaISO(br) {
        if(!br) return '';
        const partes = br.split('/');
        if(partes.length !== 3) return '';
        const [dia, mes, ano] = partes;
        if(!dia || !mes || ano.length !== 4) return '';
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    // CAMPOS DE DATA INTELIGENTES: aceitam digitação livre (com ou sem barras, com ano de 2 ou 4 dígitos)
    // e o atalho "today"/"hoje" para a data de hoje. Ao sair do campo (blur) ou apertar Enter, o texto
    // digitado é interpretado e reformatado para DD/MM/AAAA; o valor ISO correspondente fica disponível
    // via dataBRparaISO(input.value) para o restante do sistema, exatamente como já era feito antes.
    function parseDataInteligente(texto) {
        if (!texto) return null;
        const limpo = texto.trim();
        if (!limpo) return null;
        if (/^(today|hoje)$/i.test(limpo)) return formatDateInputValue(new Date());
        if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return validarDataISO(limpo) ? limpo : null; // já em ISO
        let dia, mes, ano;
        let m;
        if ((m = limpo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { [, dia, mes, ano] = m; }
        else if ((m = limpo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/))) { [, dia, mes] = m; ano = String(2000 + parseInt(m[3], 10)); }
        else if ((m = limpo.match(/^(\d{2})(\d{2})(\d{4})$/))) { [, dia, mes, ano] = m; }
        else if ((m = limpo.match(/^(\d{2})(\d{2})(\d{2})$/))) { dia = m[1]; mes = m[2]; ano = String(2000 + parseInt(m[3], 10)); }
        else { return null; }
        const iso = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        return validarDataISO(iso) ? iso : null;
    }
    function validarDataISO(iso) {
        const partes = iso.split('-');
        if (partes.length !== 3) return false;
        const [ano, mes, dia] = partes.map(Number);
        if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2100) return false;
        const d = new Date(iso + 'T00:00:00');
        return d.getFullYear() === ano && (d.getMonth() + 1) === mes && d.getDate() === dia;
    }
    function attachDataInteligente(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('placeholder', 'dd/mm/aaaa');
        el.setAttribute('autocomplete', 'off');
        el.classList.add('input-data-inteligente');
        const interpretar = () => {
            const raw = el.value;
            if (!raw || !raw.trim()) { el.classList.remove('input-data-erro'); return; }
            const iso = parseDataInteligente(raw);
            if (iso) {
                el.value = dataISOparaBR(iso);
                el.classList.remove('input-data-erro');
                el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                el.classList.add('input-data-erro');
            }
        };
        el.addEventListener('blur', interpretar);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); interpretar(); } });
    }
    ['chart-data-inicio', 'chart-data-fim', 'sales-date', 'sales-due-date', 'vendidos-data-inicio', 'vendidos-data-fim',
     'crescimento-data-inicio', 'crescimento-data-fim', 'detalhe-cliente-data-inicio', 'detalhe-cliente-data-fim',
     'detalhe-fornecedor-data-inicio', 'detalhe-fornecedor-data-fim', 'editar-mov-data', 'compra-data',
     'compra-data-vencimento', 'pedido-compra-data-lancamento', 'pedido-compra-data-vencimento', 'pedido-compra-data-faturamento', 'dar-baixa-compra-data',
     'sazonalidade-data-inicio', 'sazonalidade-data-fim', 'orcamento-data-criacao', 'orcamento-prazo'
    ].forEach(attachDataInteligente);

    // Avisa em tempo real se a data de vencimento da venda ficar antes da data da venda (não deixa
    // o usuário só descobrir isso na hora de salvar).
    function checarVencimentoAntesDaVenda() {
        const dataVendaEl = document.getElementById('sales-date');
        const dataVencEl = document.getElementById('sales-due-date');
        const avisoEl = document.getElementById('sales-due-date-warning');
        const dataVenda = dataBRparaISO(dataVendaEl.value);
        const dataVenc = dataBRparaISO(dataVencEl.value);
        const invalido = dataVenda && dataVenc && dataVenc < dataVenda;
        avisoEl.style.display = invalido ? 'block' : 'none';
        dataVencEl.classList.toggle('input-data-erro', invalido);
    }
    document.getElementById('sales-date').addEventListener('change', checarVencimentoAntesDaVenda);
    document.getElementById('sales-due-date').addEventListener('change', checarVencimentoAntesDaVenda);


    const defaultIngredients = [
        { name: 'Leite líquido', packageQty: 1000, unit: 'ml', price: 5.95, usedQty: 1000 },
        { name: 'Liga Neutra', packageQty: 100, unit: 'g', price: 6.00, usedQty: 15 },
        { name: 'Leite em Pó Ninho', packageQty: 380, unit: 'g', price: 18.95, usedQty: 240 },
        { name: 'Nutella (recheio)', packageQty: 350, unit: 'g', price: 29.30, usedQty: 150 }
    ];

    // NAVEGAÇÃO INTERNA OP
    const sectionHistorico = document.getElementById('section-historico-inicial');
    const sectionCalculos = document.getElementById('section-calculos-producao');

    function showCalculosSection() { sectionHistorico.style.display = 'none'; sectionCalculos.style.display = 'block'; }
    function showHistoricoSection() { sectionCalculos.style.display = 'none'; sectionHistorico.style.display = 'block'; currentProductionId = null; }

    document.getElementById('btn-nova-producao').addEventListener('click', () => {
        currentProductionId = null;
        const proxNum = getNextPedidoNumero();
        document.getElementById('pedido-numero-display').innerText = `Pedido #${String(proxNum).padStart(3, '0')}`;
        updateStatusSelectorVisual("RASCUNHO");
        resetToDefaultIngredients();
        populateRecipeNameSelect('');
        popularTodosSelectsDeLocal();
        const selLocalProducao = document.getElementById('producao-local-destino');
        selLocalProducao.disabled = false;
        if (localPadraoKey) selLocalProducao.value = localPadraoKey;
        showCalculosSection();
    });
    document.getElementById('btn-voltar-historico').addEventListener('click', showHistoricoSection);

    // NAVEGAÇÃO INTERNA CAIXA/PDV
    const sectionHistoricoVendas = document.getElementById('section-historico-vendas');
    const sectionFormularioVendas = document.getElementById('section-formulario-vendas');

    document.getElementById('btn-nova-venda').addEventListener('click', () => {
        currentSaleId = null;
        document.getElementById('pdv-form-title').innerText = "Lançamento de Venda";
        document.getElementById('btn-delete-sale').style.display = 'none';
        sectionHistoricoVendas.style.display = 'none';
        sectionFormularioVendas.style.display = 'block';
        
        const hoje = formatDateInputValue(new Date());
        document.getElementById('sales-date').value = dataISOparaBR(hoje);
        document.getElementById('sales-due-date').value = dataISOparaBR(hoje);
        document.getElementById('sales-due-date-warning').style.display = 'none';
        document.getElementById('sales-due-date').classList.remove('input-data-erro');
        document.getElementById('sales-client-name').value = '';
        pendingPagamento = null;

        popularTodosSelectsDeLocal();
        const selLocalVenda = document.getElementById('vendas-local-selecionado');
        selLocalVenda.disabled = false;
        if (localPadraoKey) selLocalVenda.value = localPadraoKey;
        
        const container = document.getElementById('sales-items-container-body');
        container.innerHTML = '';
        container.appendChild(createSaleItemRow()); 
        setSalesFormLocked(false);
        updateSalesStatusSelectorVisual("RASCUNHO");
        atualizarResumoPagamentoNaVenda();
        calculatePdvTotals();
    });

    document.getElementById('btn-voltar-vendas-historico').addEventListener('click', () => {
        sectionFormularioVendas.style.display = 'none';
        sectionHistoricoVendas.style.display = 'block';
    });

    function getNextPedidoNumero() {
        const arr = Object.values(allLoadedProductions);
        if (arr.length === 0) return 1;
        return Math.max(...arr.map(p => p.pedidoNumero || 0)) + 1;
    }

    // STATUS MANAGEMENT
    document.querySelectorAll('#section-calculos-producao .status-opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => updateStatusSelectorVisual(e.target.getAttribute('data-status')));
    });

    function updateStatusSelectorVisual(status) {
        selectedStatus = status;
        document.querySelectorAll('#section-calculos-producao .status-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-status') === status);
        });
    }

    // ===== SELETOR DE STATUS DA VENDA (ABA 4) =====
    // - Clicar em "Pago" abre o pop-up de confirmação de pagamento (com opção de usar crédito do cliente)
    // - Clicar em "Rascunho"/"Confirmada" enquanto a venda já está Paga (travada) dispara o fluxo de reversão
    let pendingPagamento = null; // { valorPago, creditoUsado, creditoGerado, clienteKey } definido só após confirmar o pop-up de pagamento

    document.querySelectorAll('#sales-status-selector .status-opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const novoStatus = e.target.getAttribute('data-status');

            if (isSaleLocked) {
                if (novoStatus === 'PAGO') return; // já está pago, nada a fazer
                solicitarReversaoVenda(novoStatus);
                return;
            }

            if (novoStatus === 'PAGO') {
                abrirModalPagamento(); // reabre o pop-up mesmo se já estiver selecionado, para permitir ajustar os valores
                return;
            }

            if (novoStatus === selectedSalesStatus) return;

            pendingPagamento = null;
            updateSalesStatusSelectorVisual(novoStatus);
            atualizarResumoPagamentoNaVenda();
        });
    });

    function updateSalesStatusSelectorVisual(status) {
        selectedSalesStatus = status;
        document.querySelectorAll('#sales-status-selector .status-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-status') === status);
        });
    }

    // Mostra/atualiza, no resumo da venda, os valores confirmados no pop-up de pagamento
    function atualizarResumoPagamentoNaVenda() {
        const rowPago = document.getElementById('pdv-row-valor-pago');
        const rowCreditoUsado = document.getElementById('pdv-row-credito-usado');
        const rowCreditoGerado = document.getElementById('pdv-row-credito-gerado');
        const rowConta = document.getElementById('pdv-row-conta-pagamento');

        if (!pendingPagamento || selectedSalesStatus !== 'PAGO') {
            rowPago.style.display = 'none';
            rowCreditoUsado.style.display = 'none';
            rowCreditoGerado.style.display = 'none';
            rowConta.style.display = 'none';
            return;
        }

        rowPago.style.display = 'flex';
        document.getElementById('pdv-summary-valor-pago').innerText = `R$ ${formatMoeda(pendingPagamento.valorPago)}`;

        if (pendingPagamento.contaNome && pendingPagamento.valorPago > 0) {
            rowConta.style.display = 'flex';
            document.getElementById('pdv-summary-conta-pagamento').innerText = pendingPagamento.contaNome;
        } else {
            rowConta.style.display = 'none';
        }

        if (pendingPagamento.creditoUsado > 0) {
            rowCreditoUsado.style.display = 'flex';
            document.getElementById('pdv-summary-credito-usado').innerText = `R$ ${formatMoeda(pendingPagamento.creditoUsado)}`;
        } else {
            rowCreditoUsado.style.display = 'none';
        }

        if (pendingPagamento.creditoGerado > 0) {
            rowCreditoGerado.style.display = 'flex';
            document.getElementById('pdv-summary-credito-gerado').innerText = `R$ ${formatMoeda(pendingPagamento.creditoGerado)}`;
        } else {
            rowCreditoGerado.style.display = 'none';
        }
    }

    // Localiza o cliente atualmente digitado no campo "Nome do Cliente" da venda
    function getClienteAtualDaVenda() {
        const nomeDigitado = document.getElementById('sales-client-name').value.trim();
        if (!nomeDigitado) return { key: null, nome: 'CONSUMIDOR FINAL', credito: 0 };
        const key = Object.keys(allLoadedClientes).find(k => (allLoadedClientes[k].name || '').toLowerCase() === nomeDigitado.toLowerCase());
        return key
            ? { key, nome: allLoadedClientes[key].name, credito: calcularCreditoCliente(allLoadedClientes[key].name) }
            : { key: null, nome: nomeDigitado, credito: 0 };
    }

    // ===== POP-UP DE CONFIRMAÇÃO DE PAGAMENTO (ABA 4) =====
    function abrirModalPagamento() {
        const totalLiquidoTexto = (document.getElementById('pdv-summary-total-net').innerText || 'R$ 0,00').replace('R$', '').trim();
        // Números vêm formatados no padrão brasileiro (ex: "1.234,56"): remove separador de milhar (.) e troca a vírgula decimal por ponto antes do parseFloat.
        const totalLiquido = parseFloat(totalLiquidoTexto.replace(/\./g, '').replace(',', '.')) || 0;
        const cliente = getClienteAtualDaVenda();
        const modal = document.getElementById('modal-pagamento-venda');

        modal.dataset.total = totalLiquido;
        modal.dataset.clienteKey = cliente.key || '';
        modal.dataset.creditoDisponivel = cliente.credito;

        document.getElementById('pgto-total-venda').innerText = `R$ ${formatMoeda(totalLiquido)}`;
        document.getElementById('pgto-credito-disponivel').innerText = `R$ ${formatMoeda(cliente.credito)}`;

        const usarCreditoWrapper = document.getElementById('pgto-usar-credito-wrapper');
        const checkbox = document.getElementById('pgto-usar-credito-checkbox');
        const creditoInput = document.getElementById('pgto-credito-usar-valor');

        usarCreditoWrapper.style.display = cliente.credito > 0 ? 'block' : 'none';
        checkbox.checked = !!(pendingPagamento && pendingPagamento.creditoUsado > 0);
        creditoInput.style.display = checkbox.checked ? 'block' : 'none';
        creditoInput.max = cliente.credito;
        creditoInput.value = (pendingPagamento && pendingPagamento.creditoUsado > 0) ? pendingPagamento.creditoUsado.toFixed(2) : '';

        document.getElementById('pgto-valor-pago').value = pendingPagamento ? pendingPagamento.valorPago.toFixed(2) : totalLiquido.toFixed(2);

        // Popula o select com as contas cadastradas na Aba 6 - Caixa, restaurando a escolha anterior se houver
        const selectConta = document.getElementById('pgto-conta-recebimento');
        const contaAtualSelecionada = pendingPagamento ? (pendingPagamento.contaKey || '') : '';
        selectConta.innerHTML = '<option value="">-- Selecione a conta --</option>';
        Object.keys(allLoadedContas).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key; opt.innerText = allLoadedContas[key].name;
            selectConta.appendChild(opt);
        });
        selectConta.value = contaAtualSelecionada;

        atualizarResumoPagamentoModal();
        modal.style.display = 'flex';
    }

    document.getElementById('pgto-usar-credito-checkbox').addEventListener('change', (e) => {
        document.getElementById('pgto-credito-usar-valor').style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) document.getElementById('pgto-credito-usar-valor').value = '';
        atualizarResumoPagamentoModal();
    });
    document.getElementById('pgto-credito-usar-valor').addEventListener('input', atualizarResumoPagamentoModal);
    document.getElementById('pgto-valor-pago').addEventListener('input', atualizarResumoPagamentoModal);
    setupModalEvents(null, 'modal-pagamento-venda', 'close-modal-pagamento-venda');

    function atualizarResumoPagamentoModal() {
        const modal = document.getElementById('modal-pagamento-venda');
        const total = parseFloat(modal.dataset.total) || 0;
        const creditoDisponivel = parseFloat(modal.dataset.creditoDisponivel) || 0;
        const checkbox = document.getElementById('pgto-usar-credito-checkbox');

        let creditoUsado = 0;
        if (checkbox.checked) {
            creditoUsado = parseFloat(document.getElementById('pgto-credito-usar-valor').value) || 0;
            creditoUsado = Math.min(Math.max(0, creditoUsado), creditoDisponivel);
        }
        const valorPago = parseFloat(document.getElementById('pgto-valor-pago').value) || 0;
        const totalCoberto = creditoUsado + valorPago;
        const creditoGerado = Math.max(0, totalCoberto - total);
        const falta = Math.max(0, total - totalCoberto);

        document.getElementById('pgto-total-coberto').innerText = `R$ ${formatMoeda(totalCoberto)}`;

        document.getElementById('pgto-row-credito-gerado').style.display = creditoGerado > 0 ? 'flex' : 'none';
        document.getElementById('pgto-credito-gerado').innerText = `R$ ${formatMoeda(creditoGerado)}`;

        document.getElementById('pgto-row-faltando').style.display = falta > 0 ? 'flex' : 'none';
        document.getElementById('pgto-valor-faltando').innerText = `R$ ${formatMoeda(falta)}`;

        // O campo de conta só faz sentido quando existe dinheiro novo entrando (crédito usado não é dinheiro novo)
        document.getElementById('pgto-conta-wrapper').style.display = valorPago > 0 ? 'block' : 'none';

        document.getElementById('btn-confirmar-pagamento').disabled = (total > 0 && falta > 0.001);
    }

    document.getElementById('btn-confirmar-pagamento').addEventListener('click', () => {
        const modal = document.getElementById('modal-pagamento-venda');
        const total = parseFloat(modal.dataset.total) || 0;
        const creditoDisponivel = parseFloat(modal.dataset.creditoDisponivel) || 0;
        const clienteKey = modal.dataset.clienteKey || null;
        const checkbox = document.getElementById('pgto-usar-credito-checkbox');

        let creditoUsado = 0;
        if (checkbox.checked) {
            creditoUsado = parseFloat(document.getElementById('pgto-credito-usar-valor').value) || 0;
            creditoUsado = Math.min(Math.max(0, creditoUsado), creditoDisponivel);
        }
        const valorPago = parseFloat(document.getElementById('pgto-valor-pago').value) || 0;
        const totalCoberto = creditoUsado + valorPago;

        if (totalCoberto < total - 0.001) {
            showAlert('O valor pago em dinheiro somado ao crédito usado ainda não cobre o total da venda.', 'warning');
            return;
        }

        const contaKey = document.getElementById('pgto-conta-recebimento').value || null;
        if (valorPago > 0 && !contaKey) {
            if (Object.keys(allLoadedContas).length === 0) {
                showAlert('Não há nenhuma conta cadastrada. Cadastre uma conta na Aba 6 - Caixa antes de confirmar o pagamento.', 'warning');
            } else {
                showAlert('Selecione em qual conta este valor foi recebido.', 'warning');
            }
            return;
        }
        const contaNome = contaKey ? allLoadedContas[contaKey].name : null;

        pendingPagamento = {
            valorPago: parseFloat(valorPago.toFixed(2)),
            creditoUsado: parseFloat(creditoUsado.toFixed(2)),
            creditoGerado: parseFloat(Math.max(0, totalCoberto - total).toFixed(2)),
            clienteKey,
            contaKey, contaNome
        };

        modal.style.display = 'none';
        updateSalesStatusSelectorVisual('PAGO');
        atualizarResumoPagamentoNaVenda();
    });

    // ===== REVERSÃO DE VENDA PAGA (ABA 4) =====
    // Ao clicar em "Rascunho"/"Confirmada" com uma venda Paga aberta, pede confirmação e reverte tudo.
    function solicitarReversaoVenda(novoStatus) {
        const venda = allLoadedSales[currentSaleId];
        if (!venda) return;

        const statusLabel = novoStatus === 'RASCUNHO' ? 'Rascunho' : 'Confirmada';
        let explicacao = `Tem certeza que deseja reverter esta venda de "Pago" para "${statusLabel}"?\n\nAo confirmar:\n`;
        explicacao += (novoStatus === 'RASCUNHO')
            ? `• Os produtos desta venda voltarão para o estoque disponível.\n`
            : `• O estoque continuará reservado/abatido (Confirmada também reserva estoque).\n`;
        if ((venda.creditoGerado || 0) > 0) explicacao += `• O crédito de R$ ${formatMoeda(venda.creditoGerado)} gerado por esta venda será removido da conta do cliente.\n`;
        if ((venda.creditoUsado || 0) > 0) explicacao += `• O crédito de R$ ${formatMoeda(venda.creditoUsado)} usado para pagar esta venda será devolvido para a conta do cliente.\n`;
        if (venda.contaPagamentoNome && (venda.valorPago || 0) > 0) explicacao += `• O valor de R$ ${formatMoeda(venda.valorPago)} lançado na conta "${venda.contaPagamentoNome}" (Aba 6 - Caixa) será estornado.\n`;
        explicacao += `• A venda deixará de contar no Faturamento/Lucro como paga e o formulário será desbloqueado para edição.`;

        showConfirm(explicacao, 'warning', 'Reverter Venda Paga').then(ok => {
            if (ok) reverterVendaPaga(novoStatus);
        });
    }

    function reverterVendaPaga(novoStatus) {
        const venda = allLoadedSales[currentSaleId];
        if (!venda) return;

        const finalizarReversao = () => {
            setSalesFormLocked(false);
            pendingPagamento = null;
            updateSalesStatusSelectorVisual(novoStatus);
            atualizarResumoPagamentoNaVenda();
            showAlert('Venda revertida com sucesso. O formulário está desbloqueado para edição.', 'success');
        };

        // Como o saldo de crédito é sempre derivado do histórico de vendas (calcularCreditoCliente),
        // basta remover o status "PAGO" e os campos de crédito desta venda: o saldo do cliente
        // se ajusta sozinho automaticamente na próxima renderização, sem nenhum update manual em `clientes/`.
        update(ref(db, `vendas/${currentSaleId}`), {
            status: novoStatus, valorPago: null, creditoGerado: null, creditoUsado: null,
            contaPagamentoKey: null, contaPagamentoNome: null, movimentacaoCaixaKey: null
        }).then(() => {
            // Devolve ao estoque (no mesmo local físico da venda) se ela voltou para Rascunho
            // (Confirmada continua abatendo, então nada muda)
            if (novoStatus === 'RASCUNHO' && venda.items) {
                const localDaVenda = venda.localVendaKey || localPadraoKey;
                if (localDaVenda) {
                    venda.items.forEach(item => {
                        if (item.productKey && allLoadedProducts[item.productKey]) {
                            aplicarDeltaEstoque(item.productKey, localDaVenda, item.quantity);
                        }
                    });
                }
            }

            // Desfaz o lançamento de Caixa gerado por esta venda (Aba 6): remove a movimentação e
            // devolve o saldo da conta ao valor de antes de a venda ter sido marcada como Paga.
            if (venda.movimentacaoCaixaKey && venda.contaPagamentoKey && allLoadedContas[venda.contaPagamentoKey]) {
                const saldoAtual = parseFloat(allLoadedContas[venda.contaPagamentoKey].saldo || 0);
                const novoSaldo = parseFloat((saldoAtual - (venda.valorPago || 0)).toFixed(2));
                Promise.all([
                    remove(ref(db, `movimentacoesCaixa/${venda.movimentacaoCaixaKey}`)),
                    update(ref(db, `contas/${venda.contaPagamentoKey}`), { saldo: novoSaldo })
                ]).then(finalizarReversao);
            } else {
                finalizarReversao();
            }
        });
    }

    // ===== TRAVA DE EDIÇÃO PARA VENDAS COM STATUS "PAGO" =====
    // Quando uma venda já está paga, o usuário pode visualizá-la mas não pode alterar os dados da venda.
    // O seletor de status permanece clicável para permitir o fluxo de reversão (ver acima).
    function setSalesFormLocked(locked) {
        isSaleLocked = locked;
        document.getElementById('sale-locked-banner').style.display = locked ? 'flex' : 'none';

        const camposControlados = [
            'sales-client-name', 'sales-date', 'sales-due-date',
            'btn-pdv-add-product-row', 'btn-execute-sale'
        ];
        camposControlados.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = locked;
        });

        document.querySelectorAll('#sales-items-container-body .sales-item-row').forEach(row => {
            row.querySelectorAll('select, input, button').forEach(el => el.disabled = locked);
        });

        document.getElementById('btn-execute-sale').style.display = locked ? 'none' : 'block';
    }

    // MODAIS CONFIG
    setupModalEvents('btn-trigger-modal-estoque', 'modal-ajuste-estoque', 'close-modal-estoque');
    setupModalEvents('btn-trigger-modal-um', 'modal-gerenciar-um', 'close-modal-um');
    setupModalEvents('btn-trigger-modal-categorias', 'modal-gerenciar-categorias', 'close-modal-categorias');
    setupModalEvents('btn-trigger-modal-cadastro-insumo', 'modal-cadastro-insumo', 'close-modal-cadastro-insumo');
    setupModalEvents('btn-add-ingredient', 'modal-selecionar-insumo', 'close-modal-selecionar-insumo');
    setupModalEvents(null, 'modal-editar-insumo', 'close-modal-editar-insumo');
    setupModalEvents(null, 'modal-editar-produto', 'close-modal-editar-produto');
    setupModalEvents('btn-trigger-modal-estoque-produto', 'modal-estoque-produto', 'close-modal-estoque-produto');
    setupModalEvents('btn-trigger-modal-novo-produto', 'modal-novo-produto', 'close-modal-novo-produto');
    setupModalEvents('btn-trigger-modal-locais', 'modal-locais', 'close-modal-locais');
    setupModalEvents('btn-trigger-modal-transferencia-estoque', 'modal-transferencia-estoque', 'close-modal-transferencia-estoque');

    document.getElementById('form-novo-produto').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('novo-produto-name').value.trim();
        const description = document.getElementById('novo-produto-description').value;
        const price = parseFloat(document.getElementById('novo-produto-price').value) || 0;
        const stock = parseFloat(document.getElementById('novo-produto-stock').value) || 0;
        const estoqueMinimo = parseFloat(document.getElementById('novo-produto-estoque-minimo').value) || 0;
        const category = document.getElementById('novo-produto-categoria').value.trim() || 'Sem Categoria';
        if(!name) return;

        const jaExiste = Object.values(allLoadedProducts).some(p => p.name.toLowerCase() === name.toLowerCase());
        if(jaExiste) {
            showAlert('Já existe um produto cadastrado com este nome. Utilize o botão "✏️ Editar" no catálogo para alterá-lo.', 'warning');
            return;
        }

        const newRef = push(ref(db, 'produtos'));
        const novoProdutoPayload = { name, description, sellingPrice: price, readyStock: stock, estoqueMinimo, category };
        if (localPadraoKey && allLoadedLocais[localPadraoKey]) {
            const mapaInicial = {};
            localKeysOrdenados().forEach(k => { mapaInicial[k] = 0; });
            mapaInicial[localPadraoKey] = stock;
            novoProdutoPayload.estoquePorLocal = mapaInicial;
        }
        set(newRef, novoProdutoPayload).then(() => {
            document.getElementById('modal-novo-produto').style.display = 'none';
            document.getElementById('form-novo-produto').reset();
            document.getElementById('novo-produto-price').value = '0.00';
            document.getElementById('novo-produto-stock').value = '0';
            document.getElementById('novo-produto-estoque-minimo').value = '0';
            showAlert('Produto cadastrado com sucesso!', 'success');
        });
    });

    // ===== BADGE DO LOCAL PADRÃO (CABEÇALHO DA BARRA LATERAL) =====
    function definirLocalPadrao(key) {
        localPadraoKey = key;
        localStorage.setItem(LOCAL_PADRAO_STORAGE_KEY, key);
        popularTodosSelectsDeLocal();
    }

    // ===== MODAL: GERENCIAR LOCAIS (também define o local padrão deste computador) =====
    let localEmEdicaoKeyPC = null;

    function renderListaLocaisModal() {
        const container = document.getElementById('locais-lista');
        const empty = document.getElementById('locais-empty');
        container.innerHTML = '';
        const chaves = localKeysOrdenados();
        if (chaves.length === 0) { empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        chaves.forEach(key => {
            const loc = allLoadedLocais[key];
            const totalQtd = Object.values(allLoadedProducts).reduce((s, p) => s + getEstoqueNoLocal(p, key), 0);
            const row = document.createElement('tr');
            row.className = 'local-item-row';

            if (localEmEdicaoKeyPC === key) {
                row.innerHTML = `
                    <td class="local-item-nome"><input type="text" id="local-edicao-input-pc" value="${loc.nome || ''}"></td>
                    <td>${formatQuantidade(totalQtd)} un.</td>
                    <td><button type="button" class="btn-action-prod btn-edit-prod" id="btn-local-salvar-edicao-pc">Salvar</button></td>
                `;
                container.appendChild(row);
                const inp = row.querySelector('#local-edicao-input-pc');
                setTimeout(() => inp.focus(), 30);
                row.querySelector('#btn-local-salvar-edicao-pc').addEventListener('click', (e) => { e.stopPropagation(); salvarNomeLocalPC(key, inp.value); });
                inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') salvarNomeLocalPC(key, inp.value); });
                return;
            }

            row.innerHTML = `
                <td class="local-item-nome">${loc.nome || '(sem nome)'}</td>
                <td>${formatQuantidade(totalQtd)} un.</td>
                <td><button type="button" class="btn-action-prod btn-edit-prod" data-editar-local="${key}">✏️</button></td>
            `;
            row.addEventListener('click', () => definirLocalPadrao(key));
            row.querySelector('[data-editar-local]').addEventListener('click', (e) => {
                e.stopPropagation();
                localEmEdicaoKeyPC = key;
                renderListaLocaisModal();
            });
            container.appendChild(row);
        });
    }

    function salvarNomeLocalPC(key, novoNome) {
        const nome = (novoNome || '').trim();
        if (!nome) { showAlert('Informe um nome válido para o local.', 'warning'); return; }
        update(ref(db, `locais/${key}`), { nome }).then(() => {
            localEmEdicaoKeyPC = null;
            showAlert('Local renomeado com sucesso!', 'success');
        });
    }

    document.getElementById('btn-add-new-local').addEventListener('click', () => {
        const input = document.getElementById('new-local-input');
        const nome = input.value.trim();
        if (!nome) { showAlert('Informe o nome do novo local.', 'warning'); return; }
        const novoRef = push(ref(db, 'locais'));
        set(novoRef, { nome, criadoEm: Date.now() }).then(() => {
            input.value = '';
            showAlert('Local criado com sucesso!', 'success');
            if (!localPadraoKey) definirLocalPadrao(novoRef.key);
        });
    });

    // ===== POPULA TODOS OS <select> DE LOCAL DO SISTEMA (produção, vendas, transferência, ajuste em massa) =====
    function popularTodosSelectsDeLocal() {
        const opcoes = localKeysOrdenados().map(k => `<option value="${k}">${nomeDoLocal(k)}</option>`).join('');
        const selectsComPadrao = ['producao-local-destino', 'vendas-local-selecionado', 'transfer-pc-origem', 'transfer-massa-origem', 'estoque-massa-local'];
        selectsComPadrao.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const valorAntigo = sel.value;
            sel.innerHTML = opcoes;
            if (valorAntigo && allLoadedLocais[valorAntigo]) sel.value = valorAntigo;
            else if (localPadraoKey && allLoadedLocais[localPadraoKey]) sel.value = localPadraoKey;
        });
        // Destino da transferência não recebe local padrão automaticamente (evitaria origem = destino por padrão)
        ['transfer-pc-destino', 'transfer-massa-destino'].forEach(id => {
            const selDestino = document.getElementById(id);
            if (!selDestino) return;
            const valorAntigo = selDestino.value;
            selDestino.innerHTML = opcoes;
            if (valorAntigo && allLoadedLocais[valorAntigo]) selDestino.value = valorAntigo;
        });
        // Produto do formulário de transferência
        const selProduto = document.getElementById('transfer-pc-produto');
        if (selProduto) {
            const valorAntigo = selProduto.value;
            selProduto.innerHTML = Object.keys(allLoadedProducts).map(k => `<option value="${k}">${allLoadedProducts[k].name}</option>`).join('');
            if (valorAntigo && allLoadedProducts[valorAntigo]) selProduto.value = valorAntigo;
        }
    }

    // ===== TRANSFERÊNCIA DE ESTOQUE ENTRE LOCAIS =====
    document.getElementById('form-transferencia-estoque').addEventListener('submit', (e) => {
        e.preventDefault();
        const prodKey = document.getElementById('transfer-pc-produto').value;
        const origemKey = document.getElementById('transfer-pc-origem').value;
        const destinoKey = document.getElementById('transfer-pc-destino').value;
        const qtd = parseFloat(document.getElementById('transfer-pc-qtd').value);
        const prod = allLoadedProducts[prodKey];

        if (!prodKey || !prod) { showAlert('Selecione o produto.', 'warning'); return; }
        if (!origemKey || !destinoKey) { showAlert('Selecione a origem e o destino.', 'warning'); return; }
        if (origemKey === destinoKey) { showAlert('Origem e destino não podem ser o mesmo local.', 'warning'); return; }
        if (isNaN(qtd) || qtd <= 0) { showAlert('Informe uma quantidade válida.', 'warning'); return; }

        const disponivel = getEstoqueNoLocal(prod, origemKey);
        if (qtd > disponivel) {
            showAlert(`Estoque insuficiente em ${nomeDoLocal(origemKey)}. Disponível: ${disponivel} un.`, 'warning');
            return;
        }

        Promise.all([
            aplicarDeltaEstoque(prodKey, origemKey, -qtd),
            aplicarDeltaEstoque(prodKey, destinoKey, qtd)
        ]).then(() => {
            const histRef = push(ref(db, 'transferenciasEstoque'));
            return set(histRef, {
                produtoKey: prodKey, produtoNome: prod.name, quantidade: qtd,
                origemKey, origemNome: nomeDoLocal(origemKey), destinoKey, destinoNome: nomeDoLocal(destinoKey),
                timestamp: Date.now()
            });
        }).then(() => {
            showAlert('Transferência registrada com sucesso!', 'success');
            document.getElementById('transfer-pc-qtd').value = '';
        }).catch(err => {
            console.error('Erro ao transferir estoque:', err);
            showAlert('Não foi possível concluir a transferência. Verifique sua conexão.', 'danger');
        });
    });

    // Atualiza os textos "Estoque na origem" / "Estoque no destino" do modo individual, conforme o
    // produto/local escolhido, para o usuário conferir os saldos antes de confirmar a transferência.
    function atualizarEstoqueOrigemDestinoTransferPC() {
        const prodKey = document.getElementById('transfer-pc-produto').value;
        const origemKey = document.getElementById('transfer-pc-origem').value;
        const destinoKey = document.getElementById('transfer-pc-destino').value;
        const prod = allLoadedProducts[prodKey];
        const spanOrigem = document.getElementById('transfer-pc-estoque-origem');
        const spanDestino = document.getElementById('transfer-pc-estoque-destino');
        if (!spanOrigem || !spanDestino) return;
        spanOrigem.textContent = prod && origemKey ? `${getEstoqueNoLocal(prod, origemKey)} un.` : '--';
        spanDestino.textContent = prod && destinoKey ? `${getEstoqueNoLocal(prod, destinoKey)} un.` : '--';
    }
    ['transfer-pc-produto', 'transfer-pc-origem', 'transfer-pc-destino'].forEach(id => {
        document.getElementById(id).addEventListener('change', atualizarEstoqueOrigemDestinoTransferPC);
    });

    // ===== ALTERNAR ENTRE MODO INDIVIDUAL E EM MASSA NO MODAL DE TRANSFERÊNCIA =====
    document.getElementById('btn-transfer-modo-individual').addEventListener('click', () => toggleModoTransferPC('individual'));
    document.getElementById('btn-transfer-modo-massa').addEventListener('click', () => toggleModoTransferPC('massa'));
    function toggleModoTransferPC(modo) {
        document.getElementById('btn-transfer-modo-individual').classList.toggle('active', modo === 'individual');
        document.getElementById('btn-transfer-modo-massa').classList.toggle('active', modo === 'massa');
        document.getElementById('form-transferencia-estoque').style.display = modo === 'individual' ? 'block' : 'none';
        document.getElementById('form-transferencia-massa').style.display = modo === 'massa' ? 'block' : 'none';
        if (modo === 'massa') renderListaTransferMassa();
    }

    // ===== TRANSFERÊNCIA DE ESTOQUE EM MASSA (VÁRIOS PRODUTOS DE UMA VEZ, MESMA ORIGEM/DESTINO) =====
    // Guarda apenas as chaves dos produtos que o usuário escolheu (via busca) para aparecerem na lista de transferência.
    let selectedProdutosTransferMassa = new Set();

    function limparSelecaoTransferMassa() {
        selectedProdutosTransferMassa = new Set();
        const inputBusca = document.getElementById('transfer-massa-busca');
        const btnLimpar = document.getElementById('btn-limpar-busca-transfer-massa');
        const resultados = document.getElementById('transfer-massa-resultados-busca');
        if (inputBusca) inputBusca.value = '';
        if (btnLimpar) btnLimpar.style.display = 'none';
        if (resultados) { resultados.innerHTML = ''; resultados.style.display = 'none'; }
    }

    function renderResultadosBuscaTransferMassa() {
        const inputBusca = document.getElementById('transfer-massa-busca');
        const container = document.getElementById('transfer-massa-resultados-busca');
        if (!inputBusca || !container) return;
        const termoOriginal = inputBusca.value;
        const termo = normalizarBusca(termoOriginal);
        container.innerHTML = '';
        if (!termo) { container.style.display = 'none'; return; }

        const encontrados = Object.keys(allLoadedProducts).filter(key => normalizarBusca(allLoadedProducts[key].name).includes(termo));
        if (encontrados.length === 0) {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:var(--text-muted); font-size:9pt;">Nenhum sabor encontrado para "${termoOriginal}".</div>`;
            container.style.display = 'block';
            return;
        }
        encontrados.forEach(key => {
            const prod = allLoadedProducts[key];
            const jaSelecionado = selectedProdutosTransferMassa.has(key);
            const item = document.createElement('div');
            item.className = 'transfer-massa-busca-item';
            item.innerHTML = `
                <span>${prod.name}</span>
                <button type="button" class="btn-massa-busca-add" data-key="${key}" ${jaSelecionado ? 'disabled' : ''}>${jaSelecionado ? '✓ Adicionado' : '+ Adicionar'}</button>
            `;
            container.appendChild(item);
        });
        container.style.display = 'block';
        container.querySelectorAll('.btn-massa-busca-add').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedProdutosTransferMassa.add(btn.getAttribute('data-key'));
                renderListaTransferMassa();
                renderResultadosBuscaTransferMassa();
            });
        });
    }

    document.getElementById('transfer-massa-busca').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            renderResultadosBuscaTransferMassa();
        }
    });
    document.getElementById('transfer-massa-busca').addEventListener('input', (e) => {
        document.getElementById('btn-limpar-busca-transfer-massa').style.display = e.target.value ? 'flex' : 'none';
    });
    document.getElementById('btn-limpar-busca-transfer-massa').addEventListener('click', () => {
        document.getElementById('transfer-massa-busca').value = '';
        document.getElementById('btn-limpar-busca-transfer-massa').style.display = 'none';
        const resultados = document.getElementById('transfer-massa-resultados-busca');
        resultados.innerHTML = '';
        resultados.style.display = 'none';
    });

    function renderListaTransferMassa() {
        const origemKey = document.getElementById('transfer-massa-origem').value;
        const lista = document.getElementById('transfer-massa-lista');

        // Preserva as quantidades já digitadas ao re-renderizar (ex: ao trocar a origem ou adicionar mais itens)
        const valoresAtuais = {};
        lista.querySelectorAll('.transfer-massa-input').forEach(inp => { valoresAtuais[inp.getAttribute('data-key')] = inp.value; });

        lista.innerHTML = '';

        // Remove da seleção produtos que não existem mais no catálogo
        Array.from(selectedProdutosTransferMassa).forEach(key => {
            if (!allLoadedProducts[key]) selectedProdutosTransferMassa.delete(key);
        });

        if (selectedProdutosTransferMassa.size === 0) {
            lista.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px 8px; font-size:9pt;">Use o campo de busca acima para escolher os sabores que deseja transferir.</div>`;
            return;
        }

        selectedProdutosTransferMassa.forEach(key => {
            const prod = allLoadedProducts[key];
            const disponivel = origemKey ? getEstoqueNoLocal(prod, origemKey) : 0;
            const row = document.createElement('div');
            row.className = 'transfer-massa-linha';
            row.innerHTML = `
                <div class="transfer-massa-info">
                    <span class="transfer-massa-nome">${prod.name}</span>
                    <span class="transfer-massa-disponivel">Disponível na origem: ${disponivel} un.</span>
                </div>
                <input type="number" min="0" step="any" class="transfer-massa-input" data-key="${key}" placeholder="0" value="${valoresAtuais[key] || ''}">
                <button type="button" class="btn-massa-remover" data-key="${key}" title="Remover da lista">✕</button>
            `;
            lista.appendChild(row);
        });

        lista.querySelectorAll('.btn-massa-remover').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedProdutosTransferMassa.delete(btn.getAttribute('data-key'));
                renderListaTransferMassa();
                renderResultadosBuscaTransferMassa();
            });
        });
    }
    document.getElementById('transfer-massa-origem').addEventListener('change', renderListaTransferMassa);

    document.getElementById('form-transferencia-massa').addEventListener('submit', (e) => {
        e.preventDefault();
        const origemKey = document.getElementById('transfer-massa-origem').value;
        const destinoKey = document.getElementById('transfer-massa-destino').value;
        if (!origemKey || !destinoKey) { showAlert('Selecione a origem e o destino.', 'warning'); return; }
        if (origemKey === destinoKey) { showAlert('Origem e destino não podem ser o mesmo local.', 'warning'); return; }

        const inputs = document.querySelectorAll('.transfer-massa-input');
        const itens = [];
        for (const input of inputs) {
            const qtd = parseFloat(input.value);
            if (!qtd || qtd <= 0) continue;
            const key = input.getAttribute('data-key');
            const prod = allLoadedProducts[key];
            if (!prod) continue;
            const disponivel = getEstoqueNoLocal(prod, origemKey);
            if (qtd > disponivel) { showAlert(`Estoque insuficiente de "${prod.name}" em ${nomeDoLocal(origemKey)}. Disponível: ${disponivel} un.`, 'warning'); return; }
            itens.push({ key, prod, qtd });
        }
        if (itens.length === 0) { showAlert('Informe a quantidade de pelo menos um produto para transferir.', 'warning'); return; }

        const operacoes = [];
        itens.forEach(({ key, qtd }) => {
            operacoes.push(aplicarDeltaEstoque(key, origemKey, -qtd));
            operacoes.push(aplicarDeltaEstoque(key, destinoKey, qtd));
        });
        Promise.all(operacoes).then(() => {
            const gravacoesHistorico = itens.map(({ key, prod, qtd }) => {
                const histRef = push(ref(db, 'transferenciasEstoque'));
                return set(histRef, {
                    produtoKey: key, produtoNome: prod.name, quantidade: qtd,
                    origemKey, origemNome: nomeDoLocal(origemKey), destinoKey, destinoNome: nomeDoLocal(destinoKey),
                    timestamp: Date.now()
                });
            });
            return Promise.all(gravacoesHistorico);
        }).then(() => {
            showAlert(`${itens.length} produto(s) transferido(s) de ${nomeDoLocal(origemKey)} para ${nomeDoLocal(destinoKey)} com sucesso!`, 'success');
            limparSelecaoTransferMassa();
            renderListaTransferMassa();
        }).catch(err => {
            console.error('Erro ao transferir estoque em massa:', err);
            showAlert('Não foi possível concluir a transferência em massa. Verifique sua conexão.', 'danger');
        });
    });

    function renderHistoricoTransferenciasPC() {
        const container = document.getElementById('transfer-pc-historico');
        const empty = document.getElementById('transfer-pc-historico-empty');
        if (!container) return;
        container.innerHTML = '';
        const entradas = Object.values(allLoadedTransferenciasEstoque).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 40);
        if (entradas.length === 0) { empty.style.display = 'block'; return; }
        empty.style.display = 'none';
        entradas.forEach(t => {
            const data = t.timestamp ? new Date(t.timestamp).toLocaleDateString('pt-BR') : '---';
            const quantidade = Number(t.quantidade) || 0;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data}</td>
                <td>${t.origemNome || '?'}</td>
                <td>${t.destinoNome || '?'}</td>
                <td>${t.produtoNome || 'Produto'}</td>
                <td>${quantidade}</td>
            `;
            container.appendChild(row);
        });
    }

    document.getElementById('vendas-local-selecionado').addEventListener('change', () => {
        document.querySelectorAll('#sales-items-container-body .pdv-item-select').forEach(sel => {
            const valorAtual = sel.value;
            sel.innerHTML = montarOpcoesProdutoPDV(valorAtual);
            montarListaPickerProduto(sel.closest('tr'));
            sel.dispatchEvent(new Event('change'));
        });
    });

    // Fecha a lista suspensa de produto ao clicar fora dela.
    document.addEventListener('click', () => {
        document.querySelectorAll('.pdv-product-picker-list.show').forEach(l => l.classList.remove('show'));
    });

    function setupModalEvents(btnId, modalId, closeId) {
        if(btnId) {
            document.getElementById(btnId).addEventListener('click', () => {
                if (modalId === 'modal-selecionar-insumo') {
                    filtroBuscaPopUpInsumo = '';
                    const inputBusca = document.getElementById('filtro-busca-pop-up-insumo');
                    const btnLimpar = document.getElementById('btn-limpar-busca-pop-up-insumo');
                    if (inputBusca) inputBusca.value = '';
                    if (btnLimpar) btnLimpar.style.display = 'none';
                    renderPopUpInsumos();
                }
                if (modalId === 'modal-estoque-produto') {
                    renderModalEstoqueProduto();
                }
                if (modalId === 'modal-locais') {
                    renderListaLocaisModal();
                }
                if (modalId === 'modal-transferencia-estoque') {
                    popularTodosSelectsDeLocal();
                    limparSelecaoTransferMassa();
                    toggleModoTransferPC('individual');
                    atualizarEstoqueOrigemDestinoTransferPC();
                    renderHistoricoTransferenciasPC();
                }
                document.getElementById(modalId).style.display = 'flex';
            });
        }
        document.getElementById(closeId).addEventListener('click', () => document.getElementById(modalId).style.display = 'none');
    }

    // ALTERNAR ENTRE MODO INDIVIDUAL E EM MASSA NO MODAL DE ESTOQUE
    document.getElementById('btn-estoque-modo-individual').addEventListener('click', () => toggleModoEstoqueProduto('individual'));
    document.getElementById('btn-estoque-modo-massa').addEventListener('click', () => toggleModoEstoqueProduto('massa'));

    function toggleModoEstoqueProduto(modo) {
        document.getElementById('btn-estoque-modo-individual').classList.toggle('active', modo === 'individual');
        document.getElementById('btn-estoque-modo-massa').classList.toggle('active', modo === 'massa');
        document.getElementById('form-estoque-individual').style.display = modo === 'individual' ? 'block' : 'none';
        document.getElementById('form-estoque-massa').style.display = modo === 'massa' ? 'block' : 'none';
    }

    // ===== ABA "ESTOQUE": só produtos com saldo > 0, filtrável por local ou visão geral =====
    let filtroBuscaEstoqueTab = '';

    function popularFiltroEstoqueTab() {
        const sel = document.getElementById('estoque-tab-filtro-local');
        if (!sel) return;
        const valorAntigo = sel.value;
        let opcoes = '<option value="__geral__">Todos os locais (separados por linha)</option>';
        opcoes += localKeysOrdenados().map(k => `<option value="${k}">${nomeDoLocal(k)}</option>`).join('');
        sel.innerHTML = opcoes;
        if (valorAntigo && (valorAntigo === '__geral__' || allLoadedLocais[valorAntigo])) sel.value = valorAntigo;
    }

    function renderEstoqueTab() {
        const selFiltro = document.getElementById('estoque-tab-filtro-local');
        if (!selFiltro) return;
        const filtro = selFiltro.value || '__geral__';

        const termo = normalizarBusca(filtroBuscaEstoqueTab);
        const locaisParaListar = filtro === '__geral__' ? localKeysOrdenados() : [filtro];

        // Uma linha por combinação Produto x Local (só entra se o produto tiver saldo positivo naquele local),
        // pra dar exatamente a visão "estoque geral separado por local" pedida.
        let lista = [];
        Object.entries(allLoadedProducts).forEach(([key, p]) => {
            if (termo && !normalizarBusca(p.name).includes(termo)) return;
            const custo = getCustoEfetivoProduto(p);
            locaisParaListar.forEach(localKey => {
                const qtd = getEstoqueNoLocal(p, localKey);
                if (qtd <= 0) return;
                lista.push({
                    key, prod: p, name: p.name, category: p.category || '-',
                    custo, sellingPrice: parseFloat(p.sellingPrice || 0),
                    localKey, localNome: nomeDoLocal(localKey), qtd
                });
            });
        });

        lista = ordenarPorEstado(lista, 'estoque-tab-table');

        const tbody = document.getElementById('estoque-tab-table-body');
        const vazio = document.getElementById('estoque-tab-vazio');
        tbody.innerHTML = '';
        if (lista.length === 0) { vazio.style.display = 'block'; return; }
        vazio.style.display = 'none';

        lista.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge-status status-transferencia">${item.localNome}</span></td>
            <td>${nomeClicavelProduto(item.key, item.prod.name)}</td>
                <td>${item.prod.category || '-'}</td>
                <td>R$ ${formatMoeda(item.custo)}</td>
                <td>R$ ${formatMoeda(item.sellingPrice)}</td>
                <td><strong>${formatQuantidade(item.qtd)} un.</strong></td>
            `;
            tbody.appendChild(tr);
        });
    }

    tableSortState['estoque-tab-table'] = { key: 'qtd', dir: 'desc' };
    tableSortState['analise-reposicao-table'] = { key: 'diasRestantes', dir: 'asc' };
    bindSortableHeaders('estoque-local-tab', 'estoque-tab-table', renderEstoqueTab);
    document.getElementById('estoque-tab-filtro-local').addEventListener('change', renderEstoqueTab);
    const inputBuscaEstoqueTab = document.getElementById('estoque-tab-busca');
    const btnLimparBuscaEstoqueTab = document.getElementById('btn-limpar-busca-estoque-tab');
    inputBuscaEstoqueTab.addEventListener('input', () => {
        filtroBuscaEstoqueTab = inputBuscaEstoqueTab.value;
        btnLimparBuscaEstoqueTab.style.display = filtroBuscaEstoqueTab ? 'flex' : 'none';
        renderEstoqueTab();
    });
    btnLimparBuscaEstoqueTab.addEventListener('click', () => {
        inputBuscaEstoqueTab.value = '';
        filtroBuscaEstoqueTab = '';
        btnLimparBuscaEstoqueTab.style.display = 'none';
        renderEstoqueTab();
        inputBuscaEstoqueTab.focus();
    });
    document.getElementById('tab-link-estoque-local').addEventListener('click', (e) => {
        switchTab('estoque-local-tab', e.currentTarget);
        popularFiltroEstoqueTab();
        renderEstoqueTab();
    });

    function renderModalEstoqueProduto() {
        popularTodosSelectsDeLocal();
        const select = document.getElementById('estoque-individual-select');
        select.innerHTML = Object.keys(allLoadedProducts).map(key => `<option value="${key}">${allLoadedProducts[key].name}</option>`).join('');
        if (select.options.length > 0) renderLocaisAjusteIndividual(select.value);
        renderListaMassaEstoque();
    }

    function renderLocaisAjusteIndividual(prodKey) {
        const container = document.getElementById('estoque-individual-locais-lista');
        const prod = allLoadedProducts[prodKey];
        container.innerHTML = '';
        if (!prod) return;
        if (localKeysOrdenados().length === 0) {
            container.innerHTML = '<p style="font-size:9pt; color:var(--text-muted);">Cadastre pelo menos um local em "📍 Gerenciar Locais" antes de ajustar o estoque.</p>';
            return;
        }
        const mapa = getEstoquePorLocalCompleto(prod);
        localKeysOrdenados().forEach(lk => {
            const row = document.createElement('div');
            row.className = 'estoque-local-linha';
            row.innerHTML = `<span>${nomeDoLocal(lk)}</span><input type="number" min="0" step="any" class="estoque-individual-local-input" data-local-key="${lk}" value="${mapa[lk] || 0}">`;
            container.appendChild(row);
        });
    }

    function renderListaMassaEstoque() {
        const localSelecionado = document.getElementById('estoque-massa-local').value;
        const listaMassa = document.getElementById('estoque-massa-lista');
        listaMassa.innerHTML = '';
        if (!localSelecionado) return;
        Object.keys(allLoadedProducts).forEach(key => {
            const prod = allLoadedProducts[key];
            const row = document.createElement('div');
            row.className = 'form-group';
            row.innerHTML = `
                <label>${prod.name}</label>
                <input type="number" step="any" class="massa-estoque-input" data-key="${key}" value="${getEstoqueNoLocal(prod, localSelecionado)}">
            `;
            listaMassa.appendChild(row);
        });
    }

    document.getElementById('estoque-individual-select').addEventListener('change', (e) => {
        renderLocaisAjusteIndividual(e.target.value);
    });
    document.getElementById('estoque-massa-local').addEventListener('change', renderListaMassaEstoque);

    document.getElementById('form-estoque-individual').addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('estoque-individual-select').value;
        if (!key || !allLoadedProducts[key]) return;
        const inputs = document.querySelectorAll('.estoque-individual-local-input');
        if (inputs.length === 0) { showAlert('Cadastre pelo menos um local antes de ajustar o estoque.', 'warning'); return; }
        const novoMapa = {};
        for (const inp of inputs) {
            const v = parseFloat(inp.value);
            if (isNaN(v) || v < 0) { showAlert('Informe quantidades válidas em todos os locais.', 'warning'); return; }
            novoMapa[inp.dataset.localKey] = v;
        }
        const novoTotal = Object.values(novoMapa).reduce((s, v) => s + v, 0);
        Promise.all([
            set(ref(db, `produtos/${key}/estoquePorLocal`), novoMapa),
            set(ref(db, `produtos/${key}/readyStock`), novoTotal)
        ]).then(() => {
            allLoadedProducts[key].estoquePorLocal = novoMapa;
            allLoadedProducts[key].readyStock = novoTotal;
            document.getElementById('modal-estoque-produto').style.display = 'none';
            showAlert('Estoque do produto atualizado com sucesso!', 'success');
        });
    });

    document.getElementById('form-estoque-massa').addEventListener('submit', (e) => {
        e.preventDefault();
        const localSelecionado = document.getElementById('estoque-massa-local').value;
        if (!localSelecionado) { showAlert('Selecione o local a ajustar.', 'warning'); return; }
        const inputs = document.querySelectorAll('.massa-estoque-input');
        const promessas = [];
        inputs.forEach(input => {
            const key = input.getAttribute('data-key');
            const novoValor = parseFloat(input.value);
            if (key && !isNaN(novoValor) && allLoadedProducts[key]) {
                const delta = novoValor - getEstoqueNoLocal(allLoadedProducts[key], localSelecionado);
                if (delta !== 0) promessas.push(aplicarDeltaEstoque(key, localSelecionado, delta));
            }
        });
        Promise.all(promessas).then(() => {
            document.getElementById('modal-estoque-produto').style.display = 'none';
            showAlert(`Estoque de todos os produtos em "${nomeDoLocal(localSelecionado)}" atualizado com sucesso!`, 'success');
        });
    });

    window.openModalEditarProduto = function(key) {
        const prod = allLoadedProducts[key];
        if(!prod) return;
        document.getElementById('edit-produto-key').value = key;
        document.getElementById('edit-produto-name').value = prod.name || '';
        document.getElementById('edit-produto-description').value = prod.description || '';
        document.getElementById('edit-produto-price').value = parseFloat(prod.sellingPrice || 0).toFixed(2);
        document.getElementById('edit-produto-estoque-minimo').value = parseFloat(prod.estoqueMinimo || 0);
        document.getElementById('edit-produto-custo').value = parseFloat(getCustoEfetivoProduto(prod)).toFixed(2);
        const selectCategoriaEdit = document.getElementById('edit-produto-categoria');
        const categoriaAtual = prod.category || '';
        if (categoriaAtual && !Array.from(selectCategoriaEdit.options).some(o => o.value === categoriaAtual)) {
            const opt = document.createElement('option');
            opt.value = categoriaAtual;
            opt.innerText = `${categoriaAtual} (categoria removida)`;
            selectCategoriaEdit.appendChild(opt);
        }
        selectCategoriaEdit.value = categoriaAtual;
        document.getElementById('modal-editar-produto').style.display = 'flex';
    };

    function renderModalTransacoesProduto(key) {
        const prod = allLoadedProducts[key];
        document.getElementById('transacoes-produto-nome').innerText = prod ? prod.name : '';

        const linhas = [];
        Object.keys(allLoadedSales || {}).forEach(saleKey => {
            const venda = allLoadedSales[saleKey];
            if (!venda || !Array.isArray(venda.items)) return;
            venda.items.forEach(item => {
                if (item.productKey === key) {
                    linhas.push({
                        data: venda.salesDate || '',
                        cliente: venda.clientName || 'CONSUMIDOR FINAL',
                        quantidade: parseFloat(item.quantity || 0),
                        timestamp: venda.timestamp || 0
                    });
                }
            });
        });

        linhas.sort((a, b) => b.timestamp - a.timestamp);

        const tbody = document.getElementById('transacoes-produto-body');
        const tabela = document.getElementById('transacoes-produto-table');
        const vazio = document.getElementById('transacoes-produto-vazio');
        const resumo = document.getElementById('transacoes-produto-resumo');

        if (linhas.length === 0) {
            tbody.innerHTML = '';
            tabela.style.display = 'none';
            vazio.style.display = 'block';
            resumo.innerText = '';
        } else {
            const totalQuantidade = linhas.reduce((soma, l) => soma + l.quantidade, 0);
            resumo.innerText = `${linhas.length} venda(s) encontrada(s) — total de ${formatQuantidade(totalQuantidade)} unidade(s) vendida(s)`;
            tabela.style.display = '';
            vazio.style.display = 'none';
            tbody.innerHTML = linhas.map(l => {
                const dataFormatada = l.data ? l.data.split('-').reverse().join('/') : '---';
                return `<tr>
                    <td>${dataFormatada}</td>
                    <td>${l.cliente}</td>
                    <td>${formatQuantidade(l.quantidade)}</td>
                </tr>`;
            }).join('');
        }

        document.getElementById('modal-transacoes-produto').style.display = 'flex';
    }

    document.getElementById('btn-ver-transacoes-produto').addEventListener('click', () => {
        const key = document.getElementById('edit-produto-key').value;
        if (!key) return;
        renderModalTransacoesProduto(key);
    });

    setupModalEvents(null, 'modal-transacoes-produto', 'close-modal-transacoes-produto');

    document.getElementById('form-editar-produto').addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('edit-produto-key').value;
        const name = document.getElementById('edit-produto-name').value;
        const description = document.getElementById('edit-produto-description').value;
        const price = parseFloat(document.getElementById('edit-produto-price').value) || 0;
        const custo = parseFloat(document.getElementById('edit-produto-custo').value) || 0;
        const estoqueMinimo = parseFloat(document.getElementById('edit-produto-estoque-minimo').value) || 0;
        const category = document.getElementById('edit-produto-categoria').value.trim() || 'Sem Categoria';
        if(!key) return;

        set(ref(db, `produtos/${key}/name`), name);
        set(ref(db, `produtos/${key}/description`), description);
        set(ref(db, `produtos/${key}/sellingPrice`), price);
        set(ref(db, `produtos/${key}/costPrice`), custo);
        set(ref(db, `produtos/${key}/estoqueMinimo`), estoqueMinimo);
        set(ref(db, `produtos/${key}/category`), category);

        document.getElementById('modal-editar-produto').style.display = 'none';
        showAlert('Produto atualizado com sucesso!', 'success');
    });

    // PONTE INTEGRADA: Atalho do Pop-up para ir cadastrar direto em suprimentos
    document.getElementById('shortcut-create-insumo').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('modal-selecionar-insumo').style.display = 'none';
        switchTab('suprimentos', document.getElementById('tab-link-suprimentos'));
        document.getElementById('add-insumo-proximo-codigo').innerText = String(getNextCodigoInternoInsumo()).padStart(3, '0');
        document.getElementById('modal-cadastro-insumo').style.display = 'flex';
    });

    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));

    // TOOLTIP DOS ÍCONES DA SIDEBAR QUANDO COLAPSADA - mostra o nome da aba ao passar
    // o mouse. Usa um único elemento fixo no <body> (em vez de CSS ::after) para não
    // ser cortado pelo overflow:hidden da .sidebar.
    (function initSidebarTooltip() {
        const sidebar = document.getElementById('sidebar');
        const tooltip = document.createElement('div');
        tooltip.id = 'sidebar-tab-tooltip';
        document.body.appendChild(tooltip);

        sidebar.querySelectorAll('.tabs-lateral .tab-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if (!sidebar.classList.contains('collapsed')) return;
                const labelSpan = btn.querySelector('span');
                if (!labelSpan) return;
                tooltip.textContent = labelSpan.textContent.trim();
                const rect = btn.getBoundingClientRect();
                tooltip.style.transform = `translate(${rect.right + 12}px, ${rect.top + rect.height / 2}px) translateY(-50%)`;
                tooltip.classList.add('visible');
            });
            btn.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
        });

        // Some o tooltip caso o usuário reabra a sidebar (ou feche) enquanto o mouse
        // ainda está sobre um ícone, evitando que ele fique "preso" visível.
        document.getElementById('btn-toggle-sidebar').addEventListener('click', () => tooltip.classList.remove('visible'));
    })();

    // MODO CLARO/ESCURO - lê a preferência salva e aplica; salva de novo a cada troca
    (function initTema() {
        const temaSalvo = localStorage.getItem('temaPreferido');
        if (temaSalvo === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    })();
    document.getElementById('btn-toggle-tema').addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('temaPreferido', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('temaPreferido', 'dark');
        }
    });

    // ABRE/FECHA O PAINEL DO SINO DE ALERTAS - FECHA AO CLICAR FORA
    // O painel usa position:fixed (ver CSS), então sua posição é calculada aqui em JS
    // toda vez que é aberto, evitando que fique cortado pelo "overflow:hidden" da sidebar.
    document.getElementById('btn-sino-alertas').addEventListener('click', (e) => {
        e.stopPropagation();
        const btn = document.getElementById('btn-sino-alertas');
        const painel = document.getElementById('painel-alertas');
        const vaiAbrir = !painel.classList.contains('show');
        if (vaiAbrir) {
            const rect = btn.getBoundingClientRect();
            painel.style.top = (rect.bottom + 10) + 'px';
            painel.style.left = Math.max(10, rect.left) + 'px';
        }
        painel.classList.toggle('show', vaiAbrir);
    });
    window.addEventListener('resize', () => document.getElementById('painel-alertas').classList.remove('show'));

    // FILTROS DE BUSCA - ABA 2 (CATÁLOGO) E ABA 3 (SUPRIMENTOS) - os listeners reais ficam dentro de
    // initDatabaseSync(), pois é lá que renderCatalogoProdutos()/renderSuprimentosTable() existem
    // (chamá-las daqui de fora gera "function is not defined" e trava o restante do script).
    document.addEventListener('click', (e) => {
        const painel = document.getElementById('painel-alertas');
        if (painel.classList.contains('show') && !painel.contains(e.target) && e.target.id !== 'btn-sino-alertas') {
            painel.classList.remove('show');
        }
    });
    
    // Mapeia cada aba lateral pra um "slug" estável usado na URL (ex: #compras) - assim dá pra
    // atualizar a página (F5) ou compartilhar um link direto pra uma aba específica sem perder o
    // lugar. Funciona 100% no GitHub Pages porque é só um fragmento de URL (#...), não uma rota de
    // verdade - o navegador nunca manda isso pro servidor, então não precisa de nenhuma configuração
    // extra de hospedagem.
    const ABA_SLUG_PARA_TAB = {
        producao: { tabId: 'producao-tab', btnId: 'tab-link-producao' },
        catalogo: { tabId: 'sabores', btnId: 'tab-link-sabores' },
        estoque: { tabId: 'estoque-local-tab', btnId: 'tab-link-estoque-local' },
        suprimentos: { tabId: 'suprimentos', btnId: 'tab-link-suprimentos' },
        vendas: { tabId: 'vendas', btnId: 'tab-link-vendas' },
        clientes: { tabId: 'clientes-tab', btnId: 'tab-link-clientes' },
        caixa: { tabId: 'caixa-tab', btnId: 'tab-link-caixa' },
        compras: { tabId: 'compras-tab', btnId: 'tab-link-compras' },
        fornecedores: { tabId: 'fornecedores-tab', btnId: 'tab-link-fornecedores' },
        analise: { tabId: 'analise-tab', btnId: 'tab-link-analise' },
        qrcodes: { tabId: 'qrcodes-tab', btnId: 'tab-link-qrcodes' },
        precos: { tabId: 'precoslocal-tab', btnId: 'tab-link-precoslocal' },
        orcamentos: { tabId: 'orcamentos-tab', btnId: 'tab-link-orcamentos' }
    };
    const TAB_PARA_ABA_SLUG = {};
    Object.entries(ABA_SLUG_PARA_TAB).forEach(([slug, info]) => { TAB_PARA_ABA_SLUG[info.tabId] = slug; });

    function switchTab(tabId, targetBtn) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        targetBtn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        if(tabId !== 'producao-tab') showHistoricoSection();
        if(tabId !== 'vendas') {
            sectionFormularioVendas.style.display = 'none';
            sectionHistoricoVendas.style.display = 'block';
        }
        if(tabId === 'analise-tab' && window.abrirAnaliseView) window.abrirAnaliseView('cards');

        // Grava a aba atual na URL (usa replaceState em vez de mudar location.hash direto pra não
        // empilhar uma entrada de histórico a cada clique de aba, o que faria o botão "voltar" do
        // navegador ficar preso navegando entre abas em vez de sair da página).
        const slug = TAB_PARA_ABA_SLUG[tabId];
        if (slug && window.location.hash !== '#' + slug) {
            history.replaceState(null, '', '#' + slug);
        }
    }

    // GERA POP-UP DE ESCOLHA DAS MATÉRIAS PRIMAS (TABELA COM EAN/DESCRIÇÃO/CUSTO/UM/ESTOQUE,
    // FILTRÁVEL POR NOME OU CÓDIGO DE BARRAS - ÚTIL PARA BIPAR O EAN COM LEITOR DE CÓDIGO DE BARRAS)
    function renderPopUpInsumos() {
        const container = document.getElementById('pop-up-insumos-list');
        container.innerHTML = '';

        let suprimentosList = Object.values(allLoadedSuprimentos);

        if(suprimentosList.length === 0) {
            container.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color:#6a6d70; font-family: inherit;">Nenhuma matéria-prima localizada no sistema.</td></tr>`;
            return;
        }

        const termo = normalizarBusca(filtroBuscaPopUpInsumo);
        if(termo) {
            suprimentosList = suprimentosList.filter(sup => normalizarBusca(sup.name).includes(termo) || normalizarBusca(sup.barcode).includes(termo));
        }

        if(suprimentosList.length === 0) {
            container.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color:#6a6d70; font-family: inherit;">Nenhuma matéria-prima encontrada para "${filtroBuscaPopUpInsumo}".</td></tr>`;
            return;
        }

        suprimentosList.forEach(sup => {
            const tr = document.createElement('tr');
            tr.className = 'insumo-pop-row';
            tr.innerHTML = `
                <td class="col-ean">${sup.barcode ? sup.barcode : '<span style="color:var(--text-faint);">—</span>'}</td>
                <td class="col-descricao"><strong>${sup.name}</strong></td>
                <td>R$ ${formatMoeda(parseFloat(sup.price || 0))}</td>
                <td>${sup.unit || 'g'}</td>
                <td>${formatQuantidade(sup.quantity || 0)}</td>
            `;
            tr.addEventListener('click', () => {
                document.getElementById('ingredients-container').appendChild(createIngredientRow({
                    name: sup.name,
                    packageQty: sup.quantity || 1000,
                    unit: sup.unit || 'g',
                    price: sup.price || 0,
                    usedQty: 0
                }));
                document.getElementById('modal-selecionar-insumo').style.display = 'none';
                calculateCosts();
            });
            container.appendChild(tr);
        });
    }

    // FILTRO DE BUSCA DO POP-UP DE ESCOLHA DE INSUMO (ABA 1) - filtra ao digitar, pois é comum o
    // usuário bipar o EAN com leitor de código de barras (digita rápido e a lista já reage)
    const inputBuscaPopUpInsumo = document.getElementById('filtro-busca-pop-up-insumo');
    const btnLimparBuscaPopUpInsumo = document.getElementById('btn-limpar-busca-pop-up-insumo');
    inputBuscaPopUpInsumo.addEventListener('input', () => {
        filtroBuscaPopUpInsumo = inputBuscaPopUpInsumo.value;
        btnLimparBuscaPopUpInsumo.style.display = filtroBuscaPopUpInsumo ? 'flex' : 'none';
        renderPopUpInsumos();
    });
    btnLimparBuscaPopUpInsumo.addEventListener('click', () => {
        inputBuscaPopUpInsumo.value = '';
        filtroBuscaPopUpInsumo = '';
        btnLimparBuscaPopUpInsumo.style.display = 'none';
        renderPopUpInsumos();
        inputBuscaPopUpInsumo.focus();
    });

    // SUBMIT DO CADASTRO DE NOVA MATÉRIA PRIMA
    document.getElementById('form-cadastro-insumo').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('add-insumo-name').value.trim();
        const barcode = document.getElementById('add-insumo-barcode').value.trim();
        const unit = document.getElementById('add-insumo-um').value;
        const quantity = parseFloat(document.getElementById('add-insumo-qty').value) || 0;
        const price = parseFloat(document.getElementById('add-insumo-price').value) || 0;
        const estoqueMinimo = parseFloat(document.getElementById('add-insumo-estoque-minimo').value) || 0;

        if(!name) return;

        const codigoInterno = getNextCodigoInternoInsumo();
        const newRef = push(ref(db, 'suprimentos'));
        set(newRef, { name, barcode, unit, quantity, price, estoqueMinimo, codigoInterno })
        .then(() => {
            showAlert(`Matéria-Prima "${name}" cadastrada com sucesso! Código interno: ${String(codigoInterno).padStart(3,'0')}`, 'success');
            document.getElementById('modal-cadastro-insumo').style.display = 'none';
            document.getElementById('form-cadastro-insumo').reset();
        }).catch(err => showAlert("Erro ao cadastrar: " + err.message, 'danger'));
    });

    // Toda vez que o modal de cadastro é aberto, mostra o próximo código interno que será atribuído -
    // apenas informativo, o valor real é calculado de novo (e gravado) só no momento de salvar.
    document.getElementById('btn-trigger-modal-cadastro-insumo').addEventListener('click', () => {
        document.getElementById('add-insumo-proximo-codigo').innerText = String(getNextCodigoInternoInsumo()).padStart(3, '0');
    });

    function createIngredientRow(data = { name: '', price: '', usedQty: '' }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ingredient-row-wrapper';

        const div = document.createElement('div');
        div.className = 'input-row';

        const infoAtual = getEstoqueEUmAtual(data.name);

        div.innerHTML = `
            <div><input type="text" class="ing-name" value="${data.name}" readonly required style="background-color: #f5f6f7; cursor: not-allowed;"></div>
            <div><span class="badge-stock ing-estoque-display">${formatQuantidade(infoAtual.estoque)}</span></div>
            <div><span class="ing-um-display" style="font-weight:600; color:#33465a;">${infoAtual.um}</span></div>
            <div><input type="number" class="ing-price" value="${data.price}" step="0.01" required></div>
            <div><input type="number" class="ing-used-qty" value="${data.usedQty}" step="any" required></div>
            <div><button type="button" class="btn-danger btn-remove-row">✕</button></div>
        `;
        wrapper.appendChild(div);

        const warning = document.createElement('div');
        warning.className = 'ing-stock-warning';
        warning.style.cssText = 'display: none; color: var(--color-negative); font-size: 8.5pt; font-weight: 600; margin-top: 4px; padding-left: 5px;';
        warning.innerText = 'Quantidade acima do estoque disponível para este insumo.';
        wrapper.appendChild(warning);

        function checkStockWarning() {
            const info = getEstoqueEUmAtual(div.querySelector('.ing-name').value);
            const usedQty = parseFloat(div.querySelector('.ing-used-qty').value) || 0;
            warning.style.display = usedQty > info.estoque ? 'block' : 'none';
        }

        div.querySelector('.ing-used-qty').addEventListener('input', checkStockWarning);
        div.querySelector('.btn-remove-row').addEventListener('click', () => wrapper.remove());
        checkStockWarning();

        return wrapper;
    }

    // ATUALIZA OS CAMPOS DE ESTOQUE/UM (SOMENTE LEITURA) DE TODAS AS LINHAS QUANDO A ABA 3 SINCRONIZAR
    function refreshIngredientStockDisplays() {
        document.querySelectorAll('#ingredients-container .ingredient-row-wrapper').forEach(wrapper => {
            const row = wrapper.querySelector('.input-row');
            const name = row.querySelector('.ing-name').value;
            const info = getEstoqueEUmAtual(name);
            row.querySelector('.ing-estoque-display').innerText = formatQuantidade(info.estoque);
            row.querySelector('.ing-um-display').innerText = info.um;

            const usedQty = parseFloat(row.querySelector('.ing-used-qty').value) || 0;
            const warningEl = wrapper.querySelector('.ing-stock-warning');
            if(warningEl) warningEl.style.display = usedQty > info.estoque ? 'block' : 'none';
        });
    }

    function calculateCosts() {
        const recipeName = document.getElementById('recipe-name').value || 'Gourmet';
        const yieldQty = parseFloat(document.getElementById('yield').value) || 1;
        const sellingPrice = parseFloat(document.getElementById('selling-price').value) || 0;
        const rows = document.querySelectorAll('#ingredients-container .input-row');
        
        let totalRecipeCost = 0;
        let ingredientsArray = [];

        rows.forEach(row => {
            const name = row.querySelector('.ing-name').value;
            const info = getEstoqueEUmAtual(name);
            const packageQty = info.estoque;
            const unit = info.um;
            const price = parseFloat(row.querySelector('.ing-price').value);
            const usedQty = parseFloat(row.querySelector('.ing-used-qty').value);

            if (!name || isNaN(price) || isNaN(usedQty)) return;

            // "price" já é o CUSTO POR UNIDADE DE MEDIDA do insumo (R$ por grama/ml/unidade -
            // é exatamente o que fica gravado em suprimentos/{id}/price, tanto no cadastro manual
            // quanto na confirmação de compras). Por isso o custo do item na receita é sempre
            // "preço por UM x quantidade usada", SEM dividir pelo estoque atual: o estoque muda a
            // cada consumo/compra e não tem relação com o preço unitário já calculado. Dividir por
            // ele (como era feito antes) fazia o custo cair para R$ 0,00 sempre que o insumo estivesse
            // zerado no estoque, e ficar incorreto sempre que o estoque variasse.
            const itemCost = price * usedQty;
            totalRecipeCost += itemCost;
            ingredientsArray.push({ name, packageQty, unit, price, usedQty, cost: itemCost });
        });

        const costPerUnit = totalRecipeCost / yieldQty;
        currentCalculatedData = { name: recipeName, yieldQty, sellingPrice, totalCost: totalRecipeCost, costPerUnit, ingredients: ingredientsArray };

        document.getElementById('res-total-recipe').innerText = `R$ ${formatMoeda(totalRecipeCost)}`;
        document.getElementById('res-cost-per-unit').innerText = `R$ ${formatMoeda(costPerUnit)}`;
        document.getElementById('res-profit-per-unit').innerText = `R$ ${formatMoeda((sellingPrice - costPerUnit))}`;
        
        document.getElementById('output-empty').style.display = 'none';
        document.getElementById('output-results').style.display = 'block';
    }

    function saveProductionOrder() {
        calculateCosts();
        if (!currentCalculatedData) return;

        let numPedido = getNextPedidoNumero();
        let oldStatus = "RASCUNHO";
        let oldYield = 0;
        let oldLocalProducaoKey = null;

        if (currentProductionId) {
            numPedido = allLoadedProductions[currentProductionId].pedidoNumero;
            oldStatus = allLoadedProductions[currentProductionId].status || "RASCUNHO";
            oldYield = allLoadedProductions[currentProductionId].yieldQty || 0;
            oldLocalProducaoKey = allLoadedProductions[currentProductionId].localProducaoKey || null;
        }

        // Local de destino desta OP: ao produzir pela 1ª vez usa o que está selecionado agora; ao reverter
        // uma OP já produzida, usa sempre o local que já estava gravado nela (o estoque já está lá).
        const localDestinoSelecionado = document.getElementById('producao-local-destino').value;

        // BLOQUEIO EXCLUSIVO SOLICITADO: Mudança de CONFIRMADO para RASCUNHO/CANCELADO se não houver saldo livre
        if (oldStatus === "PRODUZIDO" && (selectedStatus === "RASCUNHO" || selectedStatus === "CONFIRMADO" || selectedStatus === "CANCELADO")) {
            const matchProduct = Object.values(allLoadedProducts).find(p => p.name.toLowerCase() === currentCalculatedData.name.toLowerCase());
            const localDaProducao = oldLocalProducaoKey || localDestinoSelecionado;
            const currentStock = matchProduct ? getEstoqueNoLocal(matchProduct, localDaProducao) : 0;

            if (currentStock < oldYield) {
                showAlert(`Você produziu ${oldYield} unidades desta OP em "${nomeDoLocal(localDaProducao)}", porém o estoque atual do produto lá é de apenas ${currentStock} unidades (já houve saídas/vendas/transferências). Não é possível reverter ou cancelar esta produção.`, 'danger', 'Operação Negada');
                return;
            }

            // Se tem saldo, devolve os insumos ao estoque e abate o produto final (no local onde ele entrou)
            if (matchProduct && localDaProducao) {
                const matchProductKey = Object.keys(allLoadedProducts).find(k => allLoadedProducts[k].name.toLowerCase() === currentCalculatedData.name.toLowerCase());
                aplicarDeltaEstoque(matchProductKey, localDaProducao, -oldYield);
            }

            if (allLoadedProductions[currentProductionId] && allLoadedProductions[currentProductionId].ingredients) {
                allLoadedProductions[currentProductionId].ingredients.forEach(ing => {
                    const matchEntry = Object.entries(allLoadedSuprimentos).find(([k, v]) => v.name.toLowerCase() === ing.name.toLowerCase());
                    if (matchEntry) {
                        set(ref(db, `suprimentos/${matchEntry[0]}/quantity`), matchEntry[1].quantity + ing.usedQty);
                    }
                });
            }
        }

        // Fluxo normal: Entrando no status PRODUZIDO pela primeira vez
        if (selectedStatus === "PRODUZIDO" && oldStatus !== "PRODUZIDO") {
            if (!localDestinoSelecionado) { showAlert('Selecione o local de destino do estoque produzido.', 'warning'); return; }

            let canProduce = true;
            let missingReport = "";

            currentCalculatedData.ingredients.forEach(ing => {
                const matchSup = Object.values(allLoadedSuprimentos).find(s => s.name.toLowerCase() === ing.name.toLowerCase());
                if (!matchSup || matchSup.quantity < ing.usedQty) {
                    canProduce = false;
                    missingReport += `- ${ing.name} (Precisa: ${ing.usedQty}, tem: ${(matchSup?.quantity || 0).toFixed(1)})\n`;
                }
            });

            if (!canProduce) { showAlert(`Insumos insuficientes no estoque comercial!\n\n${missingReport}`, 'danger'); return; }

            currentCalculatedData.ingredients.forEach(ing => {
                const matchEntry = Object.entries(allLoadedSuprimentos).find(([k, v]) => v.name.toLowerCase() === ing.name.toLowerCase());
                if (matchEntry) set(ref(db, `suprimentos/${matchEntry[0]}/quantity`), matchEntry[1].quantity - ing.usedQty);
            });

            const matchProduct = Object.entries(allLoadedProducts).find(([k, v]) => v.name.toLowerCase() === currentCalculatedData.name.toLowerCase());
            if (matchProduct) {
                aplicarDeltaEstoque(matchProduct[0], localDestinoSelecionado, currentCalculatedData.yieldQty);
            } else {
                const newRef = push(ref(db, 'produtos'));
                const mapaInicial = {};
                localKeysOrdenados().forEach(k => { mapaInicial[k] = 0; });
                mapaInicial[localDestinoSelecionado] = currentCalculatedData.yieldQty;
                set(newRef, { name: currentCalculatedData.name, readyStock: currentCalculatedData.yieldQty, estoquePorLocal: mapaInicial, sellingPrice: currentCalculatedData.sellingPrice });
            }
        }

        // Guarda o local desta OP: ao produzir pela 1ª vez, grava o local escolhido agora; se já estava
        // produzida (ex: só editando outros campos), mantém o local já registrado nela.
        const localParaGravar = (oldStatus === "PRODUZIDO") ? oldLocalProducaoKey : localDestinoSelecionado;

        const targetRef = currentProductionId ? ref(db, `historico_producao/${currentProductionId}`) : push(ref(db, 'historico_producao'));
        set(targetRef, {
            pedidoNumero: numPedido, name: currentCalculatedData.name, costPerUnit: currentCalculatedData.costPerUnit,
            totalCost: currentCalculatedData.totalCost, yieldQty: currentCalculatedData.yieldQty, status: selectedStatus,
            ingredients: currentCalculatedData.ingredients, timestamp: Date.now(),
            localProducaoKey: localParaGravar || null, localProducaoNome: localParaGravar ? nomeDoLocal(localParaGravar) : null
        }).then(() => {
            showAlert(`Ordem de Produção #${String(numPedido).padStart(3, '0')} salva com sucesso.`, 'success');
            showHistoricoSection();
        });
    }

    window.openProductionOrder = function(key) {
        const order = allLoadedProductions[key];
        if(!order) return;
        currentProductionId = key;
        document.getElementById('pedido-numero-display').innerText = `Pedido #${String(order.pedidoNumero).padStart(3, '0')}`;
        updateStatusSelectorVisual(order.status || "RASCUNHO");
        populateRecipeNameSelect(order.name);
        document.getElementById('yield').value = order.yieldQty;

        // Se a OP já foi PRODUZIDA, o local de destino fica travado (o estoque já foi lançado lá;
        // mudar de local aqui exigiria reverter e produzir de novo). Antes disso, é livre para escolher.
        popularTodosSelectsDeLocal();
        const selLocalProducaoEdicao = document.getElementById('producao-local-destino');
        selLocalProducaoEdicao.value = order.localProducaoKey || localPadraoKey || '';
        selLocalProducaoEdicao.disabled = (order.status === 'PRODUZIDO');
        
        const container = document.getElementById('ingredients-container');
        container.innerHTML = '';
        if (order.ingredients) {
            Object.values(order.ingredients).forEach(ing => container.appendChild(createIngredientRow(ing)));
        }
        showCalculosSection();
        calculateCosts();
    };

    // POPULA A LISTA SUSPENSA DE PRODUTOS NA ORDEM DE PRODUÇÃO (EVITA DUPLICIDADE DE CADASTRO)
    function populateRecipeNameSelect(forcedName) {
        const select = document.getElementById('recipe-name');
        const currentValue = forcedName !== undefined ? forcedName : select.value;
        select.innerHTML = '<option value="">-- Selecione um Produto --</option>';

        Object.values(allLoadedProducts)
            .map(p => p.name)
            .sort((a, b) => a.localeCompare(b))
            .forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.innerText = name;
                select.appendChild(opt);
            });

        if(currentValue && !Array.from(select.options).some(o => o.value === currentValue)) {
            const opt = document.createElement('option');
            opt.value = currentValue;
            opt.innerText = `${currentValue} (produto removido do catálogo)`;
            select.appendChild(opt);
        }

        select.value = currentValue || '';
    }

    function resetToDefaultIngredients() {
        const container = document.getElementById('ingredients-container');
        container.innerHTML = '';
        defaultIngredients.forEach(ing => container.appendChild(createIngredientRow(ing)));
        calculateCosts();
    }

    window.excluirProdutoCatalogo = function(key) {
        const produto = allLoadedProducts[key];
        if (!produto) return;

        const opVinculada = Object.values(allLoadedProductions).some(op =>
            op.name.toLowerCase() === produto.name.toLowerCase() && (op.status === "CONFIRMADO" || op.status === "PRODUZIDO")
        );
        const vendaVinculada = Object.values(allLoadedSales).some(v =>
            (v.status === "CONFIRMADA" || v.status === "PAGO") && Array.isArray(v.items) && v.items.some(i => i.productKey === key)
        );

        if (opVinculada || vendaVinculada) {
            showAlert("Não é possível excluir este produto pois ele já tem transações vinculadas (produção e/ou vendas).", 'danger');
            return;
        }

        showConfirm(`Deseja realmente excluir o produto "${produto.name}" do catálogo?`, 'danger', 'Excluir Produto').then(ok => {
            if (!ok) return;
            window.firebaseRemove(window.firebaseRef(window.dbReference, 'produtos/' + key))
                .then(() => showAlert('Produto removido com sucesso!', 'success'))
                .catch(err => showAlert('Erro ao excluir: ' + err.message, 'danger'));
        });
    };

    document.getElementById('btn-add-new-um').addEventListener('click', () => {
        const input = document.getElementById('new-um-input');
        const value = input.value.trim().toLowerCase();
        if(!value) return;
        push(ref(db, 'unidades_medida'), { sigla: value });
        input.value = '';
    });

    window.removeUM = function(key) { remove(ref(db, `unidades_medida/${key}`)); };

    document.getElementById('btn-add-new-categoria').addEventListener('click', () => {
        const input = document.getElementById('new-categoria-input');
        const value = input.value.trim();
        if(!value) return;
        push(ref(db, 'categorias_produtos'), { nome: value });
        input.value = '';
    });

    window.removeCategoriaProduto = function(key) { remove(ref(db, `categorias_produtos/${key}`)); };

    document.getElementById('form-ajuste-estoque').addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('modal-select-insumo').value;
        const qty = parseFloat(document.getElementById('modal-novo-estoque').value);
        const price = parseFloat(document.getElementById('modal-novo-custo').value);

        if(!key) return;
        set(ref(db, `suprimentos/${key}/quantity`), qty);
        set(ref(db, `suprimentos/${key}/price`), price);

        document.getElementById('modal-ajuste-estoque').style.display = 'none';
        document.getElementById('form-ajuste-estoque').reset();
        showAlert("Ajuste manual de estoque/custo processado!", 'success');
    });

    window.openModalEditarInsumo = function(key) {
        const item = allLoadedSuprimentos[key];
        if(!item) return;
        document.getElementById('edit-insumo-key').value = key;
        document.getElementById('edit-insumo-codigo-interno').innerText = String(parseInt(item.codigoInterno) || 0).padStart(3, '0');
        document.getElementById('edit-insumo-name').value = item.name;
        document.getElementById('edit-insumo-barcode').value = item.barcode || '';
        document.getElementById('edit-insumo-um').value = item.unit || 'g';
        document.getElementById('edit-insumo-estoque-minimo').value = parseFloat(item.estoqueMinimo || 0);
        document.getElementById('modal-editar-insumo').style.display = 'flex';
    };

    document.getElementById('form-editar-insumo').addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('edit-insumo-key').value;
        const name = document.getElementById('edit-insumo-name').value;
        const barcode = document.getElementById('edit-insumo-barcode').value.trim();
        const um = document.getElementById('edit-insumo-um').value;
        const estoqueMinimo = parseFloat(document.getElementById('edit-insumo-estoque-minimo').value) || 0;

        set(ref(db, `suprimentos/${key}/name`), name);
        set(ref(db, `suprimentos/${key}/barcode`), barcode);
        set(ref(db, `suprimentos/${key}/unit`), um);
        set(ref(db, `suprimentos/${key}/estoqueMinimo`), estoqueMinimo);

        document.getElementById('modal-editar-insumo').style.display = 'none';
        showAlert("Dados cadastrais do insumo atualizados.", 'success');
    });

    window.excluirInsumoComercial = function(key) {
        const insumo = allLoadedSuprimentos[key];
        if (!insumo) return;

        // Mesma lógica de segurança já usada pra excluir produto do catálogo: só permite excluir se
        // essa matéria-prima não tiver histórico real vinculado (compra registrada e/ou produção
        // confirmada/produzida que a consumiu). Sem essa checagem, excluir um insumo já usado deixaria
        // relatórios antigos (custos, margem, etc.) com referência a um item que não existe mais.
        const compraVinculada = Object.values(allLoadedComprasSuprimentos).some(compra =>
            (compra.itens || []).some(it => it.insumoKey === key)
        );
        const producaoVinculada = Object.values(allLoadedProductions).some(op =>
            (op.status === "CONFIRMADO" || op.status === "PRODUZIDO") &&
            Object.values(op.ingredients || {}).some(ing => (ing.name || '').toLowerCase() === insumo.name.toLowerCase())
        );

        if (compraVinculada || producaoVinculada) {
            showAlert("Não é possível excluir esta matéria-prima pois ela já tem transações vinculadas (compras e/ou produções).", 'danger');
            return;
        }

        showConfirm("Deseja deletar este insumo permanentemente do estoque?", 'danger', 'Excluir Insumo').then(ok => {
            if (ok) remove(ref(db, `suprimentos/${key}`));
        });
    };

    // --- CARRINHO PDV MULTI-ITENS ---
    // Monta a lista de produtos disponíveis para vender, considerando o LOCAL escolhido no topo do
    // formulário: só lista produtos com estoque disponível naquele local (evita vender item que não tem
    // ali) e ordena da maior para a menor quantidade em estoque.
    function getListaProdutosDisponiveisVenda(selectedKey) {
        const localVenda = document.getElementById('vendas-local-selecionado').value;
        let lista = Object.entries(allLoadedProducts).map(([key, p]) => ({
            key, name: p.name,
            estoque: localVenda ? getEstoqueNoLocal(p, localVenda) : getEstoqueTotal(p)
        }));
        // Mantém sempre o produto já selecionado nesta linha na lista, mesmo sem estoque no local (senão a
        // linha ficaria "quebrada" ao editar uma venda antiga ou trocar de local depois de já escolher).
        lista = lista.filter(item => item.estoque > 0 || item.key === selectedKey);
        lista.sort((a, b) => b.estoque - a.estoque || a.name.localeCompare(b.name, 'pt-BR'));
        return lista;
    }

    // O <select> nativo abaixo guarda o valor real (usado por todo o resto do código) mas fica oculto;
    // a quantidade em estoque só aparece na LISTA suspensa customizada enquanto o usuário está
    // escolhendo (função montarListaPickerProduto) - depois de escolhido, mostra só o nome do produto.
    function montarOpcoesProdutoPDV(selectedKey) {
        const lista = getListaProdutosDisponiveisVenda(selectedKey);
        let options = '<option value="">-- Escolha o Produto --</option>';
        lista.forEach(item => {
            options += `<option value="${item.key}" ${selectedKey === item.key ? 'selected' : ''}>${item.name}</option>`;
        });
        return options;
    }

    // Reconstrói a lista suspensa customizada (nome + estoque, ordenada) e o texto do botão-gatilho
    // (só o nome, sem quantidade) de uma linha de venda.
    function montarListaPickerProduto(tr) {
        const selectEl = tr.querySelector('.pdv-item-select');
        const trigger = tr.querySelector('.pdv-product-picker-trigger');
        const listEl = tr.querySelector('.pdv-product-picker-list');
        const selectedKey = selectEl.value;
        const lista = getListaProdutosDisponiveisVenda(selectedKey);

        trigger.textContent = selectedKey && allLoadedProducts[selectedKey] ? allLoadedProducts[selectedKey].name : '-- Escolha o Produto --';

        listEl.innerHTML = lista.map(item => `
            <div class="pdv-product-picker-item ${item.key === selectedKey ? 'selected' : ''}" data-key="${item.key}">
                <span>${item.name}</span>
                <span class="pdv-product-picker-qty">${formatQuantidade(item.estoque)} un.</span>
            </div>
        `).join('') || '<div class="pdv-product-picker-empty">Nenhum produto com estoque neste local.</div>';
    }

    function createSaleItemRow(initialData = { productKey: '', quantity: 1, discountType: '$', discountValue: 0 }) {
        // Usa um fragmento com dois <tr> simples para não aninhar <tbody> dentro de <tbody>
        const fragment = document.createDocumentFragment();

        const tr = document.createElement('tr');
        tr.className = 'sales-item-row';

        const options = montarOpcoesProdutoPDV(initialData.productKey);

        tr.innerHTML = `
            <td style="position:relative;">
                <div class="pdv-product-picker">
                    <button type="button" class="pdv-product-picker-trigger">-- Escolha o Produto --</button>
                    <div class="pdv-product-picker-list"></div>
                </div>
                <select class="pdv-item-select" required style="display:none;">${options}</select>
            </td>
            <td><span class="pdv-item-estoque badge-stock" style="display:inline-block;">--</span></td>
            <td><input type="number" class="pdv-item-qty" value="${initialData.quantity}" min="1" required style="width: 80px;"></td>
            <td><input type="text" class="pdv-item-price" value="R$ 0,00" disabled style="background:#eef1f3; font-weight:600;"></td>
            <td>
                <div style="display:flex; gap:4px;">
                    <input type="number" class="pdv-item-disc-val" value="${initialData.discountValue}" min="0" ${initialData.discountType === '%' ? 'max="100"' : ''} step="any" style="width:70px;">
                    <select class="pdv-item-disc-type" style="width:55px; padding:2px;"><option value="$" ${initialData.discountType === '$' ? 'selected' : ''}>$</option><option value="%" ${initialData.discountType === '%' ? 'selected' : ''}>%</option></select>
                </div>
            </td>
            <td><input type="text" class="pdv-item-total" value="R$ 0,00" disabled style="background:#eef1f3; font-weight:bold; color:#0854a0;"></td>
            <td style="text-align:center;"><button type="button" class="btn-danger btn-remove-sale-row" style="height:32px; padding:0 10px;">✕</button></td>
        `;

        const warningTr = document.createElement('tr');
        warningTr.className = 'sale-warning-row';
        warningTr.innerHTML = `<td colspan="7" style="padding: 0 4px 4px; border: none;"><div class="pdv-stock-warning" style="display:none; color:var(--color-negative); font-size:8.5pt; font-weight:600;">Produto sem estoque suficiente para esta quantidade.</div></td>`;

        fragment.appendChild(tr);
        fragment.appendChild(warningTr);

        const selectEl = tr.querySelector('.pdv-item-select');
        const qtyEl = tr.querySelector('.pdv-item-qty');
        const discValEl = tr.querySelector('.pdv-item-disc-val');
        const discTypeEl = tr.querySelector('.pdv-item-disc-type');
        const estoqueDisplay = tr.querySelector('.pdv-item-estoque');
        const warningEl = warningTr.querySelector('.pdv-stock-warning');
        const pickerTrigger = tr.querySelector('.pdv-product-picker-trigger');
        const pickerList = tr.querySelector('.pdv-product-picker-list');

        montarListaPickerProduto(tr);

        // Fecha qualquer outra lista suspensa de produto aberta em outras linhas antes de abrir esta.
        function fecharTodasAsListasDeProduto() {
            document.querySelectorAll('.pdv-product-picker-list.show').forEach(l => l.classList.remove('show'));
        }

        pickerTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const jaAberta = pickerList.classList.contains('show');
            fecharTodasAsListasDeProduto();
            if (!jaAberta) {
                montarListaPickerProduto(tr); // reconstrói na hora de abrir, garante estoque atualizado
                pickerList.classList.add('show');
            }
        });

        pickerList.addEventListener('click', (e) => {
            const item = e.target.closest('.pdv-product-picker-item');
            if (!item) return;
            selectEl.value = item.getAttribute('data-key');
            pickerTrigger.textContent = allLoadedProducts[selectEl.value] ? allLoadedProducts[selectEl.value].name : '-- Escolha o Produto --';
            pickerList.classList.remove('show');
            selectEl.dispatchEvent(new Event('change'));
        });

        function getEstoqueProduto(key) {
            const prod = allLoadedProducts[key];
            if (!prod) return 0;
            const localVenda = document.getElementById('vendas-local-selecionado').value;
            return localVenda ? getEstoqueNoLocal(prod, localVenda) : getEstoqueTotal(prod);
        }

        const triggerUpdate = () => {
            const prodKey = selectEl.value;
            const localVendaAtivo = document.getElementById('vendas-local-selecionado').value;
            let price = 0;
            if(allLoadedProducts[prodKey]) {
                price = getPrecoProdutoNoLocal(allLoadedProducts[prodKey], localVendaAtivo);
            }
            tr.querySelector('.pdv-item-price').value = `R$ ${formatMoeda(price)}`;

            const estoque = getEstoqueProduto(prodKey);
            estoqueDisplay.innerText = prodKey ? formatQuantidade(estoque) : '--';

            const qty = parseInt(qtyEl.value) || 0;
            warningEl.style.display = (prodKey && qty > estoque) ? 'block' : 'none';

            const sub = price * qty;
            let dVal = parseFloat(discValEl.value) || 0;
            if (discTypeEl.value === '%' && dVal > 100) { dVal = 100; discValEl.value = 100; }

            let finalItemDiscount = 0;
            if(discTypeEl.value === '$') {
                finalItemDiscount = dVal;
            } else {
                finalItemDiscount = sub * (dVal / 100);
            }

            const itemNetTotal = Math.max(0, sub - finalItemDiscount);
            tr.querySelector('.pdv-item-total').value = `R$ ${formatMoeda(itemNetTotal)}`;
            
            calculatePdvTotals();
        };

        selectEl.addEventListener('change', triggerUpdate);
        qtyEl.addEventListener('input', triggerUpdate);
        discValEl.addEventListener('input', () => {
            if (discTypeEl.value === '%' && parseFloat(discValEl.value) > 100) discValEl.value = 100;
            triggerUpdate();
        });
        discTypeEl.addEventListener('change', () => {
            discValEl.max = discTypeEl.value === '%' ? '100' : '';
            if (discTypeEl.value === '%' && parseFloat(discValEl.value) > 100) discValEl.value = 100;
            triggerUpdate();
        });
        
        tr.querySelector('.btn-remove-sale-row').addEventListener('click', () => {
            // Remove os dois tr (linha de dados + linha de aviso)
            if(tr.parentNode) tr.parentNode.removeChild(tr);
            if(warningTr.parentNode) warningTr.parentNode.removeChild(warningTr);
            calculatePdvTotals();
        });

        setTimeout(triggerUpdate, 50);
        return fragment;
    }

    function calculatePdvTotals() {
        const rows = document.querySelectorAll('#sales-items-container-body .sales-item-row');
        let totalBrutoGeral = 0;
        let totalDescontoGeral = 0;
        const localVendaAtivo = document.getElementById('vendas-local-selecionado').value;

        rows.forEach(row => {
            const prodKey = row.querySelector('.pdv-item-select').value;
            if(!allLoadedProducts[prodKey]) return;

            const price = getPrecoProdutoNoLocal(allLoadedProducts[prodKey], localVendaAtivo);
            const qty = parseInt(row.querySelector('.pdv-item-qty').value) || 0;
            const sub = price * qty;
            
            const dVal = Math.min(parseFloat(row.querySelector('.pdv-item-disc-val').value) || 0, row.querySelector('.pdv-item-disc-type').value === '%' ? 100 : Infinity);
            let itemDisc = 0;
            if(row.querySelector('.pdv-item-disc-type').value === '$') {
                itemDisc = dVal;
            } else {
                itemDisc = sub * (dVal / 100);
            }

            totalBrutoGeral += sub;
            totalDescontoGeral += itemDisc;
        });

        const totalLiquidoGeral = Math.max(0, totalBrutoGeral - totalDescontoGeral);

        document.getElementById('pdv-summary-subtotal').innerText = `R$ ${formatMoeda(totalBrutoGeral)}`;
        document.getElementById('pdv-summary-discount').innerText = `R$ ${formatMoeda(totalDescontoGeral)}`;
        document.getElementById('pdv-summary-total-net').innerText = `R$ ${formatMoeda(totalLiquidoGeral)}`;
        atualizarResumoPagamentoNaVenda();
    }

    document.getElementById('btn-pdv-add-product-row').addEventListener('click', () => {
        document.getElementById('sales-items-container-body').appendChild(createSaleItemRow());
    });

    // EXECUÇÃO E SALVAMENTO DE VENDA COM TRATAMENTO DINÂMICO DE ESTOQUE
    document.getElementById('btn-execute-sale').addEventListener('click', () => {
      try {
        if (isSaleLocked) return; // trava extra de segurança: vendas PAGAS nunca são salvas

        const clientName = document.getElementById('sales-client-name').value.trim() || 'CONSUMIDOR FINAL';
        const salesDate = dataBRparaISO(document.getElementById('sales-date').value);
        const salesDueDate = dataBRparaISO(document.getElementById('sales-due-date').value);

        if(!salesDate || !salesDueDate) { showAlert("Informe as datas no formato dd/mm/aaaa.", 'warning'); return; }
        if(salesDueDate < salesDate) { showAlert("A data de vencimento não pode ser anterior à data da venda. Corrija antes de salvar.", 'warning'); return; }
        
        const rows = document.querySelectorAll('#sales-items-container-body .sales-item-row');
        if(rows.length === 0) { showAlert("Adicione pelo menos um produto na tabela!", 'warning'); return; }

        // VALIDAÇÃO OBRIGATÓRIA: se o status for PAGO, o pagamento precisa ter sido confirmado no pop-up
        if (selectedSalesStatus === 'PAGO' && !pendingPagamento) {
            showAlert('Confirme os dados de pagamento clicando novamente no status "Pago".', 'warning', 'Pagamento Não Confirmado');
            return;
        }

        // Local (físico) de onde esta venda debita estoque. Numa venda nova é o local escolhido no formulário;
        // numa venda existente sendo editada, o campo fica travado no local que já estava registrado nela.
        let localVendaKeyAtual;
        if (currentSaleId && allLoadedSales[currentSaleId]) {
            localVendaKeyAtual = allLoadedSales[currentSaleId].localVendaKey || document.getElementById('vendas-local-selecionado').value;
        } else {
            localVendaKeyAtual = document.getElementById('vendas-local-selecionado').value;
        }
        if (!localVendaKeyAtual) { showAlert('Selecione o local desta venda.', 'warning'); return; }

        let checkoutItems = [];
        let totalValue = 0;
        let totalProfit = 0;
        let totalQuantity = 0;

        // Status anterior e itens anteriores (para calcular diff de estoque)
        let oldStatus = "RASCUNHO";
        let oldItems = [];
        if (currentSaleId && allLoadedSales[currentSaleId]) {
            oldStatus = allLoadedSales[currentSaleId].status || "RASCUNHO";
            oldItems = allLoadedSales[currentSaleId].items || [];
        }

        // Se o status anterior já abatia estoque (CONFIRMADA ou PAGO), devolve temporariamente em memória
        // (no local desta venda) para poder validar e recalcular com os novos valores
        const oldAbatia = (oldStatus === "CONFIRMADA" || oldStatus === "PAGO");
        if (oldAbatia) {
            oldItems.forEach(item => ajustarEstoqueMemoria(item.productKey, localVendaKeyAtual, item.quantity));
        }
        const restaurarEstoqueEmMemoria = () => {
            if (oldAbatia) oldItems.forEach(item => ajustarEstoqueMemoria(item.productKey, localVendaKeyAtual, -item.quantity));
        };

        // Monta os itens e valida estoque se o novo status abate
        const novoAbate = (selectedSalesStatus === "CONFIRMADA" || selectedSalesStatus === "PAGO");

        // CORREÇÃO DE BUG: quando o MESMO produto aparece em mais de uma linha da venda, cada linha precisa
        // descontar do estoque "restante" já reservado pelas linhas anteriores (e não sempre do estoque total
        // do produto) - do contrário, era possível vender mais unidades do que havia em estoque somando as linhas.
        const estoqueRestanteTemp = {};

        for(let row of rows) {
            const prodKey = row.querySelector('.pdv-item-select').value;
            if(!prodKey) { 
                showAlert("Selecione os produtos de todas as linhas!", 'warning'); 
                restaurarEstoqueEmMemoria();
                return; 
            }
            
            const qtySold = parseInt(row.querySelector('.pdv-item-qty').value) || 0;
            const prod = allLoadedProducts[prodKey];

            // CORREÇÃO DE BUG: produto não encontrado no catálogo (ex: excluído, ou ainda não carregou).
            // Sem essa checagem o clique quebrava aqui em silêncio (mesma correção já existente no mobile).
            if (!prod) {
                showAlert('Um dos produtos desta venda não foi encontrado no catálogo. Selecione o produto novamente antes de salvar.', 'warning');
                restaurarEstoqueEmMemoria();
                return;
            }

            // CORREÇÃO DE BUG: quantidade zerada/inválida não pode ser lançada como se fosse uma venda válida
            if (qtySold < 1) {
                showAlert("Informe uma quantidade válida (mínimo 1) para todos os produtos da venda.", 'warning');
                restaurarEstoqueEmMemoria();
                return;
            }

            if (novoAbate) {
                if (!(prodKey in estoqueRestanteTemp)) estoqueRestanteTemp[prodKey] = getEstoqueNoLocal(prod, localVendaKeyAtual);
                if (estoqueRestanteTemp[prodKey] < qtySold) {
                    showAlert(`Estoque insuficiente em ${nomeDoLocal(localVendaKeyAtual)}: ${prod.name}. Disponível: ${formatQuantidade(estoqueRestanteTemp[prodKey])} un.`, 'warning');
                    restaurarEstoqueEmMemoria();
                    return;
                }
                estoqueRestanteTemp[prodKey] -= qtySold;
            }

            const price = getPrecoProdutoNoLocal(prod, localVendaKeyAtual);
            const sub = price * qtySold;
            const dType = row.querySelector('.pdv-item-disc-type').value;
            const dVal = Math.min(parseFloat(row.querySelector('.pdv-item-disc-val').value) || 0, dType === '%' ? 100 : Infinity);

            let itemDisc = dType === '$' ? dVal : sub * (dVal / 100);
            const rowNet = Math.max(0, sub - itemDisc);
            // CORREÇÃO DE BUG: antes recalculava o custo na mão (só última Ordem de Produção), ignorando o
            // custo manual (costPrice) cadastrado na Aba 2. Agora usa a mesma função oficial usada em todo
            // o resto do sistema, garantindo que o lucro da venda respeite o custo manual quando houver.
            const costBase = getCustoEfetivoProduto(prod);

            totalValue += rowNet;
            totalProfit += rowNet - (costBase * qtySold);
            totalQuantity += qtySold;

            checkoutItems.push({
                productKey: prodKey, productName: prod.name, quantity: qtySold,
                sellingPrice: price, discountType: dType, discountValue: dVal, totalItemNet: rowNet
            });
        }

        // Se a venda muda para PAGO, revalida se o pagamento confirmado no pop-up ainda cobre o total atual
        // (o total pode ter mudado se o usuário alterou produtos depois de confirmar o pagamento)
        let valorPago = 0, creditoUsado = 0, creditoGerado = 0, contaPagamentoKey = null, contaPagamentoNome = null;
        if (selectedSalesStatus === 'PAGO') {
            valorPago = pendingPagamento.valorPago;
            creditoUsado = pendingPagamento.creditoUsado;
            const totalCoberto = valorPago + creditoUsado;
            if (totalCoberto < totalValue - 0.001) {
                showAlert('O total da venda mudou após a confirmação do pagamento. Clique novamente em "Pago" para reconfirmar os valores.', 'warning');
                restaurarEstoqueEmMemoria();
                return;
            }
            creditoGerado = parseFloat(Math.max(0, totalCoberto - totalValue).toFixed(2));

            // Revalida a conta de recebimento: precisa existir sempre que há dinheiro novo entrando
            if (valorPago > 0) {
                if (!pendingPagamento.contaKey || !allLoadedContas[pendingPagamento.contaKey]) {
                    showAlert('Selecione novamente a conta que vai receber o valor pago. Clique em "Pago" para reconfirmar.', 'warning');
                    restaurarEstoqueEmMemoria();
                    return;
                }
                contaPagamentoKey = pendingPagamento.contaKey;
                contaPagamentoNome = allLoadedContas[contaPagamentoKey].name;
            }
        }

        // Desfaz a simulação em memória feita lá em cima (serviu só para a pré-validação visual) - a
        // baixa real agora acontece por transação atômica direto no servidor (ver mais abaixo), então o
        // cache local não deve ficar com esse ajuste "solto" antes da transação confirmar.
        restaurarEstoqueEmMemoria();

        // Calcula o delta líquido de estoque por produto (devolve o que a venda antiga tinha baixado +
        // desconta o que a venda nova vai baixar).
        const deltaPorProdutoVenda = {};
        if (oldAbatia) {
            oldItems.forEach(item => { deltaPorProdutoVenda[item.productKey] = (deltaPorProdutoVenda[item.productKey] || 0) + item.quantity; });
        }
        if (novoAbate) {
            checkoutItems.forEach(item => { deltaPorProdutoVenda[item.productKey] = (deltaPorProdutoVenda[item.productKey] || 0) - item.quantity; });
        }

        // CORREÇÃO DE BUG: a partir daqui a venda já passou por todas as validações e vai gravar no
        // Firebase - trava o botão pra dar feedback imediato e evitar clique duplo (mesmo padrão do mobile).
        const btnSalvarEl = document.getElementById('btn-execute-sale');
        const textoOriginalBotao = btnSalvarEl.innerText;
        btnSalvarEl.disabled = true;
        btnSalvarEl.innerText = '💾 Verificando estoque...';
        const restaurarBotaoSalvar = () => { btnSalvarEl.disabled = false; btnSalvarEl.innerText = textoOriginalBotao; };

        // Aplica a baixa/devolução de estoque de forma ATÔMICA (transação no Firebase - ver
        // aplicarDeltasEstoqueAtomico), o que protege contra duas vendas simultâneas em dispositivos
        // diferentes (ex: PC + mobile no mesmo local) descontando a mesma unidade de estoque duas
        // vezes. Só prossegue e grava a venda depois que o estoque for confirmado com sucesso.
        aplicarDeltasEstoqueAtomico(deltaPorProdutoVenda, localVendaKeyAtual).then(() => {
        btnSalvarEl.innerText = '💾 Salvando...';
        const payload = {
            clientName, salesDate, salesDueDate, status: selectedSalesStatus,
            items: checkoutItems, totalValue, totalProfit, quantity: totalQuantity, timestamp: Date.now(),
            localVendaKey: localVendaKeyAtual, localVendaNome: nomeDoLocal(localVendaKeyAtual)
        };

        // Grava os dados de pagamento (dinheiro + crédito usado + crédito gerado) somente quando PAGO
        if (selectedSalesStatus === 'PAGO') {
            payload.valorPago = valorPago;
            payload.creditoUsado = creditoUsado;
            payload.creditoGerado = creditoGerado;
            if (contaPagamentoKey) {
                payload.contaPagamentoKey = contaPagamentoKey;
                payload.contaPagamentoNome = contaPagamentoNome;
            }
        }

        const targetRef = currentSaleId ? ref(db, `vendas/${currentSaleId}`) : push(ref(db, 'vendas'));

        // Se há dinheiro novo entrando numa conta, prepara o lançamento no Caixa (Aba 6) já com a chave
        // gerada, para gravar a referência dela dentro da própria venda (permite reverter depois).
        let movRefCaixa = null;
        if (contaPagamentoKey) {
            movRefCaixa = push(ref(db, 'movimentacoesCaixa'));
            payload.movimentacaoCaixaKey = movRefCaixa.key;
        }

        set(targetRef, payload).then(() => {
            // O saldo de crédito do cliente é sempre derivado do histórico (calcularCreditoCliente),
            // então basta garantir que o cliente exista cadastrado - o crédito gerado/usado desta
            // venda já entra automaticamente no cálculo assim que o payload acima é salvo.
            const finalizarSalvamento = () => {
                restaurarBotaoSalvar();
                document.getElementById('sales-client-name').value = '';
                pendingPagamento = null;
                sectionFormularioVendas.style.display = 'none';
                sectionHistoricoVendas.style.display = 'block';
                let msg = currentSaleId ? "Movimentação de venda atualizada!" : "Venda registrada com sucesso!";
                if (creditoUsado > 0) msg += `\n\nForam utilizados R$ ${formatMoeda(creditoUsado)} de crédito do cliente para esta venda.`;
                if (creditoGerado > 0) msg += `\n\nO cliente pagou R$ ${formatMoeda(creditoGerado)} a mais que o valor da venda. Esse valor foi adicionado como crédito na Aba 5 - Clientes.`;
                if (contaPagamentoKey) msg += `\n\nR$ ${formatMoeda(valorPago)} foram lançados como entrada na conta "${contaPagamentoNome}" (Aba 6 - Caixa).`;
                showAlert(msg, 'success');
                currentSaleId = null;
            };

            // Lança a entrada no Caixa e soma o valor pago ao saldo da conta escolhida
            const finalizarComCaixa = () => {
                if (!contaPagamentoKey) { finalizarSalvamento(); return; }
                const saldoAtual = parseFloat(allLoadedContas[contaPagamentoKey].saldo || 0);
                const novoSaldo = parseFloat((saldoAtual + valorPago).toFixed(2));
                Promise.all([
                    set(movRefCaixa, {
                        contaKey: contaPagamentoKey, contaNome: contaPagamentoNome, tipo: 'entrada',
                        valor: valorPago, descricao: `Recebimento da venda de ${clientName}`,
                        data: salesDate, timestamp: Date.now()
                    }),
                    update(ref(db, `contas/${contaPagamentoKey}`), { saldo: novoSaldo })
                ]).then(finalizarSalvamento).catch(err => {
                    // CORREÇÃO DE BUG: a venda já foi salva, mas o lançamento no Caixa falhou - avisa o
                    // usuário em vez de deixar o botão travado e o usuário sem saber o que aconteceu.
                    console.error('Erro ao lançar movimentação de caixa:', err);
                    restaurarBotaoSalvar();
                    showAlert('A venda foi salva, mas houve falha ao lançar no Caixa: ' + (err.message || 'verifique sua conexão.'), 'danger');
                });
            };

            // Só cria cadastro automático de cliente novo quando a venda gerou crédito para ele
            // (mesmo critério de antes) - vendas de "CONSUMIDOR FINAL" ou clientes sem crédito não criam cadastro.
            const clienteKeyExistente = Object.keys(allLoadedClientes).find(k => (allLoadedClientes[k].name || '').toLowerCase() === clientName.toLowerCase());
            if (!clienteKeyExistente && creditoGerado > creditoUsado) {
                const novoClienteRef = push(ref(db, 'clientes'));
                set(novoClienteRef, { name: clientName }).then(finalizarComCaixa);
            } else {
                finalizarComCaixa();
            }
        }).catch(err => {
            // CORREÇÃO DE BUG: antes, uma falha de gravação no Firebase (ex: sem internet) morria em
            // silêncio - o usuário achava que tinha salvado e a venda simplesmente não existia.
            console.error('Erro ao salvar venda no Firebase:', err);
            restaurarBotaoSalvar();
            showAlert('Não foi possível salvar a venda. Verifique sua conexão com a internet e tente novamente. (' + (err.message || err.code || 'erro desconhecido') + ')', 'danger');
        });
        }).catch(err => {
            restaurarBotaoSalvar();
            if (err && err.code === 'ESTOQUE_INSUFICIENTE') {
                showAlert(`Não foi possível concluir a venda: o estoque de ${err.produtos.join(', ')} em ${nomeDoLocal(localVendaKeyAtual)} mudou (provavelmente outra venda ao mesmo tempo em outro dispositivo) e não é mais suficiente. Reveja as quantidades e tente novamente.`, 'warning');
            } else {
                console.error('Erro ao ajustar estoque da venda:', err);
                showAlert('Não foi possível ajustar o estoque desta venda. Verifique sua conexão e tente novamente.', 'danger');
            }
        });
      } catch (err) {
        // CORREÇÃO DE BUG: rede de segurança contra qualquer erro inesperado no meio do processo -
        // antes o clique podia morrer em silêncio, deixando o formulário destravado mas sem feedback.
        console.error('Erro inesperado ao salvar venda:', err);
        const btnSalvarEl = document.getElementById('btn-execute-sale');
        btnSalvarEl.disabled = false;
        if (btnSalvarEl.innerText === '💾 Salvando...') btnSalvarEl.innerText = '💾 Salvar e Confirmar Operação de Caixa';
        showAlert('Não foi possível salvar a venda por um erro inesperado. Verifique os produtos selecionados e tente novamente. (' + (err.message || 'erro desconhecido') + ')', 'danger');
      }
    });

    // BOTÃO EXCLUIR EXCLUSIVO DA ABA DE VENDAS (PDV)
    // CORREÇÃO DE BUG: regra alinhada com o mobile, que já permitia excluir vendas CONFIRMADA
    // devolvendo o estoque automaticamente. Antes o PC bloqueava qualquer status diferente de
    // RASCUNHO e obrigava o usuário a mudar o status manualmente antes de conseguir excluir.
    document.getElementById('btn-delete-sale').addEventListener('click', () => {
        if (!currentSaleId || !allLoadedSales[currentSaleId]) return;
        const venda = allLoadedSales[currentSaleId];
        const statusAtual = venda.status || "RASCUNHO";

        if (statusAtual === "PAGO") {
            showAlert(`Esta venda está com status "PAGO" e não pode ser excluída nem editada.`, 'danger', 'Ação Bloqueada');
            return;
        }

        showConfirm(`Deseja deletar permanentemente o registro desta venda do cliente ${venda.clientName}?`, 'danger', 'Excluir Venda').then(ok => {
            if (!ok) return;
            const promessas = [remove(ref(db, `vendas/${currentSaleId}`))];
            if (statusAtual === "CONFIRMADA") {
                // Devolve o estoque para o mesmo local físico de onde a venda originalmente descontou.
                // Vendas antigas (de antes deste recurso) não têm localVendaKey; nesse caso, usa o local
                // padrão como melhor alternativa disponível.
                const localDaVenda = venda.localVendaKey || localPadraoKey;
                (venda.items || []).forEach(item => {
                    if (item.productKey && allLoadedProducts[item.productKey] && localDaVenda) {
                        promessas.push(aplicarDeltaEstoqueTransacao(item.productKey, localDaVenda, item.quantity));
                    }
                });
            }
            Promise.all(promessas).then(() => {
                showAlert("Venda excluída do sistema com sucesso!", 'success');
                sectionFormularioVendas.style.display = 'none';
                sectionHistoricoVendas.style.display = 'block';
                currentSaleId = null;
            }).catch(err => {
                console.error('Erro ao excluir venda:', err);
                showAlert('Não foi possível excluir a venda. Verifique sua conexão. (' + (err.message || err.code || 'erro desconhecido') + ')', 'danger');
            });
        });
    });

    window.abrirAjusteVenda = function(saleKey) {
        const venda = allLoadedSales[saleKey];
        if(!venda) return;

        currentSaleId = saleKey;
        document.getElementById('pdv-form-title').innerText = `✏️ Ajustar Movimentação de Venda`;
        document.getElementById('btn-delete-sale').style.display = 'inline-block'; // Exibe o botão de exclusão
        sectionHistoricoVendas.style.display = 'none';
        sectionFormularioVendas.style.display = 'block';

        document.getElementById('sales-client-name').value = venda.clientName || '';
        document.getElementById('sales-date').value = dataISOparaBR(venda.salesDate);
        document.getElementById('sales-due-date').value = dataISOparaBR(venda.salesDueDate);
        checarVencimentoAntesDaVenda();

        // O local de uma venda já existente fica fixo (não editável): mudar de local aqui poderia mover
        // estoque "escondido" para outro lugar sem passar pela Transferência. Vendas antigas sem local
        // registrado caem no local padrão deste computador como melhor alternativa disponível.
        popularTodosSelectsDeLocal();
        const selLocalVendaEdicao = document.getElementById('vendas-local-selecionado');
        selLocalVendaEdicao.value = venda.localVendaKey || localPadraoKey || '';
        selLocalVendaEdicao.disabled = true;

        // Reconstrói o resumo de pagamento (somente leitura) se a venda já estiver paga
        pendingPagamento = (venda.status === 'PAGO')
            ? {
                valorPago: parseFloat(venda.valorPago || 0), creditoUsado: parseFloat(venda.creditoUsado || 0),
                creditoGerado: parseFloat(venda.creditoGerado || 0), clienteKey: null,
                contaKey: venda.contaPagamentoKey || null, contaNome: venda.contaPagamentoNome || null
              }
            : null;
        updateSalesStatusSelectorVisual(venda.status || 'RASCUNHO');
        atualizarResumoPagamentoNaVenda();

        const pixBanner = document.getElementById('pix-pendente-banner');
        pixBanner.style.display = venda.pixPendente ? 'flex' : 'none';
        document.getElementById('btn-confirmar-pix-detalhe').onclick = () => confirmarRecebimentoPix(saleKey);

        const container = document.getElementById('sales-items-container-body');
        container.innerHTML = '';

        if(venda.items) {
            venda.items.forEach(item => { container.appendChild(createSaleItemRow(item)); });
        } else {
            container.appendChild(createSaleItemRow({
                productKey: venda.productKey || '', quantity: venda.quantity || 1, discountType: '$', discountValue: 0
            }));
        }
        calculatePdvTotals();

        // TRAVA DE EDIÇÃO: vendas com status PAGO só podem ser visualizadas, nunca editadas
        // (é possível revertê-la clicando em "Rascunho"/"Confirmada" no seletor de status)
        const estaPaga = (venda.status === 'PAGO');
        setSalesFormLocked(estaPaga);
        document.getElementById('vendas-local-selecionado').disabled = true; // local de venda existente nunca é editável, pago ou não
        if (estaPaga) {
            showAlert('Esta venda já está paga e não pode mais ser editada. Você pode apenas visualizar os dados, ou reverter o status clicando em "Rascunho"/"Confirmada" acima.', 'warning', 'Venda Bloqueada para Edição');
        }
    };

    function initDatabaseSync() {
        onValue(ref(db, 'unidades_medida'), (snap) => {
            const data = snap.val() || {};
            allLoadedUMs = data;
            
            const tbody = document.getElementById('um-table-body');
            const selectEdit = document.getElementById('edit-insumo-um');
            const selectAdd = document.getElementById('add-insumo-um');
            tbody.innerHTML = '';
            selectEdit.innerHTML = '';
            selectAdd.innerHTML = '';

            Object.keys(data).forEach(k => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><strong>${data[k].sigla}</strong></td><td><button class="btn-action-prod btn-delete-prod" onclick="removeUM('${k}')">✕</button></td>`;
                tbody.appendChild(tr);

                const opt = document.createElement('option');
                opt.value = data[k].sigla; opt.innerText = data[k].sigla;
                selectEdit.appendChild(opt.cloneNode(true));
                selectAdd.appendChild(opt);
            });
        });

        onValue(ref(db, 'categorias_produtos'), (snap) => {
            const data = snap.val() || {};
            allLoadedCategoriasProdutos = data;

            const tbody = document.getElementById('categorias-table-body');
            const selectEdit = document.getElementById('edit-produto-categoria');
            const selectNovo = document.getElementById('novo-produto-categoria');
            const valorAtualEdit = selectEdit.value;
            const valorAtualNovo = selectNovo.value;

            tbody.innerHTML = '';
            selectEdit.innerHTML = '<option value="">Sem categoria</option>';
            selectNovo.innerHTML = '<option value="">Sem categoria</option>';

            const categoriasOrdenadas = Object.keys(data)
                .map(k => ({ key: k, nome: data[k].nome }))
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

            categoriasOrdenadas.forEach(({ key, nome }) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><strong>${nome}</strong></td><td><button class="btn-action-prod btn-delete-prod" onclick="removeCategoriaProduto('${key}')">✕</button></td>`;
                tbody.appendChild(tr);

                const opt = document.createElement('option');
                opt.value = nome; opt.innerText = nome;
                selectEdit.appendChild(opt.cloneNode(true));
                selectNovo.appendChild(opt);
            });

            selectEdit.value = valorAtualEdit;
            selectNovo.value = valorAtualNovo;
        });

        sincronizarColecaoIncremental('historico_producao', allLoadedProductions, () => {
            renderProductionHistory();
            renderAnaliseMargemLucro();
        });

        function renderProductionHistory() {
            const data = allLoadedProductions;
            const tbody = document.getElementById('production-history-body');
            tbody.innerHTML = '';

            let lista = Object.keys(data).map(key => ({ key, ...data[key] }));
            const state = getSortState('production-history-table');
            lista = state.key ? ordenarPorEstado(lista, 'production-history-table') : lista.sort((a, b) => b.pedidoNumero - a.pedidoNumero);

            lista.forEach(item => {
                const key = item.key;
                const tr = document.createElement('tr');
                tr.className = 'clickable-row'; tr.setAttribute('onclick', `openProductionOrder('${key}')`);
                tr.innerHTML = `
                    <td><strong style="color:#0854a0;">#${String(item.pedidoNumero).padStart(3,'0')}</strong></td>
                    <td><strong>${nomeClicavelProduto(findProdutoKeyByName(item.name), item.name)}</strong></td>
                    <td style="color:var(--color-negative); font-weight:600;">R$ ${formatMoeda(parseFloat(item.costPerUnit || 0))}</td>
                    <td><span class="badge-stock">${item.yieldQty} un</span></td>
                    <td><span class="badge-status status-${(item.status || 'RASCUNHO').toLowerCase()}">${item.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }

        onValue(ref(db, 'produtos'), (snapshot) => {
            const data = snapshot.val() || {};
            allLoadedProducts = data;
            renderCatalogoProdutos();
            populateRecipeNameSelect();
            atualizarAlertasSistema();
            renderEstoqueTab();
            renderAnaliseMargemLucro();
            renderAnaliseMaisVendidos();
            renderPrecosPorLocal();
        });

        onValue(ref(db, 'locais'), (snapshot) => {
            allLoadedLocais = snapshot.val() || {};
            popularTodosSelectsDeLocal();
            popularFiltroEstoqueTab();
            popularFiltroLocalVendas();
            renderEstoqueTab();
            if (document.getElementById('modal-locais').style.display === 'flex') renderListaLocaisModal();
            renderHistoricoTransferenciasPC();
            renderGridQRCodes();
            renderPrecosPorLocal();
            if (!locaisJaCarregadosPC) {
                locaisJaCarregadosPC = true;
                if (!localPadraoKey || !allLoadedLocais[localPadraoKey]) {
                    const chaves = localKeysOrdenados();
                    if (chaves.length > 0) definirLocalPadrao(chaves[0]);
                }
            }
        });

        onValue(ref(db, 'transferenciasEstoque'), (snapshot) => {
            allLoadedTransferenciasEstoque = snapshot.val() || {};
            renderHistoricoTransferenciasPC();
        });

        function renderCatalogoProdutos() {
            const data = allLoadedProducts;
            const tbodyTable = document.getElementById('catalog-table-body');
            tbodyTable.innerHTML = '';

            let lista = Object.keys(data).map(key => {
                const prod = data[key];
                const opsConfirmadas = Object.values(allLoadedProductions).filter(o => o.name.toLowerCase() === prod.name.toLowerCase() && o.status === "CONFIRMADO");
                const totalPrevisao = opsConfirmadas.reduce((acc, o) => acc + (o.yieldQty || 0), 0);
                const ultimoCusto = getCustoEfetivoProduto(prod);
                const estoqueMinimo = parseFloat(prod.estoqueMinimo || 0);
                const readyStock = prod.readyStock || 0;
                const baixoEstoque = estoqueMinimo > 0 && readyStock < estoqueMinimo;
                const category = prod.category || 'Sem Categoria';
                return { key, name: prod.name, category, sellingPrice: parseFloat(prod.sellingPrice || 0), readyStock, ultimoCusto, totalPrevisao, estoqueMinimo, baixoEstoque };
            });

            // Popula o filtro de categorias e a sugestão dos modais com as categorias existentes,
            // sempre a partir da lista COMPLETA (não da filtrada), para nunca "sumir" opções da busca.
            const categoriasExistentes = [...new Set(lista.map(item => item.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const selectCategoria = document.getElementById('filtro-categoria-catalogo');
            const valorSelecionadoAtual = selectCategoria.value;
            selectCategoria.innerHTML = '<option value="">Todas as Categorias</option>' +
                categoriasExistentes.map(c => `<option value="${c}">${c}</option>`).join('');
            selectCategoria.value = categoriasExistentes.includes(valorSelecionadoAtual) ? valorSelecionadoAtual : '';
            filtroCategoriaCatalogo = selectCategoria.value;

            if (filtroBuscaCatalogo.trim() !== '') {
                const termo = normalizarBusca(filtroBuscaCatalogo);
                lista = lista.filter(item => normalizarBusca(item.name).includes(termo));
            }
            if (filtroCategoriaCatalogo !== '') {
                lista = lista.filter(item => item.category === filtroCategoriaCatalogo);
            }

            if (lista.length === 0) {
                tbodyTable.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhum produto encontrado.</td></tr>';
                return;
            }

            const listaOrdenada = ordenarPorEstado(lista, 'catalog-table');
            listaOrdenada.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><a href="javascript:void(0)" class="cliente-nome-link" data-key="${item.key}">${item.name}</a></td>
                    <td><span class="badge-stock">${item.category}</span></td>
                    <td style="color:#bb0000; font-weight:600;">R$ ${formatMoeda(item.ultimoCusto)}</td>
                    <td style="color:#107e3e; font-weight:600;">R$ ${formatMoeda(item.sellingPrice)}</td>
                    <td><span class="badge-stock" ${item.baixoEstoque ? 'style="background:var(--bg-danger-soft); color:var(--color-negative);"' : ''}>${item.readyStock} un${item.baixoEstoque ? ' ' : ''}</span></td>
                    <td style="color:#e9730c; font-weight:600;">${item.totalPrevisao} un</td>
                    <td>
                        <button class="btn-action-prod btn-delete-prod" onclick="excluirProdutoCatalogo('${item.key}')">✕</button>
                    </td>
                `;
                tr.querySelector('.cliente-nome-link').addEventListener('click', () => openModalEditarProduto(item.key));
                tbodyTable.appendChild(tr);
            });
        }

        // ===== ABA 12 - PREÇOS POR LOCAL =====
        // Salva (ou remove, se vazio) o preço específico de um produto num local, em produtos/{key}/precosPorLocal/{localKey}.
        // Campo vazio = sem override, o local passa a usar o Preço Base do produto (sellingPrice).
        function salvarPrecoPorLocal(prodKey, localKey, valorTexto) {
            const path = `produtos/${prodKey}/precosPorLocal/${localKey}`;
            const valor = valorTexto.trim();
            if (valor === '') {
                remove(ref(db, path));
                return;
            }
            const num = parseFloat(valor.replace(',', '.'));
            if (isNaN(num) || num < 0) {
                showAlert('Informe um preço válido.', 'warning');
                renderPrecosPorLocal();
                return;
            }
            set(ref(db, path), num);
        }

        function renderPrecosPorLocal() {
            const thead = document.getElementById('precoslocal-table-head');
            const tbody = document.getElementById('precoslocal-table-body');
            const avisoSemLocais = document.getElementById('precoslocal-sem-locais');
            const avisoVazio = document.getElementById('precoslocal-vazio');
            if (!thead || !tbody) return;

            const locaisKeys = localKeysOrdenados();
            avisoSemLocais.style.display = locaisKeys.length === 0 ? 'block' : 'none';

            thead.innerHTML = '<th>PRODUTO</th><th>PREÇO BASE</th>' +
                locaisKeys.map(k => `<th>${nomeDoLocal(k)}</th>`).join('');

            tbody.innerHTML = '';

            let lista = Object.keys(allLoadedProducts).map(key => ({ key, prod: allLoadedProducts[key] }));
            lista.sort((a, b) => (a.prod.name || '').localeCompare(b.prod.name || '', 'pt-BR'));

            const termo = normalizarBusca(document.getElementById('precoslocal-busca').value || '');
            if (termo) {
                lista = lista.filter(item => normalizarBusca(item.prod.name).includes(termo));
            }

            avisoVazio.style.display = lista.length === 0 ? 'block' : 'none';
            if (lista.length === 0 || locaisKeys.length === 0) return;

            lista.forEach(({ key, prod }) => {
                const tr = document.createElement('tr');
                const basePrice = parseFloat(prod.sellingPrice || 0);
                let colunas = `<td><strong>${prod.name}</strong></td>`;
                colunas += `<td style="color:var(--text-muted); font-weight:600;">R$ ${formatMoeda(basePrice)}</td>`;
                locaisKeys.forEach(localKey => {
                    const overrideVal = prod.precosPorLocal && prod.precosPorLocal[localKey] !== undefined && prod.precosPorLocal[localKey] !== null ? prod.precosPorLocal[localKey] : '';
                    colunas += `<td><input type="number" min="0" step="0.01" class="input-preco-local" data-prod-key="${key}" data-local-key="${localKey}" placeholder="R$ ${formatMoeda(basePrice)}" value="${overrideVal}" style="width:100px;"></td>`;
                });
                tr.innerHTML = colunas;
                tbody.appendChild(tr);
            });

            tbody.querySelectorAll('.input-preco-local').forEach(input => {
                input.addEventListener('change', (e) => {
                    salvarPrecoPorLocal(e.target.getAttribute('data-prod-key'), e.target.getAttribute('data-local-key'), e.target.value);
                });
            });
        }

        (function initBuscaPrecosLocal() {
            const inputBusca = document.getElementById('precoslocal-busca');
            const btnLimpar = document.getElementById('btn-limpar-busca-precoslocal');
            if (!inputBusca) return;
            inputBusca.addEventListener('input', () => {
                btnLimpar.style.display = inputBusca.value ? 'block' : 'none';
                renderPrecosPorLocal();
            });
            btnLimpar.addEventListener('click', () => {
                inputBusca.value = '';
                btnLimpar.style.display = 'none';
                renderPrecosPorLocal();
            });
        })();

        // ===== MIGRAÇÃO: atribui código interno às matérias-primas cadastradas ANTES dessa
        // funcionalidade existir. Roda sozinha uma única vez por sessão assim que os dados chegam;
        // numera na ordem de criação original (a chave do Firebase já ordena cronologicamente),
        // então quem foi cadastrado primeiro recebe o número mais baixo.
        let migracaoCodigoInternoInsumoFeita = false;
        function garantirCodigosInternosInsumos() {
            if (migracaoCodigoInternoInsumoFeita) return;
            const semCodigo = Object.entries(allLoadedSuprimentos)
                .filter(([k, v]) => !v.codigoInterno)
                .sort(([ka], [kb]) => ka.localeCompare(kb));
            if (semCodigo.length === 0) { migracaoCodigoInternoInsumoFeita = true; return; }

            let proximoCodigo = Object.values(allLoadedSuprimentos).reduce((max, v) => Math.max(max, parseInt(v.codigoInterno) || 0), 0) + 1;
            const updates = {};
            semCodigo.forEach(([k]) => { updates[`suprimentos/${k}/codigoInterno`] = proximoCodigo++; });
            migracaoCodigoInternoInsumoFeita = true; // marca antes de gravar pra não disparar de novo por causa do próprio update
            update(ref(db), updates);
        }

        onValue(ref(db, 'suprimentos'), (snapshot) => {
            const data = snapshot.val() || {};
            allLoadedSuprimentos = data;
            garantirCodigosInternosInsumos();
            renderSuprimentosTable();
            refreshIngredientStockDisplays();
            atualizarAlertasSistema();
        });

        function renderSuprimentosTable() {
            const data = allLoadedSuprimentos;
            const tbody = document.getElementById('suprimentos-table-body');
            const selectModal = document.getElementById('modal-select-insumo');
            tbody.innerHTML = '';
            selectModal.innerHTML = '<option value="">-- Selecione o Insumo --</option>';

            let listaCompleta = Object.keys(data).map(key => {
                const estoqueMinimo = parseFloat(data[key].estoqueMinimo || 0);
                const quantity = parseFloat(data[key].quantity || 0);
                const baixoEstoque = estoqueMinimo > 0 && quantity < estoqueMinimo;
                return { key, codigoInterno: parseInt(data[key].codigoInterno) || 0, name: data[key].name, barcode: data[key].barcode || '', price: parseFloat(data[key].price || 0), quantity, unit: data[key].unit || 'g', estoqueMinimo, baixoEstoque };
            });

            // O select de escolha de insumo (usado em outros modais) sempre lista TODOS os suprimentos,
            // independente do filtro de busca abaixo, que afeta apenas a tabela visível nesta aba.
            listaCompleta.forEach(sup => {
                const opt = document.createElement('option');
                opt.value = sup.key; opt.innerText = sup.name;
                selectModal.appendChild(opt);
            });

            let lista = listaCompleta;
            if (filtroBuscaSuprimentos.trim() !== '') {
                const termo = normalizarBusca(filtroBuscaSuprimentos);
                lista = lista.filter(item => normalizarBusca(item.name).includes(termo) || normalizarBusca(item.barcode).includes(termo) || String(item.codigoInterno) === termo.trim());
            }

            lista = ordenarPorEstado(lista, 'suprimentos-table');

            if (lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhum suprimento encontrado.</td></tr>';
            }

            lista.forEach(sup => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong style="color:#0854a0;">${String(sup.codigoInterno).padStart(3,'0')}</strong></td>
                    <td><strong>${sup.name}</strong></td>
                    <td>${sup.barcode ? sup.barcode : '<span style="color:var(--text-faint);">—</span>'}</td>
                    <td>R$ ${formatMoeda(sup.price)}</td>
                    <td><span class="badge-stock" ${sup.baixoEstoque ? 'style="background:var(--bg-danger-soft); color:var(--color-negative);"' : ''}>${formatQuantidade(sup.quantity)}${sup.baixoEstoque ? ' ' : ''}</span></td>
                    <td><span style="font-weight:600; color:#33465a;">${sup.unit}</span></td>
                    <td><button class="btn-action-prod btn-edit-prod" onclick="openModalEditarInsumo('${sup.key}')">✏️ Cadastros</button></td>
                    <td><button class="btn-action-prod btn-delete-prod" onclick="excluirInsumoComercial('${sup.key}')">✕ Deletar</button></td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Faturamento Total / Lucro Bruto agora são recalculados dentro de renderSalesChart(),
        // respeitando o período (7 dias / 30 dias / Tudo / intervalo customizado) selecionado pelo usuário.
        sincronizarColecaoIncremental('vendas', allLoadedSales, () => {
            renderSalesHistoryTable();
            renderSalesChart();
            renderClientesTable();
            atualizarAlertasSistema();
            renderAnaliseMaisVendidos();
            renderAnaliseCrescimento();
        });

        // RENDERIZA A TABELA DE HISTÓRICO DE VENDAS RESPEITANDO O FILTRO DE STATUS ATIVO
        // Calcula a coluna "SOBRE DIAS" do histórico de vendas: quantos dias faltam para o
        // vencimento, ou há quantos dias a venda já está vencida. Vendas já PAGAS não mostram
        // "vencida", pois o vencimento deixou de ser relevante assim que o valor foi recebido.
        function formatarSobreDias(dueDateStr, status) {
            if (!dueDateStr) return '<span style="color:var(--text-faint);">---</span>';
            if (status === 'PAGO') return '<span style="color:var(--text-faint);">Paga</span>';

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const [ano, mes, dia] = dueDateStr.split('-').map(Number);
            const venc = new Date(ano, mes - 1, dia);
            const diffDias = Math.round((venc - hoje) / 86400000);

            if (diffDias < 0) {
                const dias = Math.abs(diffDias);
                return `<span style="color:var(--color-negative); font-weight:700;">Vencida há ${dias} ${dias === 1 ? 'dia' : 'dias'}</span>`;
            }
            if (diffDias === 0) {
                return `<span style="color:#a85209; font-weight:700;">Vence hoje</span>`;
            }
            return `<span>Vence em ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}</span>`;
        }

        function renderSalesHistoryTable() {
            const data = allLoadedSales;
            const tbody = document.getElementById('sales-history-body');
            tbody.innerHTML = '';

            const termoCliente = normalizarBusca((document.getElementById('sales-filtro-cliente').value || '').trim());
            const filtroLocal = document.getElementById('sales-filtro-local').value;

            let lista = Object.keys(data).filter(key => {
                if (data[key].origemCredito) return false; // transações de crédito (Aba 5) não aparecem no histórico de vendas
                const statusVenda = data[key].status || 'PAGO';
                if (!vendasFiltroStatus.has(statusVenda)) return false;
                if (termoCliente && !normalizarBusca(data[key].clientName || 'Consumidor').includes(termoCliente)) return false;
                if (filtroLocal && data[key].localVendaKey !== filtroLocal) return false;
                return true;
            }).map(key => ({ key, ...data[key], status: data[key].status || 'PAGO' }));

            const state = getSortState('sales-history-table');
            lista = state.key ? ordenarPorEstado(lista, 'sales-history-table') : lista.reverse();

            if (lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma venda encontrada para o(s) filtro(s) selecionado(s).</td></tr>';
                return;
            }

            lista.forEach(s => {
                const key = s.key;
                const dataVendaFormatada = s.salesDate ? s.salesDate.split('-').reverse().join('/') : '---';
                const dataVencFormatada = s.salesDueDate ? s.salesDueDate.split('-').reverse().join('/') : '---';
                const statusVenda = s.status || 'PAGO';

                const itensProduto = s.items && s.items.length ? s.items : [{ productName: s.productName || 'Balcão', quantity: s.quantity || 1 }];
                const qtdTiposProduto = itensProduto.length;

                const badgePixPendente = s.pixPendente
                    ? ' <span class="badge-status status-cancelado" title="O cliente marcou como pago via Pix no Autoatendimento, mas ainda não foi confirmado que o valor caiu na conta.">Pix Pendente</span>'
                    : '';
                const acaoConfirmarPix = s.pixPendente
                    ? `<button class="btn-action-prod btn-edit-prod" style="background-color:#0a6ed1; color:#fff;" onclick="confirmarRecebimentoPix('${key}')">Confirmar Pix</button>`
                    : '';

                const sobreDiasHtml = formatarSobreDias(s.salesDueDate, statusVenda);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${s.localVendaNome || '---'}</td>
                    <td>${dataVendaFormatada}</td>
                    <td><strong>${s.clientName || 'Consumidor'}</strong></td>
                    <td><span class="badge-status status-${statusVenda.toLowerCase()}">${statusVenda}</span>${badgePixPendente}</td>
                    <td>${dataVencFormatada}</td>
                    <td>${sobreDiasHtml}</td>
                    <td><span class="produtos-badge" data-sale-key="${key}">${qtdTiposProduto} ${qtdTiposProduto === 1 ? 'produto' : 'produtos'}</span></td>
                    <td style="font-weight:600; color:#0854a0;">R$ ${formatMoeda(parseFloat(s.totalValue || 0))}</td>
                    <td>${acaoConfirmarPix}<button class="btn-action-prod btn-edit-prod" onclick="abrirAjusteVenda('${key}')">✏️ Ajuste</button></td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Preenche o filtro de Local do Histórico de Vendas com os locais cadastrados
        function popularFiltroLocalVendas() {
            const sel = document.getElementById('sales-filtro-local');
            if (!sel) return;
            const valorAntigo = sel.value;
            sel.innerHTML = '<option value="">Todos os Locais</option>' + localKeysOrdenados().map(k => `<option value="${k}">${nomeDoLocal(k)}</option>`).join('');
            if (valorAntigo && allLoadedLocais[valorAntigo]) sel.value = valorAntigo;
        }

        // TOOLTIP "PRODUTOS" DO HISTÓRICO DE VENDAS - mini tabela com sabor/quantidade ao passar
        // o mouse sobre o selo, num único elemento fixo no <body> (mesmo padrão do tooltip da sidebar).
        (function initProdutosVendaTooltip() {
            const tooltip = document.createElement('div');
            tooltip.id = 'produtos-venda-tooltip';
            document.body.appendChild(tooltip);

            const tbodyVendas = document.getElementById('sales-history-body');

            function montarTabelaProdutos(saleKey) {
                const venda = allLoadedSales[saleKey];
                if (!venda) return '';
                const itens = venda.items && venda.items.length ? venda.items : [{ productName: venda.productName || 'Balcão', quantity: venda.quantity || 1 }];
                const linhas = itens.map(i => `<tr><td>${nomeClicavelProduto(i.productKey, i.productName || 'Produto')}</td><td class="tt-qtd">${i.quantity || 1}x</td></tr>`).join('');
                return `<table><thead><tr><th>Produto</th><th>Qtd.</th></tr></thead><tbody>${linhas}</tbody></table>`;
            }

            tbodyVendas.addEventListener('mouseover', (e) => {
                const badge = e.target.closest('.produtos-badge');
                if (!badge) return;
                tooltip.innerHTML = montarTabelaProdutos(badge.dataset.saleKey);

                const rect = badge.getBoundingClientRect();
                const margem = 10;
                // offsetWidth/offsetHeight funcionam mesmo com o tooltip fora da tela (translate
                // negativo), já que isso só afeta a posição visual, não o tamanho do elemento.
                const ttWidth = tooltip.offsetWidth;
                const ttHeight = tooltip.offsetHeight;

                // BUG CORRIGIDO: como o tooltip usa position:fixed (relativo à janela, não ao
                // documento), quando o selo "PRODUTOS" ficava perto do fim da tela o tooltip
                // era desenhado abaixo da área visível — e como position:fixed não entra no
                // cálculo de altura rolável da página, não tinha como rolar pra baixo pra
                // enxergá-lo. Agora, se não houver espaço suficiente abaixo do selo, o tooltip
                // é exibido ACIMA dele, sempre dentro da área visível da tela.
                let top = rect.bottom + 8;
                if (top + ttHeight > window.innerHeight - margem) {
                    top = rect.top - ttHeight - 8;
                    if (top < margem) top = margem;
                }

                let left = rect.left;
                if (left + ttWidth > window.innerWidth - margem) {
                    left = window.innerWidth - ttWidth - margem;
                }
                if (left < margem) left = margem;

                tooltip.style.transform = `translate(${left}px, ${top}px)`;
                tooltip.classList.add('visible');
            });
            tbodyVendas.addEventListener('mouseout', (e) => {
                if (!e.target.closest('.produtos-badge')) return;
                // Se o mouse está indo em direção à própria tooltip (pra clicar no nome de um produto,
                // por ex.), não esconde - só esconde quando realmente sai da área do selo + tooltip.
                if (e.relatedTarget && tooltip.contains(e.relatedTarget)) return;
                tooltip.classList.remove('visible');
            });
            tooltip.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
        })();

        document.getElementById('sales-filtro-cliente').addEventListener('input', renderSalesHistoryTable);
        document.getElementById('sales-filtro-local').addEventListener('change', renderSalesHistoryTable);

        // Confirma que um pagamento Pix feito pelo cliente no Autoatendimento realmente caiu na conta.
        // Só a partir dessa confirmação (feita aqui, no painel do ADM) é que o valor entra de fato no
        // saldo da conta e vira uma movimentação no Caixa — até lá, a venda já existe e já abateu
        // estoque, mas o dinheiro fica "no ar" pra evitar contar como recebido algo que pode não ter caído.
        function confirmarRecebimentoPix(vendaKey) {
            const venda = allLoadedSales[vendaKey];
            if (!venda || !venda.pixPendente) return;
            const contaKey = venda.contaPagamentoKey;
            const conta = contaKey ? allLoadedContas[contaKey] : null;
            if (!contaKey || !conta) {
                showAlert('A conta de recebimento configurada para esta venda não existe mais. Abra o "Ajuste" da venda para escolher a conta manualmente.', 'danger');
                return;
            }
            const valor = parseFloat(venda.valorPago || 0);
            showConfirm(`Confirma que o Pix de R$ ${formatMoeda(valor)} de ${venda.clientName || 'Consumidor'} caiu na conta "${conta.name}"?\n\nIsso vai lançar a entrada no Caixa e somar ao saldo da conta.`, 'success', 'Confirmar Recebimento Pix').then(ok => {
                if (!ok) return;
                const saldoAtual = parseFloat(conta.saldo || 0);
                const novoSaldo = parseFloat((saldoAtual + valor).toFixed(2));
                const movRefCaixa = push(ref(db, 'movimentacoesCaixa'));
                Promise.all([
                    set(movRefCaixa, {
                        contaKey, contaNome: conta.name, tipo: 'entrada', valor,
                        descricao: `Recebimento Pix (Autoatendimento) de ${venda.clientName || 'Consumidor'}`,
                        data: venda.salesDate || formatDateInputValue(new Date()), timestamp: Date.now()
                    }),
                    update(ref(db, `contas/${contaKey}`), { saldo: novoSaldo }),
                    update(ref(db, `vendas/${vendaKey}`), { pixPendente: false, movimentacaoCaixaKey: movRefCaixa.key })
                ]).then(() => {
                    showAlert('Pagamento Pix confirmado! O valor já entrou no saldo da conta.', 'success');
                }).catch(err => {
                    console.error('Erro ao confirmar recebimento Pix:', err);
                    showAlert('Não foi possível confirmar o recebimento. Verifique sua conexão e tente novamente.', 'danger');
                });
            });
        }
        window.confirmarRecebimentoPix = confirmarRecebimentoPix;

        // EVENTOS DOS BOTÕES DE FILTRO DE STATUS (HISTÓRICO DE VENDAS)
        const STATUS_INDIVIDUAIS = ['RASCUNHO', 'CONFIRMADA', 'PAGO'];

        function atualizarVisualFiltroStatus() {
            document.querySelectorAll('#sales-filter-bar .filtro-status-btn').forEach(btn => {
                const st = btn.dataset.filtroStatus;
                if (st === 'TODOS') {
                    btn.classList.toggle('ativo', STATUS_INDIVIDUAIS.every(s => vendasFiltroStatus.has(s)));
                } else {
                    btn.classList.toggle('ativo', vendasFiltroStatus.has(st));
                }
            });
        }

        document.querySelectorAll('#sales-filter-bar .filtro-status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const st = btn.dataset.filtroStatus;
                if (st === 'TODOS') {
                    STATUS_INDIVIDUAIS.forEach(s => vendasFiltroStatus.add(s));
                } else {
                    if (vendasFiltroStatus.has(st)) {
                        vendasFiltroStatus.delete(st);
                    } else {
                        vendasFiltroStatus.add(st);
                    }
                }
                atualizarVisualFiltroStatus();
                renderSalesHistoryTable();
            });
        });

        // ===== ABA 10 - ANÁLISE: MARGEM DE LUCRO POR PRODUTO =====
        // Mesma lógica de custo usada na Aba 2 (custo da última Ordem de Produção confirmada/gerada do produto).
        function renderAnaliseMargemLucro() {
            const tbody = document.getElementById('analise-margem-table-body');
            const vazio = document.getElementById('analise-margem-vazio');
            if (!tbody) return;
            tbody.innerHTML = '';

            let lista = Object.keys(allLoadedProducts).map(key => {
                const prod = allLoadedProducts[key];
                const ultimoCusto = getCustoEfetivoProduto(prod);
                // Preço de venda considerado na margem: quando o produto tem preços diferentes por
                // local (Aba 12), usa a MÉDIA entre os locais (cada local usa seu preço específico,
                // ou o Preço Base quando não tem override) em vez de sempre o Preço Base fixo.
                const locaisKeys = localKeysOrdenados();
                const precosPorLocalLista = locaisKeys.map(lk => getPrecoProdutoNoLocal(prod, lk));
                const sellingPrice = precosPorLocalLista.length > 0
                    ? (precosPorLocalLista.reduce((a, b) => a + b, 0) / precosPorLocalLista.length)
                    : parseFloat(prod.sellingPrice || 0);
                const precoVaria = precosPorLocalLista.length > 1 && Math.max(...precosPorLocalLista) !== Math.min(...precosPorLocalLista);
                const margemValor = sellingPrice - ultimoCusto;
                const margemPct = sellingPrice > 0 ? (margemValor / sellingPrice) * 100 : 0;
                const markup = ultimoCusto > 0 ? (sellingPrice / ultimoCusto) : null;
                const category = prod.category || 'Sem Categoria';
                return { key, name: prod.name, category, sellingPrice, precoVaria, precoMin: precoVaria ? Math.min(...precosPorLocalLista) : null, precoMax: precoVaria ? Math.max(...precosPorLocalLista) : null, ultimoCusto, margemValor, margemPct, markup };
            }).filter(item => item.ultimoCusto > 0 || item.sellingPrice > 0);

            lista.sort((a, b) => b.margemPct - a.margemPct);

            // Médias calculadas sobre os produtos que têm custo cadastrado (markup válido),
            // para não distorcer a média com itens de custo zerado (que dariam 100% de margem falsa).
            const listaComCusto = lista.filter(item => item.markup !== null);
            const mediaMarkupEl = document.getElementById('analise-media-markup');
            const mediaMargemEl = document.getElementById('analise-media-margem');
            if (listaComCusto.length > 0) {
                const mediaMarkup = listaComCusto.reduce((acc, i) => acc + i.markup, 0) / listaComCusto.length;
                const mediaMargem = listaComCusto.reduce((acc, i) => acc + i.margemPct, 0) / listaComCusto.length;
                mediaMarkupEl.textContent = mediaMarkup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                mediaMargemEl.textContent = mediaMargem.toFixed(1) + '%';
            } else {
                mediaMarkupEl.textContent = '-';
                mediaMargemEl.textContent = '-';
            }

            // Margem ponderada: dá mais peso aos produtos que mais venderam (quantidade histórica,
            // todas as vendas CONFIRMADA/PAGO), em vez de tratar todo produto do catálogo como igual.
            // Também soma o valor líquido gerado (já com desconto aplicado) para calcular a Margem Real:
            // usa o preço médio EFETIVAMENTE recebido em cada venda, em vez do preço de tabela.
            const qtdVendidaPorProduto = {};
            const valorGeradoPorProduto = {};
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.items) return;
                s.items.forEach(item => {
                    if (!item.productKey) return;
                    qtdVendidaPorProduto[item.productKey] = (qtdVendidaPorProduto[item.productKey] || 0) + (item.quantity || 0);
                    const valorItem = item.totalItemNet != null ? item.totalItemNet : (item.sellingPrice || 0) * (item.quantity || 0);
                    valorGeradoPorProduto[item.productKey] = (valorGeradoPorProduto[item.productKey] || 0) + valorItem;
                });
            });
            const margemPonderadaEl = document.getElementById('analise-margem-ponderada');
            const listaComVendas = listaComCusto.map(i => ({ ...i, qtdVendida: qtdVendidaPorProduto[i.key] || 0 })).filter(i => i.qtdVendida > 0);
            const pesoTotal = listaComVendas.reduce((acc, i) => acc + i.qtdVendida, 0);
            margemPonderadaEl.textContent = pesoTotal > 0
                ? (listaComVendas.reduce((acc, i) => acc + i.margemPct * i.qtdVendida, 0) / pesoTotal).toFixed(1) + '%'
                : '-';

            // Margem Real: mesma ponderação, mas usando o preço médio realmente recebido (já com desconto)
            // em vez do preço de tabela — mostra o efeito real dos descontos concedidos na margem.
            lista = lista.map(item => {
                const qtdVendida = qtdVendidaPorProduto[item.key] || 0;
                const valorGerado = valorGeradoPorProduto[item.key] || 0;
                const precoMedioReal = qtdVendida > 0 ? (valorGerado / qtdVendida) : null;
                const margemRealPct = (precoMedioReal !== null && precoMedioReal > 0) ? ((precoMedioReal - item.ultimoCusto) / precoMedioReal) * 100 : null;
                return { ...item, qtdVendida, precoMedioReal, margemRealPct };
            });
            const margemRealEl = document.getElementById('analise-margem-real');
            const listaComMargemReal = lista.filter(i => i.margemRealPct !== null && i.qtdVendida > 0);
            const pesoTotalReal = listaComMargemReal.reduce((acc, i) => acc + i.qtdVendida, 0);
            margemRealEl.textContent = pesoTotalReal > 0
                ? (listaComMargemReal.reduce((acc, i) => acc + i.margemRealPct * i.qtdVendida, 0) / pesoTotalReal).toFixed(1) + '%'
                : '-';

            const qtdMargemNegativaEl = document.getElementById('analise-margem-negativa-qtd');
            qtdMargemNegativaEl.textContent = lista.filter(i => i.margemValor < 0).length;

            lista = ordenarPorEstado(lista, 'analise-margem-table');

            if (lista.length === 0) { vazio.style.display = 'block'; return; }
            vazio.style.display = 'none';

            lista.forEach(item => {
                const corMargem = item.margemValor < 0 ? '#bb0000' : (item.margemPct < 30 ? '#c8630a' : '#0c5e2e');
                const markupTexto = item.markup === null ? '-' : item.markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const margemRealTexto = item.margemRealPct === null ? '-' : `${item.margemRealPct.toFixed(1)}%`;
                const corMargemReal = item.margemRealPct === null ? 'var(--text-muted)' : (item.margemRealPct < 0 ? '#bb0000' : (item.margemRealPct < 30 ? '#c8630a' : '#0c5e2e'));
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><a href="javascript:void(0)" class="cliente-nome-link" data-key="${item.key}">${item.name}</a></td>
                    <td>${item.category}</td>
                    <td>R$ ${formatMoeda(item.ultimoCusto)}</td>
                    <td title="${item.precoVaria ? `Varia por local: de R$ ${formatMoeda(item.precoMin)} a R$ ${formatMoeda(item.precoMax)} (média usada abaixo)` : 'Preço de venda deste produto'}">R$ ${formatMoeda(item.sellingPrice)}${item.precoVaria ? ' <span style="font-size:8pt; color:var(--text-muted);">(méd.)</span>' : ''}</td>
                    <td style="color:${corMargem}; font-weight:700;">R$ ${formatMoeda(item.margemValor)}</td>
                    <td style="color:${corMargem}; font-weight:700;">${item.margemPct.toFixed(1)}%</td>
                    <td style="color:${corMargemReal}; font-weight:700;" title="${item.qtdVendida > 0 ? 'Preço médio realmente recebido: R$ ' + formatMoeda(item.precoMedioReal) : 'Produto sem vendas registradas'}">${margemRealTexto}</td>
                    <td style="font-weight:700;">${markupTexto}</td>
                `;
                tr.querySelector('.cliente-nome-link').addEventListener('click', () => openModalEditarProduto(item.key));
                tbody.appendChild(tr);
            });
        }

        // ===== ABA 10 - ANÁLISE: PRODUTOS MAIS VENDIDOS (QUANTIDADE) =====
        // Agrupa os itens de todas as vendas CONFIRMADA/PAGO (rascunho e créditos da Aba 5 não entram),
        // respeitando o período e a categoria selecionados, e ordena por quantidade vendida.
        let vendidosModo = 'vendidos'; // 'vendidos' ou 'parados'
        function setVendidosModo(modo) {
            vendidosModo = modo;
            document.getElementById('btn-vendidos-modo-vendidos').classList.toggle('active', modo === 'vendidos');
            document.getElementById('btn-vendidos-modo-parados').classList.toggle('active', modo === 'parados');
            renderAnaliseMaisVendidos();
        }

        function renderAnaliseMaisVendidos() {
            const tbody = document.getElementById('analise-vendidos-table-body');
            const vazio = document.getElementById('analise-vendidos-vazio');
            if (!tbody) return;
            tbody.innerHTML = '';

            const inicioVal = dataBRparaISO(document.getElementById('vendidos-data-inicio').value);
            const fimVal = dataBRparaISO(document.getElementById('vendidos-data-fim').value);

            // Popula o filtro de categorias a partir do catálogo completo de produtos
            const categoriasExistentes = [...new Set(Object.values(allLoadedProducts).map(p => p.category || 'Sem Categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const selectCategoria = document.getElementById('filtro-categoria-vendidos');
            const valorSelecionadoAtual = selectCategoria.value;
            selectCategoria.innerHTML = '<option value="">Todas as Categorias</option>' +
                categoriasExistentes.map(c => `<option value="${c}">${c}</option>`).join('');
            selectCategoria.value = categoriasExistentes.includes(valorSelecionadoAtual) ? valorSelecionadoAtual : '';
            const filtroCategoria = selectCategoria.value;

            const somaPorProduto = {};
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return; // transações de crédito (Aba 5) não são vendas de produto
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate) return;
                if (inicioVal && s.salesDate < inicioVal) return;
                if (fimVal && s.salesDate > fimVal) return;
                if (!s.items) return;

                s.items.forEach(item => {
                    if (!item.productKey) return; // ignora ajustes de crédito lançados como item avulso
                    const prod = allLoadedProducts[item.productKey];
                    const category = (prod && prod.category) || 'Sem Categoria';
                    if (filtroCategoria && category !== filtroCategoria) return;

                    if (!somaPorProduto[item.productKey]) {
                        somaPorProduto[item.productKey] = { key: item.productKey, name: item.productName, category, qtdVendida: 0, valorGerado: 0 };
                    }
                    somaPorProduto[item.productKey].qtdVendida += (item.quantity || 0);
                    somaPorProduto[item.productKey].valorGerado += (item.totalItemNet != null ? item.totalItemNet : (item.sellingPrice || 0) * (item.quantity || 0));
                });
            });

            // Modo "Parados": em vez do que foi vendido, mostra os produtos do catálogo (respeitando
            // a categoria escolhida) que NÃO tiveram nenhuma venda dentro do período selecionado.
            if (vendidosModo === 'parados') {
                Object.keys(allLoadedProducts).forEach(key => {
                    if (somaPorProduto[key]) return; // esse vendeu no período, não é "parado"
                    const prod = allLoadedProducts[key];
                    const category = prod.category || 'Sem Categoria';
                    if (filtroCategoria && category !== filtroCategoria) return;
                    somaPorProduto[key] = { key, name: prod.name, category, qtdVendida: 0, valorGerado: 0 };
                });
            }

            let lista = Object.values(somaPorProduto).map(item => {
                const prod = allLoadedProducts[item.key];
                const custo = prod ? getCustoEfetivoProduto(prod) : 0;
                const sellingPrice = prod ? parseFloat(prod.sellingPrice || 0) : 0;
                const markupEstoque = custo > 0 ? (sellingPrice / custo) : null;
                const precoMedioPago = item.qtdVendida > 0 ? (item.valorGerado / item.qtdVendida) : 0;
                const markupVenda = custo > 0 ? (precoMedioPago / custo) : null;
                const qtdEstoque = prod ? parseFloat(prod.readyStock || 0) : 0;
                return { ...item, markupEstoque, markupVenda, qtdEstoque };
            });

            if (vendidosModo === 'parados') {
                lista = lista.filter(item => item.qtdVendida === 0);
                lista.sort((a, b) => b.qtdEstoque - a.qtdEstoque);
            } else {
                lista.sort((a, b) => b.qtdVendida - a.qtdVendida);
            }

            // Cards de resumo: markups são a média do período (só produtos com custo cadastrado
            // entram na média, para não distorcer com item de custo zerado); quantidades são somas.
            const comMarkupEstoque = lista.filter(i => i.markupEstoque !== null);
            const comMarkupVenda = lista.filter(i => i.markupVenda !== null);
            const mediaMarkupEstoqueEl = document.getElementById('analise-vendidos-media-markup-estoque');
            const mediaMarkupVendaEl = document.getElementById('analise-vendidos-media-markup-venda');
            const totalQtdEstoqueEl = document.getElementById('analise-vendidos-total-qtd-estoque');
            const totalQtdVendaEl = document.getElementById('analise-vendidos-total-qtd-venda');

            mediaMarkupEstoqueEl.textContent = comMarkupEstoque.length > 0
                ? (comMarkupEstoque.reduce((acc, i) => acc + i.markupEstoque, 0) / comMarkupEstoque.length).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '-';
            mediaMarkupVendaEl.textContent = comMarkupVenda.length > 0
                ? (comMarkupVenda.reduce((acc, i) => acc + i.markupVenda, 0) / comMarkupVenda.length).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '-';
            totalQtdEstoqueEl.textContent = formatQuantidade(lista.reduce((acc, i) => acc + i.qtdEstoque, 0)) + ' un';
            totalQtdVendaEl.textContent = formatQuantidade(lista.reduce((acc, i) => acc + i.qtdVendida, 0)) + ' un';

            lista = ordenarPorEstado(lista, 'analise-vendidos-table');

            if (lista.length === 0) {
                vazio.textContent = vendidosModo === 'parados'
                    ? 'Nenhum produto parado — todos os produtos do catálogo (ou da categoria escolhida) venderam nesse período.'
                    : 'Nenhuma venda encontrada para o período/categoria selecionados.';
                vazio.style.display = 'block';
                return;
            }
            vazio.style.display = 'none';

            lista.forEach(item => {
                const markupEstoqueTexto = item.markupEstoque === null ? '-' : item.markupEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const markupVendaTexto = item.markupVenda === null ? '-' : item.markupVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${nomeClicavelProduto(item.key, item.name)}</strong></td>
                    <td>${item.category}</td>
                    <td style="font-weight:700;">${markupEstoqueTexto}</td>
                    <td style="font-weight:700;">${markupVendaTexto}</td>
                    <td><span class="badge-stock">${formatQuantidade(item.qtdEstoque)} un</span></td>
                    <td><span class="badge-stock">${item.qtdVendida} un</span></td>
                    <td style="font-weight:600; color:#0854a0;">R$ ${formatMoeda(item.valorGerado)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // ===== ABA 10 - ANÁLISE: PREVISÃO DE REPOSIÇÃO (RUPTURA DE ESTOQUE) =====
        // Calcula, por produto, a média de venda diária dentro do período escolhido (7/14/30 dias)
        // e compara com o estoque atual (getEstoqueTotal, soma de todos os locais) para estimar em
        // quantos dias o produto zera - e sinalizar quem precisa entrar na Ordem de Produção.
        let reposicaoPeriodoDias = 14;

        function renderAnaliseReposicao() {
            const tbody = document.getElementById('analise-reposicao-table-body');
            const vazio = document.getElementById('analise-reposicao-vazio');
            if (!tbody) return;
            tbody.innerHTML = '';

            // Popula o filtro de categorias a partir do catálogo completo de produtos
            const categoriasExistentes = [...new Set(Object.values(allLoadedProducts).map(p => p.category || 'Sem Categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const selectCategoria = document.getElementById('filtro-categoria-reposicao');
            const valorSelecionadoAtual = selectCategoria.value;
            selectCategoria.innerHTML = '<option value="">Todas as Categorias</option>' +
                categoriasExistentes.map(c => `<option value="${c}">${c}</option>`).join('');
            selectCategoria.value = categoriasExistentes.includes(valorSelecionadoAtual) ? valorSelecionadoAtual : '';
            const filtroCategoria = selectCategoria.value;

            const fim = new Date(); fim.setHours(0, 0, 0, 0);
            const inicio = new Date(fim); inicio.setDate(fim.getDate() - (reposicaoPeriodoDias - 1));
            const inicioISO = formatDateInputValue(inicio);
            const fimISO = formatDateInputValue(fim);

            const somaPorProduto = {};
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate) return;
                if (s.salesDate < inicioISO || s.salesDate > fimISO) return;
                if (!s.items) return;
                s.items.forEach(item => {
                    if (!item.productKey) return;
                    somaPorProduto[item.productKey] = (somaPorProduto[item.productKey] || 0) + (item.quantity || 0);
                });
            });

            let lista = Object.keys(allLoadedProducts).map(key => {
                const prod = allLoadedProducts[key];
                const category = prod.category || 'Sem Categoria';
                const qtdEstoque = getEstoqueTotal(prod);
                const qtdVendida = somaPorProduto[key] || 0;
                const mediaDia = qtdVendida / reposicaoPeriodoDias;
                // Sem venda no período: não dá para prever ruptura (produto parado, não "vai zerar").
                // Guarda o valor real (p/ exibir "-") e um valor Infinity só para efeito de ordenação,
                // assim esses itens sempre vão para o fim quando ordenado por "dias restantes" crescente.
                const diasRestantesReal = mediaDia > 0 ? (qtdEstoque / mediaDia) : null;
                const diasRestantes = diasRestantesReal === null ? Infinity : diasRestantesReal;
                let status;
                if (diasRestantesReal === null) status = qtdEstoque > 0 ? { texto: '- Sem venda no período', cor: 'var(--text-muted)', nivel: 3 } : { texto: '- Sem estoque e sem venda', cor: 'var(--text-muted)', nivel: 3 };
                else if (diasRestantesReal <= 3) status = { texto: '🔴 Urgente', cor: '#bb0000', nivel: 0 };
                else if (diasRestantesReal <= 7) status = { texto: '🟡 Atenção', cor: '#c8630a', nivel: 1 };
                else status = { texto: '🟢 OK', cor: '#0c5e2e', nivel: 2 };
                return { key, name: prod.name, category, qtdEstoque, qtdVendida, mediaDia, diasRestantes, diasRestantesReal, status };
            }).filter(item => {
                if (filtroCategoria && item.category !== filtroCategoria) return false;
                return item.qtdEstoque > 0 || item.qtdVendida > 0; // ignora produto sem estoque e sem histórico
            });

            document.getElementById('analise-reposicao-total-urgente').textContent = lista.filter(i => i.status.nivel === 0).length;
            document.getElementById('analise-reposicao-total-atencao').textContent = lista.filter(i => i.status.nivel === 1).length;
            document.getElementById('analise-reposicao-total-ok').textContent = lista.filter(i => i.status.nivel === 2).length;

            // Ordenação padrão: dias restantes crescente (quem vai zerar primeiro no topo); itens sem
            // previsão usam Infinity em "diasRestantes" e por isso já caem naturalmente pro final.
            lista = ordenarPorEstado(lista, 'analise-reposicao-table');

            if (lista.length === 0) {
                vazio.style.display = 'block';
                return;
            }
            vazio.style.display = 'none';

            lista.forEach(item => {
                const diasTexto = item.diasRestantesReal === null ? '-' : `${item.diasRestantesReal.toFixed(1)} dias`;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category}</td>
                    <td><span class="badge-stock">${formatQuantidade(item.qtdEstoque)} un</span></td>
                    <td><span class="badge-stock">${formatQuantidade(item.qtdVendida)} un</span></td>
                    <td>${formatQuantidade(item.mediaDia)} un/dia</td>
                    <td style="font-weight:700; color:${item.status.cor};">${diasTexto}</td>
                    <td style="font-weight:600; color:${item.status.cor};">${item.status.texto}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function highlightReposicaoPreset(dias) {
            document.getElementById('btn-reposicao-periodo-7d').classList.toggle('active', dias === 7);
            document.getElementById('btn-reposicao-periodo-14d').classList.toggle('active', dias === 14);
            document.getElementById('btn-reposicao-periodo-30d').classList.toggle('active', dias === 30);
        }
        function setReposicaoPeriodo(dias) {
            reposicaoPeriodoDias = dias;
            highlightReposicaoPreset(dias);
            renderAnaliseReposicao();
        }

        // ===== ABA 10 - ANÁLISE: EVOLUÇÃO & CRESCIMENTO DE VENDAS (GERAL OU POR PRODUTO) =====
        // Compara o faturamento do período atual com o período EQUIVALENTE anterior (mesma
        // quantidade de dias), geral ou de um produto específico, e desenha as duas curvas
        // acumuladas alinhadas por "dia relativo" (Dia 1, Dia 2...) para mostrar se está crescendo.
        let crescimentoModo = 'geral'; // 'geral' ou 'individual'
        let crescimentoPreset = 'semana'; // 'semana', 'mes', 'ano', 'custom'

        function getPeriodoCrescimento(preset) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            if (preset === 'semana') {
                const diaSemana = (hoje.getDay() + 6) % 7; // 0 = segunda-feira
                const inicioAtual = new Date(hoje); inicioAtual.setDate(hoje.getDate() - diaSemana);
                const fimAtual = new Date(hoje);
                const inicioAnterior = new Date(inicioAtual); inicioAnterior.setDate(inicioAtual.getDate() - 7);
                const fimAnterior = new Date(fimAtual); fimAnterior.setDate(fimAtual.getDate() - 7);
                return { inicioAtual, fimAtual, inicioAnterior, fimAnterior };
            }

            if (preset === 'mes') {
                const inicioAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                const fimAtual = new Date(hoje);
                const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
                const diaCorrespondente = Math.min(hoje.getDate(), ultimoDiaMesAnterior);
                const inicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                const fimAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, diaCorrespondente);
                return { inicioAtual, fimAtual, inicioAnterior, fimAnterior };
            }

            if (preset === 'ano') {
                const inicioAtual = new Date(hoje.getFullYear(), 0, 1);
                const fimAtual = new Date(hoje);
                const inicioAnterior = new Date(hoje.getFullYear() - 1, 0, 1);
                let fimAnterior = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
                if (fimAnterior.getMonth() !== hoje.getMonth()) { // trata 29/fev caindo em ano não-bissexto
                    fimAnterior = new Date(hoje.getFullYear() - 1, hoje.getMonth() + 1, 0);
                }
                return { inicioAtual, fimAtual, inicioAnterior, fimAnterior };
            }

            // custom: usa as datas digitadas pelo usuário; período anterior = mesma quantidade de
            // dias do período atual, contados imediatamente antes da data de início escolhida.
            const inicioStr = dataBRparaISO(document.getElementById('crescimento-data-inicio').value);
            const fimStr = dataBRparaISO(document.getElementById('crescimento-data-fim').value);
            if (!inicioStr || !fimStr) return null;
            const inicioAtual = new Date(inicioStr + 'T00:00:00');
            const fimAtual = new Date(fimStr + 'T00:00:00');
            if (fimAtual < inicioAtual) return null;
            const qtdDias = Math.round((fimAtual - inicioAtual) / 86400000) + 1;
            const fimAnterior = new Date(inicioAtual); fimAnterior.setDate(inicioAtual.getDate() - 1);
            const inicioAnterior = new Date(fimAnterior); inicioAnterior.setDate(fimAnterior.getDate() - (qtdDias - 1));
            return { inicioAtual, fimAtual, inicioAnterior, fimAnterior };
        }

        // Soma o faturamento por dia (chave ISO) dentro de um intervalo. Se "produtoKeysSet" for null/undefined,
        // soma TODAS as vendas (modo Geral). Se for um Set de chaves de produto, soma só os itens desses produtos
        // (usado no modo Individual, tanto para o agregado filtrado quanto para cada produto da tabela).
        // RASCUNHO e créditos da Aba 5 nunca entram.
        function somarVendasPorDia(inicioISO, fimISO, produtoKeysSet) {
            const somaPorDia = {};
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate) return;
                if (s.salesDate < inicioISO || s.salesDate > fimISO) return;

                if (!produtoKeysSet) {
                    somaPorDia[s.salesDate] = (somaPorDia[s.salesDate] || 0) + (s.totalValue || 0);
                } else {
                    if (!s.items) return;
                    s.items.forEach(item => {
                        if (!produtoKeysSet.has(item.productKey)) return;
                        const valorItem = item.totalItemNet != null ? item.totalItemNet : (item.sellingPrice || 0) * (item.quantity || 0);
                        somaPorDia[s.salesDate] = (somaPorDia[s.salesDate] || 0) + valorItem;
                    });
                }
            });
            return somaPorDia;
        }

        // Conta quantas vendas distintas (não itens) caem no intervalo — usado para o ticket médio.
        // Mesma regra de filtro do somarVendasPorDia: se houver produtoKeysSet, só conta a venda se
        // ela tiver ao menos um item de algum desses produtos.
        function contarVendasNoPeriodo(inicioISO, fimISO, produtoKeysSet) {
            let count = 0;
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate) return;
                if (s.salesDate < inicioISO || s.salesDate > fimISO) return;
                if (!produtoKeysSet) { count++; return; }
                if (!s.items) return;
                if (s.items.some(item => produtoKeysSet.has(item.productKey))) count++;
            });
            return count;
        }

        function highlightCrescimentoPreset(preset) {
            document.getElementById('btn-crescimento-semana').classList.toggle('active', preset === 'semana');
            document.getElementById('btn-crescimento-mes').classList.toggle('active', preset === 'mes');
            document.getElementById('btn-crescimento-ano').classList.toggle('active', preset === 'ano');
            document.getElementById('btn-crescimento-custom').classList.toggle('active', preset === 'custom');
            document.getElementById('crescimento-custom-inputs').style.display = preset === 'custom' ? 'inline-flex' : 'none';
        }

        // Guarda a última lista calculada (produto a produto) para a tabela comparativa, permitindo
        // reordenar clicando no cabeçalho sem precisar recalcular tudo de novo.
        let crescimentoListaProdutosCache = [];

        function renderCrescimentoTabela() {
            const tbody = document.getElementById('crescimento-tabela-produtos-body');
            const vazio = document.getElementById('crescimento-tabela-vazia');
            tbody.innerHTML = '';

            const lista = ordenarPorEstado(crescimentoListaProdutosCache, 'crescimento-tabela-produtos');

            if (lista.length === 0) { vazio.style.display = 'block'; return; }
            vazio.style.display = 'none';

            lista.forEach(item => {
                const cor = item.percentual > 0 ? '#0c5e2e' : (item.percentual < 0 ? '#bb0000' : 'var(--text-strong)');
                const textoPct = item.totalAnterior > 0
                    ? `${item.percentual >= 0 ? '▲' : '▼'} ${Math.abs(item.percentual).toFixed(1)}%`
                    : (item.totalAtual > 0 ? '▲ NOVO' : '-');
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category}</td>
                    <td>R$ ${formatMoeda(item.totalAnterior)}</td>
                    <td>R$ ${formatMoeda(item.totalAtual)}</td>
                    <td style="color:${cor}; font-weight:700;">${textoPct}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function renderAnaliseCrescimento() {
            const svg = document.getElementById('crescimento-chart-svg');
            const emptyMsg = document.getElementById('crescimento-chart-empty');
            const tabelaContainer = document.getElementById('crescimento-tabela-container');
            const filtrosIndividual = document.getElementById('crescimento-individual-filtros');

            filtrosIndividual.style.display = crescimentoModo === 'individual' ? 'flex' : 'none';
            tabelaContainer.style.display = crescimentoModo === 'individual' ? 'block' : 'none';

            // Popula o filtro de categorias (modo individual) a partir do catálogo completo
            const selectCategoria = document.getElementById('select-crescimento-categoria');
            const categoriaSelecionadaAtual = selectCategoria.value;
            const categoriasExistentes = [...new Set(Object.values(allLoadedProducts).map(p => p.category || 'Sem Categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            selectCategoria.innerHTML = '<option value="">Todas as Categorias</option>' +
                categoriasExistentes.map(c => `<option value="${c}">${c}</option>`).join('');
            selectCategoria.value = categoriasExistentes.includes(categoriaSelecionadaAtual) ? categoriaSelecionadaAtual : '';

            // No modo Individual, o agregado (cards + gráfico) reflete os produtos que batem com a
            // busca por nome + categoria escolhidos; sem filtro nenhum, equivale a todo o catálogo.
            let produtoKeysSet = null;
            if (crescimentoModo === 'individual') {
                const termoBusca = (document.getElementById('input-crescimento-busca-produto').value || '').trim().toLowerCase();
                const filtroCategoria = selectCategoria.value;
                const produtosFiltrados = Object.keys(allLoadedProducts).filter(key => {
                    const prod = allLoadedProducts[key];
                    const nomeBate = !termoBusca || (prod.name || '').toLowerCase().includes(termoBusca);
                    const categoriaBate = !filtroCategoria || (prod.category || 'Sem Categoria') === filtroCategoria;
                    return nomeBate && categoriaBate;
                });
                produtoKeysSet = new Set(produtosFiltrados);

                if (produtoKeysSet.size === 0) {
                    svg.innerHTML = ''; svg.style.display = 'none';
                    emptyMsg.textContent = 'Nenhum produto encontrado para a busca/categoria selecionadas.';
                    emptyMsg.style.display = 'block';
                    document.getElementById('crescimento-valor-anterior').textContent = 'R$ 0,00';
                    document.getElementById('crescimento-valor-atual').textContent = 'R$ 0,00';
                    document.getElementById('crescimento-percentual').textContent = '-';
                    document.getElementById('crescimento-percentual').style.color = 'var(--text-strong)';
                    document.getElementById('crescimento-diferenca').textContent = '-';
                    document.getElementById('crescimento-datas-anterior').textContent = '-';
                    document.getElementById('crescimento-datas-atual').textContent = '-';
                    document.getElementById('crescimento-ticket-atual').textContent = '-';
                    document.getElementById('crescimento-ticket-anterior').textContent = '-';
                    crescimentoListaProdutosCache = [];
                    renderCrescimentoTabela();
                    return;
                }
            }

            const periodo = getPeriodoCrescimento(crescimentoPreset);
            if (!periodo) {
                svg.innerHTML = ''; svg.style.display = 'none';
                emptyMsg.textContent = 'Informe as duas datas do período personalizado e clique em "Aplicar".';
                emptyMsg.style.display = 'block';
                return;
            }

            const { inicioAtual, fimAtual, inicioAnterior, fimAnterior } = periodo;
            const inicioAtualISO = formatDateInputValue(inicioAtual);
            const fimAtualISO = formatDateInputValue(fimAtual);
            const inicioAnteriorISO = formatDateInputValue(inicioAnterior);
            const fimAnteriorISO = formatDateInputValue(fimAnterior);

            document.getElementById('crescimento-datas-atual').textContent = `${dataISOparaBR(inicioAtualISO)} até ${dataISOparaBR(fimAtualISO)}`;
            document.getElementById('crescimento-datas-anterior').textContent = `${dataISOparaBR(inicioAnteriorISO)} até ${dataISOparaBR(fimAnteriorISO)}`;

            const somaAtualPorDia = somarVendasPorDia(inicioAtualISO, fimAtualISO, produtoKeysSet);
            const somaAnteriorPorDia = somarVendasPorDia(inicioAnteriorISO, fimAnteriorISO, produtoKeysSet);

            const totalAtual = Object.values(somaAtualPorDia).reduce((a, b) => a + b, 0);
            const totalAnterior = Object.values(somaAnteriorPorDia).reduce((a, b) => a + b, 0);

            document.getElementById('crescimento-valor-atual').textContent = `R$ ${formatMoeda(totalAtual)}`;
            document.getElementById('crescimento-valor-anterior').textContent = `R$ ${formatMoeda(totalAnterior)}`;

            const elPercentual = document.getElementById('crescimento-percentual');
            const elDiferenca = document.getElementById('crescimento-diferenca');
            let percentual = 0;
            if (totalAnterior > 0) {
                percentual = ((totalAtual - totalAnterior) / totalAnterior) * 100;
                elPercentual.textContent = `${percentual >= 0 ? '▲' : '▼'} ${Math.abs(percentual).toFixed(1)}%`;
            } else if (totalAtual > 0) {
                elPercentual.textContent = '▲ NOVO';
                percentual = 100;
            } else {
                elPercentual.textContent = '-';
            }
            elPercentual.style.color = percentual > 0 ? '#0c5e2e' : (percentual < 0 ? '#bb0000' : 'var(--text-strong)');
            elDiferenca.textContent = `R$ ${formatMoeda(totalAtual - totalAnterior)} de diferença`;

            // Ticket médio = faturamento do período / número de vendas distintas do período
            const qtdVendasAtual = contarVendasNoPeriodo(inicioAtualISO, fimAtualISO, produtoKeysSet);
            const qtdVendasAnterior = contarVendasNoPeriodo(inicioAnteriorISO, fimAnteriorISO, produtoKeysSet);
            const ticketAtual = qtdVendasAtual > 0 ? totalAtual / qtdVendasAtual : 0;
            const ticketAnterior = qtdVendasAnterior > 0 ? totalAnterior / qtdVendasAnterior : 0;
            document.getElementById('crescimento-ticket-atual').textContent = qtdVendasAtual > 0 ? `R$ ${formatMoeda(ticketAtual)}` : '-';
            document.getElementById('crescimento-ticket-anterior').textContent = qtdVendasAnterior > 0 ? `Anterior: R$ ${formatMoeda(ticketAnterior)} (${qtdVendasAnterior} vendas)` : '-';

            // Monta os pontos ACUMULADOS alinhados por "dia relativo" (Dia 1, Dia 2...) para
            // comparar visualmente a trajetória do período atual com a do período anterior.
            const qtdDiasAtual = Math.round((fimAtual - inicioAtual) / 86400000) + 1;
            const qtdDiasAnterior = Math.round((fimAnterior - inicioAnterior) / 86400000) + 1;
            const qtdDias = Math.max(qtdDiasAtual, qtdDiasAnterior);

            const pontosAtual = [], pontosAnterior = [];
            let acumAtual = 0, acumAnterior = 0;
            for (let i = 0; i < qtdDias; i++) {
                if (i < qtdDiasAtual) {
                    const d = new Date(inicioAtual); d.setDate(inicioAtual.getDate() + i);
                    acumAtual += (somaAtualPorDia[formatDateInputValue(d)] || 0);
                    pontosAtual.push(acumAtual);
                }
                if (i < qtdDiasAnterior) {
                    const d = new Date(inicioAnterior); d.setDate(inicioAnterior.getDate() + i);
                    acumAnterior += (somaAnteriorPorDia[formatDateInputValue(d)] || 0);
                    pontosAnterior.push(acumAnterior);
                }
            }

            desenharGraficoCrescimento(pontosAtual, pontosAnterior);

            // MODO INDIVIDUAL: monta a tabela comparativa, produto a produto, com os mesmos períodos
            if (crescimentoModo === 'individual') {
                crescimentoListaProdutosCache = [...produtoKeysSet].map(key => {
                    const prod = allLoadedProducts[key];
                    const keySet = new Set([key]);
                    const totalAtualProduto = Object.values(somarVendasPorDia(inicioAtualISO, fimAtualISO, keySet)).reduce((a, b) => a + b, 0);
                    const totalAnteriorProduto = Object.values(somarVendasPorDia(inicioAnteriorISO, fimAnteriorISO, keySet)).reduce((a, b) => a + b, 0);
                    const percentualProduto = totalAnteriorProduto > 0 ? ((totalAtualProduto - totalAnteriorProduto) / totalAnteriorProduto) * 100 : (totalAtualProduto > 0 ? 100 : 0);
                    return {
                        key,
                        name: prod.name,
                        category: prod.category || 'Sem Categoria',
                        totalAnterior: totalAnteriorProduto,
                        totalAtual: totalAtualProduto,
                        percentual: percentualProduto
                    };
                });
                renderCrescimentoTabela();
            }
        }

        // Caixinha flutuante do gráfico de Evolução & Crescimento (mesmo estilo dos demais gráficos)
        function showCrescimentoChartTooltip(evt, texto) {
            const wrapper = document.getElementById('crescimento-chart-svg').closest('.card');
            const tooltip = document.getElementById('crescimento-chart-tooltip');
            const wrapperRect = wrapper.getBoundingClientRect();
            tooltip.innerHTML = texto;
            tooltip.style.left = `${evt.clientX - wrapperRect.left}px`;
            tooltip.style.top = `${evt.clientY - wrapperRect.top}px`;
            tooltip.classList.add('show');
        }
        function hideCrescimentoChartTooltip() {
            document.getElementById('crescimento-chart-tooltip').classList.remove('show');
        }

        function desenharGraficoCrescimento(pontosAtual, pontosAnterior) {
            const svg = document.getElementById('crescimento-chart-svg');
            const emptyMsg = document.getElementById('crescimento-chart-empty');
            svg.innerHTML = '';
            hideCrescimentoChartTooltip();

            const qtdDias = Math.max(pontosAtual.length, pontosAnterior.length);
            const maiorValor = Math.max(...pontosAtual, ...pontosAnterior, 1);

            if (qtdDias === 0 || maiorValor <= 1) {
                svg.style.display = 'none';
                emptyMsg.textContent = 'Nenhuma venda encontrada nos períodos selecionados.';
                emptyMsg.style.display = 'block';
                return;
            }
            emptyMsg.style.display = 'none';
            svg.style.display = 'block';

            const ns = 'http://www.w3.org/2000/svg';
            const W = 900, H = 300;
            const mL = 72, mR = 20, mT = 24, mB = 40;
            const uw = W - mL - mR;
            const uh = H - mT - mB;

            const ySteps = 5;
            for (let i = 0; i <= ySteps; i++) {
                const y = mT + (uh / ySteps) * i;
                const val = maiorValor * (1 - i / ySteps);
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', mL); line.setAttribute('x2', W - mR);
                line.setAttribute('y1', y); line.setAttribute('y2', y);
                line.setAttribute('stroke', document.documentElement.getAttribute('data-theme') === 'dark' ? (i === ySteps ? '#475569' : '#334155') : (i === ySteps ? '#c4cdd5' : '#eef1f3'));
                line.setAttribute('stroke-width', i === ySteps ? '1.5' : '1');
                svg.appendChild(line);

                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', mL - 10); text.setAttribute('y', y + 4);
                text.setAttribute('text-anchor', 'end');
                text.setAttribute('font-size', '11'); text.setAttribute('fill', 'var(--text-muted)');
                text.setAttribute('font-family', 'Segoe UI, sans-serif');
                text.textContent = `R$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)}`;
                svg.appendChild(text);
            }

            function montarLinha(pontos, cor, tracejado) {
                if (pontos.length === 0) return;
                const coords = pontos.map((v, i) => ({
                    x: pontos.length === 1 ? mL + uw / 2 : mL + (uw / (qtdDias - 1)) * i,
                    y: mT + uh - (v / maiorValor) * uh
                }));
                const linePath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const path = document.createElementNS(ns, 'path');
                path.setAttribute('d', linePath);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', cor);
                path.setAttribute('stroke-width', '2.5');
                path.setAttribute('stroke-linejoin', 'round');
                if (tracejado) path.setAttribute('stroke-dasharray', '6 5');
                svg.appendChild(path);

                coords.forEach((p, i) => {
                    const circle = document.createElementNS(ns, 'circle');
                    circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
                    circle.setAttribute('r', tracejado ? '3' : '4');
                    circle.setAttribute('fill', cor);
                    circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '1.5');
                    circle.style.transition = 'r .12s ease';
                    svg.appendChild(circle);

                    // Círculo invisível maior por cima, só para facilitar o hover e acionar a caixinha flutuante
                    // (substitui o antigo <title> nativo do navegador, no mesmo padrão dos demais gráficos)
                    const raioBase = tracejado ? 3 : 4;
                    const raioHover = tracejado ? 5.5 : 6.5;
                    const hitArea = document.createElementNS(ns, 'circle');
                    hitArea.setAttribute('cx', p.x); hitArea.setAttribute('cy', p.y);
                    hitArea.setAttribute('r', '12'); hitArea.setAttribute('fill', 'transparent');
                    hitArea.style.cursor = 'pointer';
                    const textoTooltip = `<div class="tt-date">Dia ${i + 1} &middot; ${tracejado ? 'Período Anterior' : 'Período Atual'}</div><div class="tt-value">R$ ${formatMoeda(pontos[i])}</div>`;
                    hitArea.addEventListener('mouseenter', (evt) => { circle.setAttribute('r', String(raioHover)); showCrescimentoChartTooltip(evt, textoTooltip); });
                    hitArea.addEventListener('mousemove', (evt) => showCrescimentoChartTooltip(evt, textoTooltip));
                    hitArea.addEventListener('mouseleave', () => { circle.setAttribute('r', String(raioBase)); hideCrescimentoChartTooltip(); });
                    svg.appendChild(hitArea);
                });
            }

            // Rótulos do eixo X ("D1", "D2"...)
            const passoLabel = Math.max(1, Math.ceil(qtdDias / 9));
            for (let i = 0; i < qtdDias; i++) {
                if (i % passoLabel === 0 || i === qtdDias - 1) {
                    const x = qtdDias === 1 ? mL + uw / 2 : mL + (uw / (qtdDias - 1)) * i;
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', x); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '11'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = `D${i + 1}`;
                    svg.appendChild(text);
                }
            }

            montarLinha(pontosAnterior, '#98a2ac', true);
            montarLinha(pontosAtual, '#445b73', false);
        }

        document.getElementById('btn-crescimento-modo-geral').addEventListener('click', () => {
            crescimentoModo = 'geral';
            document.getElementById('btn-crescimento-modo-geral').classList.add('active');
            document.getElementById('btn-crescimento-modo-individual').classList.remove('active');
            renderAnaliseCrescimento();
        });
        document.getElementById('btn-crescimento-modo-individual').addEventListener('click', () => {
            crescimentoModo = 'individual';
            document.getElementById('btn-crescimento-modo-individual').classList.add('active');
            document.getElementById('btn-crescimento-modo-geral').classList.remove('active');
            renderAnaliseCrescimento();
        });

        // Busca por nome com pequeno debounce (evita recalcular a cada tecla digitada) + filtro de categoria
        let crescimentoBuscaTimeout = null;
        document.getElementById('input-crescimento-busca-produto').addEventListener('input', () => {
            clearTimeout(crescimentoBuscaTimeout);
            crescimentoBuscaTimeout = setTimeout(renderAnaliseCrescimento, 250);
        });
        document.getElementById('select-crescimento-categoria').addEventListener('change', renderAnaliseCrescimento);
        bindSortableHeaders('crescimento-tabela-produtos', 'crescimento-tabela-produtos', renderCrescimentoTabela);

        document.getElementById('btn-crescimento-semana').addEventListener('click', () => { crescimentoPreset = 'semana'; highlightCrescimentoPreset('semana'); renderAnaliseCrescimento(); });
        document.getElementById('btn-crescimento-mes').addEventListener('click', () => { crescimentoPreset = 'mes'; highlightCrescimentoPreset('mes'); renderAnaliseCrescimento(); });
        document.getElementById('btn-crescimento-ano').addEventListener('click', () => { crescimentoPreset = 'ano'; highlightCrescimentoPreset('ano'); renderAnaliseCrescimento(); });
        document.getElementById('btn-crescimento-custom').addEventListener('click', () => { crescimentoPreset = 'custom'; highlightCrescimentoPreset('custom'); renderAnaliseCrescimento(); });
        document.getElementById('btn-crescimento-aplicar-custom').addEventListener('click', renderAnaliseCrescimento);

        function highlightPeriodPresetVendidos(days) {
            document.getElementById('btn-vendidos-periodo-7d').classList.toggle('active', days === 7);
            document.getElementById('btn-vendidos-periodo-30d').classList.toggle('active', days === 30);
            document.getElementById('btn-vendidos-periodo-todos').classList.toggle('active', days === null);
        }

        function setVendidosPeriodPreset(days) {
            const fim = new Date();
            document.getElementById('vendidos-data-fim').value = dataISOparaBR(formatDateInputValue(fim));
            if (days !== null) {
                const inicio = new Date();
                inicio.setDate(fim.getDate() - (days - 1));
                document.getElementById('vendidos-data-inicio').value = dataISOparaBR(formatDateInputValue(inicio));
            } else {
                document.getElementById('vendidos-data-inicio').value = '';
            }
            highlightPeriodPresetVendidos(days);
            renderAnaliseMaisVendidos();
        }

        document.getElementById('btn-vendidos-periodo-7d').addEventListener('click', () => setVendidosPeriodPreset(7));
        document.getElementById('btn-vendidos-periodo-30d').addEventListener('click', () => setVendidosPeriodPreset(30));
        document.getElementById('btn-vendidos-periodo-todos').addEventListener('click', () => setVendidosPeriodPreset(null));
        document.getElementById('btn-vendidos-periodo-custom').addEventListener('click', () => { highlightPeriodPresetVendidos(-1); renderAnaliseMaisVendidos(); });
        document.getElementById('btn-vendidos-modo-vendidos').addEventListener('click', () => setVendidosModo('vendidos'));
        document.getElementById('btn-vendidos-modo-parados').addEventListener('click', () => setVendidosModo('parados'));
        document.getElementById('filtro-categoria-vendidos').addEventListener('change', renderAnaliseMaisVendidos);

        document.getElementById('btn-reposicao-periodo-7d').addEventListener('click', () => setReposicaoPeriodo(7));
        document.getElementById('btn-reposicao-periodo-14d').addEventListener('click', () => setReposicaoPeriodo(14));
        document.getElementById('btn-reposicao-periodo-30d').addEventListener('click', () => setReposicaoPeriodo(30));
        document.getElementById('filtro-categoria-reposicao').addEventListener('change', renderAnaliseReposicao);
        bindSortableHeaders('analise-reposicao-table', 'analise-reposicao-table', renderAnaliseReposicao);

        // ===== ABA 10 - ANÁLISE: NAVEGAÇÃO ENTRE O MENU DE CARDS E CADA VISUALIZAÇÃO =====
        function abrirAnaliseView(view) {
            document.getElementById('analise-cards-view').style.display = view === 'cards' ? 'grid' : 'none';
            document.getElementById('analise-margem-view').style.display = view === 'margem' ? 'block' : 'none';
            document.getElementById('analise-vendidos-view').style.display = view === 'vendidos' ? 'block' : 'none';
            document.getElementById('analise-crescimento-view').style.display = view === 'crescimento' ? 'block' : 'none';
            document.getElementById('analise-reposicao-view').style.display = view === 'reposicao' ? 'block' : 'none';
            document.getElementById('analise-fluxocaixa-view').style.display = view === 'fluxocaixa' ? 'block' : 'none';
            document.getElementById('analise-receber-view').style.display = view === 'receber' ? 'block' : 'none';
            document.getElementById('analise-clientes-view').style.display = view === 'clientes' ? 'block' : 'none';
            document.getElementById('analise-fornecedores-view').style.display = view === 'fornecedores' ? 'block' : 'none';
            document.getElementById('analise-producao-view').style.display = view === 'producao' ? 'block' : 'none';
            document.getElementById('analise-descontos-view').style.display = view === 'descontos' ? 'block' : 'none';
            document.getElementById('analise-abc-view').style.display = view === 'abc' ? 'block' : 'none';
            document.getElementById('analise-rentabilidade-cliente-view').style.display = view === 'rentabilidade-cliente' ? 'block' : 'none';
            document.getElementById('analise-sazonalidade-view').style.display = view === 'sazonalidade' ? 'block' : 'none';
            document.getElementById('analise-dre-view').style.display = view === 'dre' ? 'block' : 'none';
            if (view === 'margem') renderAnaliseMargemLucro();
            if (view === 'vendidos') renderAnaliseMaisVendidos();
            if (view === 'crescimento') renderAnaliseCrescimento();
            if (view === 'reposicao') renderAnaliseReposicao();
            if (view === 'fluxocaixa') renderAnaliseFluxoCaixa();
            if (view === 'receber') renderAnaliseContasReceber();
            if (view === 'clientes') renderAnaliseRankingClientes();
            if (view === 'fornecedores') renderAnaliseFornecedores();
            if (view === 'producao') renderAnaliseProducao();
            if (view === 'descontos') renderAnaliseDescontos();
            if (view === 'abc') renderAnaliseCurvaABC();
            if (view === 'rentabilidade-cliente') renderAnaliseRentabilidadeCliente();
            if (view === 'sazonalidade') renderAnaliseSazonalidade();
            if (view === 'dre') renderAnaliseDRE();
        }
        window.abrirAnaliseView = abrirAnaliseView;

        // ===== ABA 10 - ANÁLISE: FLUXO DE CAIXA & DESPESAS (agrupamento mensal das movimentações da Aba 6) =====
        function formatMesLabel(mesKey) {
            const [ano, mes] = mesKey.split('-');
            const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
            return `${nomes[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
        }

        // Calcula a variação percentual do mês atual em relação ao mês anterior e devolve o texto/classe
        // já prontos para o badge (▲/▼ + %). Trata os casos de "anterior = 0" para não dar Infinity/NaN.
        function calcularVariacaoMensal(valorAtual, valorAnterior) {
            if (valorAnterior === 0) {
                if (valorAtual === 0) return { texto: '- sem mudança', classe: 'var-neutro' };
                return { texto: `${valorAtual > 0 ? '▲' : '▼'} Novo`, classe: valorAtual > 0 ? 'var-up' : 'var-down' };
            }
            const pct = ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
            if (Math.abs(pct) < 0.05) return { texto: '- estável vs mês anterior', classe: 'var-neutro' };
            return { texto: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% vs mês anterior`, classe: pct >= 0 ? 'var-up' : 'var-down' };
        }
        function aplicarBadgeVariacao(elId, valorAtual, valorAnterior) {
            const el = document.getElementById(elId);
            if (!el) return;
            const { texto, classe } = calcularVariacaoMensal(valorAtual, valorAnterior);
            el.textContent = texto;
            el.className = 'fluxocaixa-var-badge ' + classe;
        }

        let fluxoCaixaPeriodoMeses = 12; // 6, 12, 24 ou null (tudo)
        let fluxoCaixaModoResultado = 'resultado'; // 'resultado', 'acumulado' ou 'ambos'
        function highlightFluxoCaixaModo(modo) {
            document.querySelectorAll('#btn-fluxocaixa-modo-resultado, #btn-fluxocaixa-modo-acumulado, #btn-fluxocaixa-modo-ambos').forEach(b => b.classList.remove('active'));
            const id = modo === 'acumulado' ? 'btn-fluxocaixa-modo-acumulado' : modo === 'ambos' ? 'btn-fluxocaixa-modo-ambos' : 'btn-fluxocaixa-modo-resultado';
            document.getElementById(id).classList.add('active');
        }
        function setFluxoCaixaModoResultado(modo) {
            fluxoCaixaModoResultado = modo;
            highlightFluxoCaixaModo(modo);
            renderAnaliseFluxoCaixa();
        }

        // Calcula, para TODOS os meses com histórico (independente do período 6/12/24/Tudo selecionado),
        // o saldo acumulado ao final de cada mês. Diferente do "Resultado do mês" (que soma só entradas/saídas
        // e propositalmente ignora Ajustes de Saldo manuais), o saldo acumulado precisa considerar os ajustes
        // também, pois eles representam o saldo real da conta. Para isso, ancora-se no saldo real atual
        // (fluxocaixa-saldo-total, que já reflete tudo, inclusive ajustes) e retrocede mês a mês subtraindo a
        // variação total (entradas - saídas + ajuste líquido) de cada mês.
        function calcularSaldoAcumuladoPorMes(saldoTotalAtual) {
            const todosMeses = getMesesRangeFluxoCaixa(null);
            const variacaoPorMes = {};
            Object.values(allLoadedMovimentacoesCaixa).forEach(m => {
                if (!m.data) return;
                if (m.tipo === 'transferencia' || m.transferenciaId) return;
                const mesKey = m.data.slice(0, 7);
                if (!variacaoPorMes[mesKey]) variacaoPorMes[mesKey] = 0;
                variacaoPorMes[mesKey] += (m.tipo === 'entrada' ? 1 : -1) * (m.valor || 0);
            });

            const saldoAcumuladoPorMes = {};
            if (todosMeses.length === 0) return saldoAcumuladoPorMes;

            // O último mês da lista é sempre o mês corrente, cujo saldo ao "final" (agora) é o saldo real atual.
            let saldoCursor = saldoTotalAtual;
            for (let i = todosMeses.length - 1; i >= 0; i--) {
                const mesKey = todosMeses[i];
                if (i === todosMeses.length - 1) {
                    saldoAcumuladoPorMes[mesKey] = saldoCursor;
                } else {
                    const mesSeguinte = todosMeses[i + 1];
                    saldoCursor = saldoCursor - (variacaoPorMes[mesSeguinte] || 0);
                    saldoAcumuladoPorMes[mesKey] = saldoCursor;
                }
            }
            return saldoAcumuladoPorMes;
        }

        function highlightFluxoCaixaPreset(meses) {
            document.querySelectorAll('#analise-fluxocaixa-view .btn-toggle-view').forEach(b => b.classList.remove('active'));
            const id = meses === 6 ? 'btn-fluxocaixa-periodo-6m' : meses === 12 ? 'btn-fluxocaixa-periodo-12m' : meses === 24 ? 'btn-fluxocaixa-periodo-24m' : 'btn-fluxocaixa-periodo-tudo';
            document.getElementById(id).classList.add('active');
        }
        function setFluxoCaixaPeriodPreset(meses) {
            fluxoCaixaPeriodoMeses = meses;
            highlightFluxoCaixaPreset(meses);
            renderAnaliseFluxoCaixa();
        }

        // Monta a lista de chaves de mês ('AAAA-MM') a exibir, preenchendo meses sem movimentação com zero
        function getMesesRangeFluxoCaixa(periodoMeses) {
            const hoje = new Date();
            let inicioAno, inicioMes;
            if (periodoMeses !== null) {
                const limite = new Date(hoje.getFullYear(), hoje.getMonth() - (periodoMeses - 1), 1);
                inicioAno = limite.getFullYear(); inicioMes = limite.getMonth();
            } else {
                const chaves = Object.values(allLoadedMovimentacoesCaixa)
                    .filter(m => m.data && m.tipo !== 'transferencia' && !m.transferenciaId && !m.ajuste)
                    .map(m => m.data.slice(0, 7));
                if (chaves.length === 0) return [];
                const menor = chaves.sort()[0];
                inicioAno = parseInt(menor.slice(0, 4), 10); inicioMes = parseInt(menor.slice(5, 7), 10) - 1;
            }
            const meses = [];
            const cursor = new Date(inicioAno, inicioMes, 1);
            const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            while (cursor <= fim) {
                meses.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
                cursor.setMonth(cursor.getMonth() + 1);
            }
            return meses;
        }

        function renderFluxoCaixaChart(meses, porMes, saldoAcumuladoPorMes) {
            const svg = document.getElementById('fluxocaixa-chart-svg');
            const emptyMsg = document.getElementById('fluxocaixa-chart-empty');
            const tooltip = document.getElementById('fluxocaixa-chart-tooltip');
            svg.innerHTML = '';
            tooltip.classList.remove('visible');

            if (meses.length === 0) {
                emptyMsg.style.display = 'block';
                svg.style.display = 'none';
                return;
            }
            emptyMsg.style.display = 'none';
            svg.style.display = 'block';

            const mostraLinhaAcumulado = fluxoCaixaModoResultado !== 'resultado';
            const elLegendaAcum = document.getElementById('fluxocaixa-legenda-acumulado');
            if (elLegendaAcum) elLegendaAcum.style.display = mostraLinhaAcumulado ? 'inline' : 'none';

            const ns = 'http://www.w3.org/2000/svg';
            const W = 900, H = 320;
            const mL = 72, mR = mostraLinhaAcumulado ? 62 : 20, mT = 24, mB = 54;
            const uw = W - mL - mR;
            const uh = H - mT - mB;
            const maxValor = Math.max(...meses.map(k => Math.max((porMes[k] && porMes[k].entradas) || 0, (porMes[k] && porMes[k].saidas) || 0)), 1);

            const valoresAcumulado = meses.map(k => saldoAcumuladoPorMes[k] ?? 0);
            const maxAcum = mostraLinhaAcumulado ? Math.max(...valoresAcumulado, 0) : 0;
            const minAcum = mostraLinhaAcumulado ? Math.min(...valoresAcumulado, 0) : 0;
            const spanAcum = Math.max(maxAcum - minAcum, 1);

            const ySteps = 5;
            for (let i = 0; i <= ySteps; i++) {
                const y = mT + (uh / ySteps) * i;
                const val = maxValor * (1 - i / ySteps);

                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', mL); line.setAttribute('x2', W - mR);
                line.setAttribute('y1', y); line.setAttribute('y2', y);
                line.setAttribute('stroke', document.documentElement.getAttribute('data-theme') === 'dark' ? (i === ySteps ? '#475569' : '#334155') : (i === ySteps ? '#c4cdd5' : '#eef1f3'));
                line.setAttribute('stroke-width', i === ySteps ? '1.5' : '1');
                svg.appendChild(line);

                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', mL - 10); text.setAttribute('y', y + 4);
                text.setAttribute('text-anchor', 'end');
                text.setAttribute('font-size', '11'); text.setAttribute('fill', 'var(--text-muted)');
                text.setAttribute('font-family', 'Segoe UI, sans-serif');
                text.textContent = `R$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)}`;
                svg.appendChild(text);
            }

            const eixoX = document.createElementNS(ns, 'line');
            eixoX.setAttribute('x1', mL); eixoX.setAttribute('x2', mL);
            eixoX.setAttribute('y1', mT); eixoX.setAttribute('y2', mT + uh);
            eixoX.setAttribute('stroke', '#c4cdd5'); eixoX.setAttribute('stroke-width', '1.5');
            svg.appendChild(eixoX);

            // Eixo secundário (direita) com a escala do Saldo Acumulado, quando exibido
            if (mostraLinhaAcumulado) {
                for (let i = 0; i <= ySteps; i++) {
                    const y = mT + (uh / ySteps) * i;
                    const val = maxAcum - (spanAcum / ySteps) * i;
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', W - mR + 10); text.setAttribute('y', y + 4);
                    text.setAttribute('text-anchor', 'start');
                    text.setAttribute('font-size', '10'); text.setAttribute('fill', '#0854a0');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = `R$${Math.abs(val) >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)}`;
                    svg.appendChild(text);
                }
            }

            const spacing = uw / meses.length;
            const groupW = spacing * 0.8;
            const barGap = 3;
            const barW = Math.max(3, (groupW - barGap) / 2);
            const passoLabel = Math.max(1, Math.ceil(meses.length / 12));

            // Mostra o tooltip estilizado com Entradas + Saídas + Resultado do mês (e Saldo Acumulado, se ativo), posicionado sobre a barra passada
            function mostrarTooltipFluxoCaixa(mesKey, referenceEl) {
                const dados = porMes[mesKey] || { entradas: 0, saidas: 0 };
                const resultadoMes = dados.entradas - dados.saidas;
                const saldoAcumMes = saldoAcumuladoPorMes[mesKey] ?? 0;
                tooltip.innerHTML = `
                    <div class="fct-mes">${formatMesLabel(mesKey)}</div>
                    <div class="fct-linha"><span class="fct-label"><span class="fct-dot" style="background:#0c5e2e;"></span>Entradas</span><span class="fct-valor" style="color:#0c5e2e;">R$ ${formatMoeda(dados.entradas)}</span></div>
                    <div class="fct-linha"><span class="fct-label"><span class="fct-dot" style="background:#bb0000;"></span>Saídas</span><span class="fct-valor" style="color:#bb0000;">R$ ${formatMoeda(dados.saidas)}</span></div>
                    ${fluxoCaixaModoResultado !== 'acumulado' ? `<div class="fct-linha fct-resultado"><span class="fct-label">Resultado do mês</span><span class="fct-valor" style="color:${resultadoMes >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">R$ ${formatMoeda(resultadoMes)}</span></div>` : ''}
                    ${mostraLinhaAcumulado ? `<div class="fct-linha ${fluxoCaixaModoResultado === 'acumulado' ? 'fct-resultado' : ''}"><span class="fct-label"><span class="fct-dot" style="background:#0854a0;"></span>Saldo acumulado</span><span class="fct-valor" style="color:#0854a0;">R$ ${formatMoeda(saldoAcumMes)}</span></div>` : ''}
                `;
                const wrapperRect = document.getElementById('fluxocaixa-chart-wrapper').getBoundingClientRect();
                const elRect = referenceEl.getBoundingClientRect();
                const centroXTela = elRect.left + elRect.width / 2 - wrapperRect.left;
                const topoTela = elRect.top - wrapperRect.top;
                tooltip.style.left = `${Math.min(Math.max(centroXTela, 90), wrapperRect.width - 90)}px`;
                tooltip.style.top = `${Math.max(topoTela, 0)}px`;
                tooltip.classList.add('visible');
            }
            function esconderTooltipFluxoCaixa() { tooltip.classList.remove('visible'); }

            meses.forEach((mesKey, i) => {
                const dados = porMes[mesKey] || { entradas: 0, saidas: 0 };
                const groupX = mL + i * spacing + (spacing - groupW) / 2;

                const hEnt = (dados.entradas / maxValor) * uh;
                const rectEnt = document.createElementNS(ns, 'rect');
                rectEnt.setAttribute('x', groupX); rectEnt.setAttribute('y', mT + uh - hEnt);
                rectEnt.setAttribute('width', barW); rectEnt.setAttribute('height', Math.max(hEnt, 1));
                rectEnt.setAttribute('rx', '2'); rectEnt.setAttribute('fill', '#0c5e2e');
                rectEnt.style.cursor = 'pointer';
                rectEnt.addEventListener('mouseenter', () => mostrarTooltipFluxoCaixa(mesKey, rectEnt));
                rectEnt.addEventListener('mouseleave', esconderTooltipFluxoCaixa);
                svg.appendChild(rectEnt);

                const hSai = (dados.saidas / maxValor) * uh;
                const xSai = groupX + barW + barGap;
                const rectSai = document.createElementNS(ns, 'rect');
                rectSai.setAttribute('x', xSai); rectSai.setAttribute('y', mT + uh - hSai);
                rectSai.setAttribute('width', barW); rectSai.setAttribute('height', Math.max(hSai, 1));
                rectSai.setAttribute('rx', '2'); rectSai.setAttribute('fill', '#bb0000');
                rectSai.style.cursor = 'pointer';
                rectSai.addEventListener('mouseenter', () => mostrarTooltipFluxoCaixa(mesKey, rectSai));
                rectSai.addEventListener('mouseleave', esconderTooltipFluxoCaixa);
                svg.appendChild(rectSai);

                if (i % passoLabel === 0 || i === meses.length - 1) {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', groupX + groupW / 2); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '10.5'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = formatMesLabel(mesKey);
                    svg.appendChild(text);
                }
            });

            // Linha do Saldo Acumulado (eixo secundário à direita), quando o modo de exibição inclui acumulado
            if (mostraLinhaAcumulado) {
                const pontos = meses.map((mesKey, i) => {
                    const groupX = mL + i * spacing + (spacing - groupW) / 2;
                    const cx = groupX + groupW / 2;
                    const val = saldoAcumuladoPorMes[mesKey] ?? 0;
                    const cy = mT + uh - ((val - minAcum) / spanAcum) * uh;
                    return { cx, cy, mesKey, val };
                });

                const polyline = document.createElementNS(ns, 'polyline');
                polyline.setAttribute('points', pontos.map(p => `${p.cx},${p.cy}`).join(' '));
                polyline.setAttribute('fill', 'none');
                polyline.setAttribute('stroke', '#0854a0');
                polyline.setAttribute('stroke-width', '2.5');
                polyline.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(polyline);

                pontos.forEach(p => {
                    const dot = document.createElementNS(ns, 'circle');
                    dot.setAttribute('cx', p.cx); dot.setAttribute('cy', p.cy); dot.setAttribute('r', '4');
                    dot.setAttribute('fill', '#0854a0'); dot.setAttribute('stroke', 'var(--bg-surface)'); dot.setAttribute('stroke-width', '1.5');
                    dot.style.cursor = 'pointer';
                    dot.addEventListener('mouseenter', () => mostrarTooltipFluxoCaixa(p.mesKey, dot));
                    dot.addEventListener('mouseleave', esconderTooltipFluxoCaixa);
                    svg.appendChild(dot);
                });
            }
        }

        function renderFluxoCaixaMensalTable(meses, porMes, saldoAcumuladoPorMes) {
            const tbody = document.getElementById('fluxocaixa-mensal-table-body');
            tbody.innerHTML = '';

            const thResultado = document.getElementById('fluxocaixa-mensal-th-resultado');
            const thAcumulado = document.getElementById('fluxocaixa-mensal-th-acumulado');
            const mostraResultado = fluxoCaixaModoResultado !== 'acumulado';
            const mostraAcumulado = fluxoCaixaModoResultado !== 'resultado';
            thResultado.style.display = mostraResultado ? '' : 'none';
            thAcumulado.style.display = mostraAcumulado ? '' : 'none';
            const colspan = 3 + (mostraResultado ? 1 : 0) + (mostraAcumulado ? 1 : 0);

            if (meses.length === 0) {
                tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma movimentação registrada.</td></tr>`;
                return;
            }

            let lista = meses.map(k => {
                const d = porMes[k] || { entradas: 0, saidas: 0 };
                return { mesKey: k, mes: formatMesLabel(k), entradas: d.entradas, saidas: d.saidas, resultado: d.entradas - d.saidas, saldoAcumulado: saldoAcumuladoPorMes[k] ?? 0 };
            });

            const state = getSortState('fluxocaixa-mensal-table');
            lista = state.key ? ordenarPorEstado(lista, 'fluxocaixa-mensal-table') : lista.sort((a, b) => a.mesKey.localeCompare(b.mesKey));

            lista.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.mes}</strong></td>
                    <td style="color:var(--color-positive); font-weight:600;">R$ ${formatMoeda(r.entradas)}</td>
                    <td style="color:var(--color-negative); font-weight:600;">R$ ${formatMoeda(r.saidas)}</td>
                    ${mostraResultado ? `<td style="font-weight:700; color:${r.resultado >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">R$ ${formatMoeda(r.resultado)}</td>` : ''}
                    ${mostraAcumulado ? `<td style="font-weight:700; color:${r.saldoAcumulado >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">R$ ${formatMoeda(r.saldoAcumulado)}</td>` : ''}
                `;
                tbody.appendChild(tr);
            });
        }

        function renderFluxoCaixaDespesasTable(meses) {
            const tbody = document.getElementById('fluxocaixa-despesas-table-body');
            tbody.innerHTML = '';
            const mesesSet = new Set(meses);

            const porDescricao = {};
            let totalSaidas = 0;
            Object.values(allLoadedMovimentacoesCaixa).forEach(m => {
                if (!m.data || m.tipo !== 'saida') return;
                if (m.transferenciaId || m.ajuste) return;
                if (!mesesSet.has(m.data.slice(0, 7))) return;
                const desc = (m.descricao && m.descricao.trim()) || 'Sem descrição';
                if (!porDescricao[desc]) porDescricao[desc] = { total: 0, qtd: 0 };
                porDescricao[desc].total += (m.valor || 0);
                porDescricao[desc].qtd += 1;
                totalSaidas += (m.valor || 0);
            });

            if (Object.keys(porDescricao).length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma saída registrada no período selecionado.</td></tr>';
                return;
            }

            let lista = Object.keys(porDescricao).map(desc => ({
                descricao: desc,
                qtd: porDescricao[desc].qtd,
                total: porDescricao[desc].total,
                percentual: totalSaidas > 0 ? (porDescricao[desc].total / totalSaidas * 100) : 0
            }));

            const state = getSortState('fluxocaixa-despesas-table');
            lista = state.key ? ordenarPorEstado(lista, 'fluxocaixa-despesas-table') : lista.sort((a, b) => b.total - a.total);

            lista.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.descricao}</td>
                    <td>${r.qtd}</td>
                    <td style="color:var(--color-negative); font-weight:600;">R$ ${formatMoeda(r.total)}</td>
                    <td>${r.percentual.toFixed(1)}%</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function renderFluxoCaixaContaTable(meses) {
            const tbody = document.getElementById('fluxocaixa-conta-table-body');
            tbody.innerHTML = '';
            const mesesSet = new Set(meses);

            const porConta = {};
            Object.values(allLoadedMovimentacoesCaixa).forEach(m => {
                if (!m.data) return;
                if (m.tipo === 'transferencia' || m.transferenciaId) return;
                if (m.ajuste) return;
                if (!mesesSet.has(m.data.slice(0, 7))) return;
                const conta = m.contaNome || 'Sem conta';
                if (!porConta[conta]) porConta[conta] = { conta, entradas: 0, saidas: 0 };
                if (m.tipo === 'entrada') porConta[conta].entradas += (m.valor || 0);
                else porConta[conta].saidas += (m.valor || 0);
            });

            let lista = Object.values(porConta).map(c => ({ ...c, resultado: c.entradas - c.saidas }));

            if (lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma movimentação registrada no período.</td></tr>';
                return;
            }

            const state = getSortState('fluxocaixa-conta-table');
            lista = state.key ? ordenarPorEstado(lista, 'fluxocaixa-conta-table') : lista.sort((a, b) => b.resultado - a.resultado);

            lista.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.conta}</strong></td>
                    <td style="color:var(--color-positive); font-weight:600;">R$ ${formatMoeda(r.entradas)}</td>
                    <td style="color:var(--color-negative); font-weight:600;">R$ ${formatMoeda(r.saidas)}</td>
                    <td style="font-weight:700; color:${r.resultado >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">R$ ${formatMoeda(r.resultado)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Soma o total de vendas CONFIRMADA (fiado) ainda em aberto — mesma regra usada no card de Contas a Receber
        function getTotalPrevistoReceber() {
            let total = 0;
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if (s.status !== 'CONFIRMADA') return;
                total += (s.totalValue || 0);
            });
            return total;
        }

        function renderAnaliseFluxoCaixa() {
            const saldoTotal = Object.values(allLoadedContas).reduce((acc, c) => acc + parseFloat(c.saldo || 0), 0);
            document.getElementById('fluxocaixa-saldo-total').innerText = `R$ ${formatMoeda(saldoTotal)}`;
            const saldoAcumuladoPorMes = calcularSaldoAcumuladoPorMes(saldoTotal);

            // Agrupa TODAS as movimentações por mês (transferências entre contas e ajustes de saldo não entram:
            // não representam dinheiro real entrando/saindo da empresa, só mudança de conta ou correção)
            const porMes = {};
            Object.values(allLoadedMovimentacoesCaixa).forEach(m => {
                if (!m.data) return;
                if (m.tipo === 'transferencia' || m.transferenciaId) return;
                if (m.ajuste) return;
                const mesKey = m.data.slice(0, 7);
                if (!porMes[mesKey]) porMes[mesKey] = { entradas: 0, saidas: 0 };
                if (m.tipo === 'entrada') porMes[mesKey].entradas += (m.valor || 0);
                else porMes[mesKey].saidas += (m.valor || 0);
            });

            const meses = getMesesRangeFluxoCaixa(fluxoCaixaPeriodoMeses);

            let totalEntradasPeriodo = 0, totalSaidasPeriodo = 0;
            meses.forEach(k => {
                const d = porMes[k] || { entradas: 0, saidas: 0 };
                totalEntradasPeriodo += d.entradas; totalSaidasPeriodo += d.saidas;
            });
            document.getElementById('fluxocaixa-entradas-periodo').innerText = `R$ ${formatMoeda(totalEntradasPeriodo)}`;
            document.getElementById('fluxocaixa-saidas-periodo').innerText = `R$ ${formatMoeda(totalSaidasPeriodo)}`;
            const resultado = totalEntradasPeriodo - totalSaidasPeriodo;
            const ultimoMesPeriodo = meses[meses.length - 1];
            const saldoAcumuladoFimPeriodo = ultimoMesPeriodo !== undefined ? (saldoAcumuladoPorMes[ultimoMesPeriodo] ?? saldoTotal) : saldoTotal;

            const elResultadoLabel = document.getElementById('fluxocaixa-resultado-periodo-label');
            const elResultado = document.getElementById('fluxocaixa-resultado-periodo');
            const elResultadoExtra = document.getElementById('fluxocaixa-resultado-periodo-extra');
            if (fluxoCaixaModoResultado === 'acumulado') {
                elResultadoLabel.innerText = 'Saldo Acumulado (fim do período)';
                elResultado.innerText = `R$ ${formatMoeda(saldoAcumuladoFimPeriodo)}`;
                elResultado.style.color = saldoAcumuladoFimPeriodo >= 0 ? 'var(--color-positive)' : 'var(--color-negative)';
                elResultadoExtra.style.display = 'none';
            } else {
                elResultadoLabel.innerText = 'Resultado no Período';
                elResultado.innerText = `R$ ${formatMoeda(resultado)}`;
                elResultado.style.color = resultado >= 0 ? 'var(--color-positive)' : 'var(--color-negative)';
                if (fluxoCaixaModoResultado === 'ambos') {
                    elResultadoExtra.style.display = 'block';
                    elResultadoExtra.innerHTML = `Saldo acumulado no fim do período: <strong style="color:${saldoAcumuladoFimPeriodo >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">R$ ${formatMoeda(saldoAcumuladoFimPeriodo)}</strong>`;
                } else {
                    elResultadoExtra.style.display = 'none';
                }
            }

            document.getElementById('fluxocaixa-previsto-receber').innerText = `R$ ${formatMoeda(getTotalPrevistoReceber())}`;

            // VARIAÇÃO % MÊS ATUAL vs MÊS ANTERIOR (sempre compara os dois últimos meses corridos, independente
            // do período 6/12/24/Tudo selecionado acima, que só afeta o gráfico/tabela).
            const hoje = new Date();
            const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
            const mesAnteriorDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            const mesAnteriorKey = `${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth() + 1).padStart(2, '0')}`;
            const dadosMesAtual = porMes[mesAtualKey] || { entradas: 0, saidas: 0 };
            const dadosMesAnterior = porMes[mesAnteriorKey] || { entradas: 0, saidas: 0 };
            const resultadoMesAtual = dadosMesAtual.entradas - dadosMesAtual.saidas;
            const resultadoMesAnterior = dadosMesAnterior.entradas - dadosMesAnterior.saidas;
            // CORREÇÃO: antes o saldo do início do mês era deduzido só com o resultado do mês (saldoTotal - resultadoMesAtual),
            // o que ignorava Ajustes de Saldo manuais feitos no mês e distorcia esse percentual. Agora usa o saldo acumulado
            // do mês anterior, já calculado considerando entradas, saídas E ajustes.
            const saldoInicioMesAtual = saldoAcumuladoPorMes[mesAnteriorKey] ?? (saldoTotal - resultadoMesAtual);

            aplicarBadgeVariacao('fluxocaixa-entradas-periodo-var', dadosMesAtual.entradas, dadosMesAnterior.entradas);
            aplicarBadgeVariacao('fluxocaixa-saidas-periodo-var', dadosMesAtual.saidas, dadosMesAnterior.saidas);
            if (fluxoCaixaModoResultado === 'acumulado') {
                aplicarBadgeVariacao('fluxocaixa-resultado-periodo-var', saldoAcumuladoPorMes[mesAtualKey] ?? saldoTotal, saldoInicioMesAtual);
            } else {
                aplicarBadgeVariacao('fluxocaixa-resultado-periodo-var', resultadoMesAtual, resultadoMesAnterior);
            }
            aplicarBadgeVariacao('fluxocaixa-saldo-total-var', saldoTotal, saldoInicioMesAtual);

            renderFluxoCaixaChart(meses, porMes, saldoAcumuladoPorMes);
            renderFluxoCaixaContaTable(meses);
            renderFluxoCaixaMensalTable(meses, porMes, saldoAcumuladoPorMes);
            renderFluxoCaixaDespesasTable(meses);
        }
        window.renderAnaliseFluxoCaixa = renderAnaliseFluxoCaixa;

        document.getElementById('btn-fluxocaixa-periodo-6m').addEventListener('click', () => setFluxoCaixaPeriodPreset(6));
        document.getElementById('btn-fluxocaixa-periodo-12m').addEventListener('click', () => setFluxoCaixaPeriodPreset(12));
        document.getElementById('btn-fluxocaixa-periodo-24m').addEventListener('click', () => setFluxoCaixaPeriodPreset(24));
        document.getElementById('btn-fluxocaixa-periodo-tudo').addEventListener('click', () => setFluxoCaixaPeriodPreset(null));
        document.getElementById('btn-fluxocaixa-modo-resultado').addEventListener('click', () => setFluxoCaixaModoResultado('resultado'));
        document.getElementById('btn-fluxocaixa-modo-acumulado').addEventListener('click', () => setFluxoCaixaModoResultado('acumulado'));
        document.getElementById('btn-fluxocaixa-modo-ambos').addEventListener('click', () => setFluxoCaixaModoResultado('ambos'));

        // ===== ABA 10 - ANÁLISE: DRE (DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO) =====
        // Regime de competência para a Receita (agrupada por data da venda, s.salesDate) e CMV (custo atual
        // de cada produto, mesma fonte usada no card de Margem de Lucro). As Despesas Operacionais usam as
        // saídas de caixa da Aba 6 (mesma base do Fluxo de Caixa), EXCETO as saídas ligadas a uma compra que
        // contenha algum item de matéria-prima (compra.itens com semEstoque=false) — essas já estão embutidas
        // no CMV via custo do produto, e somá-las de novo aqui contaria o mesmo custo duas vezes. Saídas de
        // compras 100% "não é matéria-prima" (embalagem, material de uso etc.) continuam nas Despesas.
        let drePeriodoMeses = 12; // 6, 12, 24 ou null (tudo)
        function highlightDrePeriodo(meses) {
            document.querySelectorAll('#analise-dre-view .btn-toggle-view').forEach(b => b.classList.remove('active'));
            const id = meses === 6 ? 'btn-dre-periodo-6m' : meses === 12 ? 'btn-dre-periodo-12m' : meses === 24 ? 'btn-dre-periodo-24m' : 'btn-dre-periodo-tudo';
            document.getElementById(id).classList.add('active');
        }
        function setDrePeriodPreset(meses) {
            drePeriodoMeses = meses;
            highlightDrePeriodo(meses);
            renderAnaliseDRE();
        }

        function getMesesRangeDRE(periodoMeses) {
            const hoje = new Date();
            let inicioAno, inicioMes;
            if (periodoMeses !== null) {
                const limite = new Date(hoje.getFullYear(), hoje.getMonth() - (periodoMeses - 1), 1);
                inicioAno = limite.getFullYear(); inicioMes = limite.getMonth();
            } else {
                const chavesVendas = Object.values(allLoadedSales)
                    .filter(s => !s.origemCredito && (s.status || 'PAGO') !== 'RASCUNHO' && s.salesDate)
                    .map(s => s.salesDate.slice(0, 7));
                const chavesCaixa = Object.values(allLoadedMovimentacoesCaixa)
                    .filter(m => m.data && m.tipo !== 'transferencia' && !m.transferenciaId && !m.ajuste)
                    .map(m => m.data.slice(0, 7));
                const chaves = chavesVendas.concat(chavesCaixa);
                if (chaves.length === 0) return [];
                const menor = chaves.sort()[0];
                inicioAno = parseInt(menor.slice(0, 4), 10); inicioMes = parseInt(menor.slice(5, 7), 10) - 1;
            }
            const meses = [];
            const cursor = new Date(inicioAno, inicioMes, 1);
            const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            while (cursor <= fim) {
                meses.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
                cursor.setMonth(cursor.getMonth() + 1);
            }
            return meses;
        }

        // Chaves de compra (Aba 7) que contêm ao menos um item de matéria-prima — usadas para não contar a
        // saída de caixa dessa compra como Despesa Operacional (o custo já está no CMV via custo do produto)
        function getCompraKeysComMateriaPrima() {
            const set = new Set();
            Object.keys(allLoadedComprasSuprimentos).forEach(key => {
                const c = allLoadedComprasSuprimentos[key];
                if (c.itens && c.itens.some(it => !it.semEstoque)) set.add(key);
            });
            return set;
        }

        function calcularDREPorMes() {
            const porMes = {};
            function garanteMes(mesKey) {
                if (!porMes[mesKey]) porMes[mesKey] = { receitaBruta: 0, receitaLiquida: 0, cmv: 0, despesasOp: 0 };
                return porMes[mesKey];
            }

            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate || !s.items) return;
                const mesKey = s.salesDate.slice(0, 7);
                const dados = garanteMes(mesKey);
                s.items.forEach(item => {
                    const qtd = item.quantity || 0;
                    const bruto = (item.sellingPrice || 0) * qtd;
                    const liquido = item.totalItemNet != null ? item.totalItemNet : bruto;
                    dados.receitaBruta += bruto;
                    dados.receitaLiquida += liquido;
                    if (item.productKey && allLoadedProducts[item.productKey]) {
                        dados.cmv += getCustoEfetivoProduto(allLoadedProducts[item.productKey]) * qtd;
                    }
                });
            });

            const compraKeysMateriaPrima = getCompraKeysComMateriaPrima();
            Object.values(allLoadedMovimentacoesCaixa).forEach(m => {
                if (!m.data || m.tipo !== 'saida') return;
                if (m.transferenciaId || m.ajuste) return;
                if (m.compraKey && compraKeysMateriaPrima.has(m.compraKey)) return;
                const mesKey = m.data.slice(0, 7);
                garanteMes(mesKey).despesasOp += (m.valor || 0);
            });

            return porMes;
        }

        function renderDREChart(meses, porMes) {
            const svg = document.getElementById('dre-chart-svg');
            const emptyMsg = document.getElementById('dre-chart-empty');
            const tooltip = document.getElementById('dre-chart-tooltip');
            svg.innerHTML = '';
            tooltip.classList.remove('visible');

            if (meses.length === 0) {
                emptyMsg.style.display = 'block';
                svg.style.display = 'none';
                return;
            }
            emptyMsg.style.display = 'none';
            svg.style.display = 'block';

            const ns = 'http://www.w3.org/2000/svg';
            const W = 900, H = 320;
            const mL = 72, mR = 20, mT = 24, mB = 54;
            const uw = W - mL - mR;
            const uh = H - mT - mB;

            const linhas = meses.map(k => {
                const d = porMes[k] || { receitaLiquida: 0, cmv: 0, despesasOp: 0 };
                const custosTotais = d.cmv + d.despesasOp;
                const lucroLiquido = d.receitaLiquida - custosTotais;
                return { mesKey: k, receitaLiquida: d.receitaLiquida, custosTotais, lucroLiquido };
            });

            const maxBarra = Math.max(...linhas.map(l => Math.max(l.receitaLiquida, l.custosTotais)), 1);
            const maxLucro = Math.max(...linhas.map(l => l.lucroLiquido), 0);
            const minLucro = Math.min(...linhas.map(l => l.lucroLiquido), 0);
            const maxEscala = Math.max(maxBarra, maxLucro, Math.abs(minLucro), 1);

            const ySteps = 5;
            for (let i = 0; i <= ySteps; i++) {
                const y = mT + (uh / ySteps) * i;
                const val = maxEscala * (1 - i / ySteps);
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', mL); line.setAttribute('x2', W - mR);
                line.setAttribute('y1', y); line.setAttribute('y2', y);
                line.setAttribute('stroke', document.documentElement.getAttribute('data-theme') === 'dark' ? (i === ySteps ? '#475569' : '#334155') : (i === ySteps ? '#c4cdd5' : '#eef1f3'));
                line.setAttribute('stroke-width', i === ySteps ? '1.5' : '1');
                svg.appendChild(line);

                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', mL - 10); text.setAttribute('y', y + 4);
                text.setAttribute('text-anchor', 'end');
                text.setAttribute('font-size', '11'); text.setAttribute('fill', 'var(--text-muted)');
                text.setAttribute('font-family', 'var(--font-sans)');
                text.textContent = `R$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)}`;
                svg.appendChild(text);
            }

            const eixoX = document.createElementNS(ns, 'line');
            eixoX.setAttribute('x1', mL); eixoX.setAttribute('x2', mL);
            eixoX.setAttribute('y1', mT); eixoX.setAttribute('y2', mT + uh);
            eixoX.setAttribute('stroke', '#c4cdd5'); eixoX.setAttribute('stroke-width', '1.5');
            svg.appendChild(eixoX);

            const spacing = uw / meses.length;
            const groupW = spacing * 0.8;
            const barGap = 3;
            const barW = Math.max(3, (groupW - barGap) / 2);
            const passoLabel = Math.max(1, Math.ceil(meses.length / 12));

            function mostrarTooltipDRE(mesKey, referenceEl) {
                const d = porMes[mesKey] || { receitaBruta: 0, receitaLiquida: 0, cmv: 0, despesasOp: 0 };
                const lucroBruto = d.receitaLiquida - d.cmv;
                const lucroLiquido = lucroBruto - d.despesasOp;
                const margem = d.receitaLiquida > 0 ? (lucroLiquido / d.receitaLiquida * 100) : 0;
                tooltip.innerHTML = `
                    <div class="fct-mes">${formatMesLabel(mesKey)}</div>
                    <div class="fct-linha"><span class="fct-label"><span class="fct-dot" style="background:var(--color-primary);"></span>Receita Líquida</span><span class="fct-valor" style="color:var(--color-primary);">R$ ${formatMoeda(d.receitaLiquida)}</span></div>
                    <div class="fct-linha"><span class="fct-label"><span class="fct-dot" style="background:var(--color-negative);"></span>CMV</span><span class="fct-valor" style="color:var(--color-negative);">R$ ${formatMoeda(d.cmv)}</span></div>
                    <div class="fct-linha"><span class="fct-label"><span class="fct-dot" style="background:var(--color-negative);"></span>Despesas Op.</span><span class="fct-valor" style="color:var(--color-negative);">R$ ${formatMoeda(d.despesasOp)}</span></div>
                    <div class="fct-linha fct-resultado"><span class="fct-label">Lucro Líquido</span><span class="fct-valor" style="color:${lucroLiquido >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">R$ ${formatMoeda(lucroLiquido)} (${margem.toFixed(1)}%)</span></div>
                `;
                const wrapperRect = document.getElementById('dre-chart-wrapper').getBoundingClientRect();
                const elRect = referenceEl.getBoundingClientRect();
                const centroXTela = elRect.left + elRect.width / 2 - wrapperRect.left;
                const topoTela = elRect.top - wrapperRect.top;
                tooltip.style.left = `${Math.min(Math.max(centroXTela, 90), wrapperRect.width - 90)}px`;
                tooltip.style.top = `${Math.max(topoTela, 0)}px`;
                tooltip.classList.add('visible');
            }
            function esconderTooltipDRE() { tooltip.classList.remove('visible'); }

            linhas.forEach((l, i) => {
                const groupX = mL + i * spacing + (spacing - groupW) / 2;

                const hRec = (l.receitaLiquida / maxEscala) * uh;
                const rectRec = document.createElementNS(ns, 'rect');
                rectRec.setAttribute('x', groupX); rectRec.setAttribute('y', mT + uh - hRec);
                rectRec.setAttribute('width', barW); rectRec.setAttribute('height', Math.max(hRec, 1));
                rectRec.setAttribute('rx', '2'); rectRec.setAttribute('fill', 'var(--color-primary)');
                rectRec.style.cursor = 'pointer';
                rectRec.addEventListener('mouseenter', () => mostrarTooltipDRE(l.mesKey, rectRec));
                rectRec.addEventListener('mouseleave', esconderTooltipDRE);
                svg.appendChild(rectRec);

                const hCus = (l.custosTotais / maxEscala) * uh;
                const xCus = groupX + barW + barGap;
                const rectCus = document.createElementNS(ns, 'rect');
                rectCus.setAttribute('x', xCus); rectCus.setAttribute('y', mT + uh - hCus);
                rectCus.setAttribute('width', barW); rectCus.setAttribute('height', Math.max(hCus, 1));
                rectCus.setAttribute('rx', '2'); rectCus.setAttribute('fill', 'var(--color-negative)');
                rectCus.style.cursor = 'pointer';
                rectCus.addEventListener('mouseenter', () => mostrarTooltipDRE(l.mesKey, rectCus));
                rectCus.addEventListener('mouseleave', esconderTooltipDRE);
                svg.appendChild(rectCus);

                if (i % passoLabel === 0 || i === meses.length - 1) {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', groupX + groupW / 2); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '10.5'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'var(--font-sans)');
                    text.textContent = formatMesLabel(l.mesKey);
                    svg.appendChild(text);
                }
            });

            // Linha do Lucro Líquido, na mesma escala das barras acima (0 a maxEscala)
            const pontos = linhas.map((l, i) => {
                const groupX = mL + i * spacing + (spacing - groupW) / 2;
                const cx = groupX + groupW / 2;
                const cy = mT + uh - (l.lucroLiquido / maxEscala) * uh;
                return { cx, cy: Math.max(mT, Math.min(mT + uh, cy)), mesKey: l.mesKey };
            });
            const polyline = document.createElementNS(ns, 'polyline');
            polyline.setAttribute('points', pontos.map(p => `${p.cx},${p.cy}`).join(' '));
            polyline.setAttribute('fill', 'none');
            polyline.setAttribute('stroke', 'var(--color-positive-active)');
            polyline.setAttribute('stroke-width', '2.5');
            polyline.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(polyline);
            pontos.forEach(p => {
                const dot = document.createElementNS(ns, 'circle');
                dot.setAttribute('cx', p.cx); dot.setAttribute('cy', p.cy); dot.setAttribute('r', '4');
                dot.setAttribute('fill', 'var(--color-positive-active)'); dot.setAttribute('stroke', 'var(--bg-surface)'); dot.setAttribute('stroke-width', '1.5');
                dot.style.cursor = 'pointer';
                dot.addEventListener('mouseenter', () => mostrarTooltipDRE(p.mesKey, dot));
                dot.addEventListener('mouseleave', esconderTooltipDRE);
                svg.appendChild(dot);
            });
        }

        function renderDREMensalTable(meses, porMes) {
            const tbody = document.getElementById('dre-mensal-table-body');
            let lista = meses.map(mesKey => {
                const d = porMes[mesKey] || { receitaBruta: 0, receitaLiquida: 0, cmv: 0, despesasOp: 0 };
                const descontos = Math.max(0, d.receitaBruta - d.receitaLiquida);
                const lucroBruto = d.receitaLiquida - d.cmv;
                const lucroLiquido = lucroBruto - d.despesasOp;
                const margemLiquida = d.receitaLiquida > 0 ? (lucroLiquido / d.receitaLiquida * 100) : 0;
                return { mesKey, receitaBruta: d.receitaBruta, descontos, receitaLiquida: d.receitaLiquida, cmv: d.cmv, lucroBruto, despesasOp: d.despesasOp, lucroLiquido, margemLiquida };
            });

            lista = ordenarPorEstado(lista, 'dre-mensal-table');

            if (lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma venda registrada ainda.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            lista.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatMesLabel(r.mesKey)}</td>
                    <td>R$ ${formatMoeda(r.receitaBruta)}</td>
                    <td style="color:var(--color-negative);">R$ ${formatMoeda(r.descontos)}</td>
                    <td style="font-weight:600;">R$ ${formatMoeda(r.receitaLiquida)}</td>
                    <td style="color:var(--color-negative);">R$ ${formatMoeda(r.cmv)}</td>
                    <td>R$ ${formatMoeda(r.lucroBruto)}</td>
                    <td style="color:var(--color-negative);">R$ ${formatMoeda(r.despesasOp)}</td>
                    <td style="font-weight:700; color:${r.lucroLiquido >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">R$ ${formatMoeda(r.lucroLiquido)}</td>
                    <td style="font-weight:700; color:${r.lucroLiquido >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">${r.margemLiquida.toFixed(1)}%</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function renderAnaliseDRE() {
            const porMes = calcularDREPorMes();
            const meses = getMesesRangeDRE(drePeriodoMeses);

            let receitaBruta = 0, receitaLiquida = 0, cmv = 0, despesasOp = 0;
            meses.forEach(k => {
                const d = porMes[k] || { receitaBruta: 0, receitaLiquida: 0, cmv: 0, despesasOp: 0 };
                receitaBruta += d.receitaBruta; receitaLiquida += d.receitaLiquida; cmv += d.cmv; despesasOp += d.despesasOp;
            });
            const lucroBruto = receitaLiquida - cmv;
            const lucroLiquido = lucroBruto - despesasOp;
            const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida * 100) : 0;

            document.getElementById('dre-receita-liquida').innerText = `R$ ${formatMoeda(receitaLiquida)}`;
            document.getElementById('dre-cmv').innerText = `R$ ${formatMoeda(cmv)}`;
            const elLucroBruto = document.getElementById('dre-lucro-bruto');
            elLucroBruto.innerText = `R$ ${formatMoeda(lucroBruto)}`;
            elLucroBruto.style.color = lucroBruto >= 0 ? 'var(--text-strong)' : 'var(--color-negative)';
            document.getElementById('dre-despesas-op').innerText = `R$ ${formatMoeda(despesasOp)}`;
            const elLucroLiquido = document.getElementById('dre-lucro-liquido');
            elLucroLiquido.innerText = `R$ ${formatMoeda(lucroLiquido)}`;
            elLucroLiquido.style.color = lucroLiquido >= 0 ? 'var(--color-positive)' : 'var(--color-negative)';
            document.getElementById('dre-margem-liquida').innerText = receitaLiquida > 0 ? `Margem líquida: ${margemLiquida.toFixed(1)}%` : '-';

            renderDREChart(meses, porMes);
            renderDREMensalTable(meses, porMes);
        }
        window.renderAnaliseDRE = renderAnaliseDRE;

        document.getElementById('btn-dre-periodo-6m').addEventListener('click', () => setDrePeriodPreset(6));
        document.getElementById('btn-dre-periodo-12m').addEventListener('click', () => setDrePeriodPreset(12));
        document.getElementById('btn-dre-periodo-24m').addEventListener('click', () => setDrePeriodPreset(24));
        document.getElementById('btn-dre-periodo-tudo').addEventListener('click', () => setDrePeriodPreset(null));

        // ===== ABA 10 - ANÁLISE: CONTAS A RECEBER (VENDAS CONFIRMADA EM ABERTO) =====
        function renderAnaliseContasReceber() {
            const tbody = document.getElementById('contas-receber-table-body');
            const vazio = document.getElementById('contas-receber-vazio');
            tbody.innerHTML = '';
            const hoje = formatDateInputValue(new Date());

            const porCliente = {};
            let totalGeral = 0, totalEmDia = 0, totalVencido = 0, totalSemVencimento = 0, clientesComAtraso = 0;
            let faixa1a15 = 0, faixa16a30 = 0, faixa31mais = 0;
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if (s.status !== 'CONFIRMADA') return;
                const cliente = s.clientName || 'Cliente não informado';
                const valor = s.totalValue || 0;
                // CORREÇÃO: antes, vendas sem vencimento cadastrado usavam a própria data da venda como
                // vencimento (s.salesDueDate || s.salesDate), o que fazia toda venda fiado sem prazo definido
                // virar "atrasada" já no dia seguinte. Agora só considera vencida quando HÁ uma data de
                // vencimento explícita e ela já passou; sem vencimento cadastrado vira uma categoria própria.
                const vencimento = s.salesDueDate || null;
                const temVencimento = !!vencimento;
                const vencida = temVencimento && vencimento < hoje;
                const diasAtraso = vencida ? Math.round((new Date(hoje + 'T00:00:00') - new Date(vencimento + 'T00:00:00')) / 86400000) : 0;

                if (!porCliente[cliente]) porCliente[cliente] = { cliente, total: 0, qtd: 0, vencimentoMaisAntigo: null, temVencida: false, temSemVencimento: false };
                porCliente[cliente].total += valor;
                porCliente[cliente].qtd += 1;
                if (temVencimento && (!porCliente[cliente].vencimentoMaisAntigo || vencimento < porCliente[cliente].vencimentoMaisAntigo)) {
                    porCliente[cliente].vencimentoMaisAntigo = vencimento;
                }
                if (vencida) porCliente[cliente].temVencida = true;
                if (!temVencimento) porCliente[cliente].temSemVencimento = true;

                if (vencida) {
                    totalVencido += valor;
                    if (diasAtraso <= 15) faixa1a15 += valor;
                    else if (diasAtraso <= 30) faixa16a30 += valor;
                    else faixa31mais += valor;
                } else if (!temVencimento) {
                    totalSemVencimento += valor;
                } else {
                    totalEmDia += valor;
                }
                totalGeral += valor;
            });

            Object.values(porCliente).forEach(c => { if (c.temVencida) clientesComAtraso++; });

            document.getElementById('contas-receber-total').innerText = `R$ ${formatMoeda(totalGeral)}`;
            document.getElementById('contas-receber-em-dia').innerText = `R$ ${formatMoeda(totalEmDia)}`;
            document.getElementById('contas-receber-vencido').innerText = `R$ ${formatMoeda(totalVencido)}`;
            document.getElementById('contas-receber-sem-vencimento').innerText = `R$ ${formatMoeda(totalSemVencimento)}`;
            document.getElementById('contas-receber-qtd-vencidas').innerText = clientesComAtraso;
            document.getElementById('contas-receber-faixa-1-15').innerText = `R$ ${formatMoeda(faixa1a15)}`;
            document.getElementById('contas-receber-faixa-16-30').innerText = `R$ ${formatMoeda(faixa16a30)}`;
            document.getElementById('contas-receber-faixa-31-mais').innerText = `R$ ${formatMoeda(faixa31mais)}`;

            let lista = Object.values(porCliente);
            if (lista.length === 0) { vazio.style.display = 'block'; return; }
            vazio.style.display = 'none';

            const state = getSortState('contas-receber-table');
            lista = state.key ? ordenarPorEstado(lista, 'contas-receber-table') : lista.sort((a, b) => b.total - a.total);

            lista.forEach(r => {
                const diasAtraso = (r.temVencida && r.vencimentoMaisAntigo) ? Math.round((new Date(hoje + 'T00:00:00') - new Date(r.vencimentoMaisAntigo + 'T00:00:00')) / 86400000) : 0;
                let statusTxt, corStatus;
                if (r.temVencida) { statusTxt = `🔴 Atrasado (${diasAtraso}d)`; corStatus = 'var(--color-negative)'; }
                else if (r.temSemVencimento && !r.vencimentoMaisAntigo) { statusTxt = '🔵 Sem vencimento definido'; corStatus = '#0854a0'; }
                else { statusTxt = '🟢 Em dia'; corStatus = 'var(--color-positive)'; }
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.cliente}</strong></td>
                    <td>${r.qtd}</td>
                    <td style="font-weight:700; color:#0854a0;">R$ ${formatMoeda(r.total)}</td>
                    <td>${r.vencimentoMaisAntigo ? dataISOparaBR(r.vencimentoMaisAntigo) : '-'}</td>
                    <td style="color:${corStatus}; font-weight:600;">${statusTxt}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        window.renderAnaliseContasReceber = renderAnaliseContasReceber;

        // ===== ABA 10 - ANÁLISE: RANKING DE CLIENTES =====
        let clientesPeriodoDias = null; // 30, 90 ou null (tudo)
        function setClientesPeriodo(dias) {
            clientesPeriodoDias = dias;
            document.getElementById('btn-clientes-periodo-30d').classList.toggle('active', dias === 30);
            document.getElementById('btn-clientes-periodo-90d').classList.toggle('active', dias === 90);
            document.getElementById('btn-clientes-periodo-todos').classList.toggle('active', dias === null);
            renderAnaliseRankingClientes();
        }
        function renderAnaliseRankingClientes() {
            const tbody = document.getElementById('analise-clientes-table-body');
            const vazio = document.getElementById('analise-clientes-vazio');
            tbody.innerHTML = '';

            const limiteISO = clientesPeriodoDias !== null ? formatDateInputValue(new Date(Date.now() - clientesPeriodoDias * 86400000)) : null;

            const porCliente = {};
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate) return;
                if (limiteISO && s.salesDate < limiteISO) return;
                const cliente = s.clientName || 'Cliente não informado';
                if (!porCliente[cliente]) porCliente[cliente] = { cliente, totalComprado: 0, qtdCompras: 0, ultimaCompra: null };
                porCliente[cliente].totalComprado += (s.totalValue || 0);
                porCliente[cliente].qtdCompras += 1;
                if (!porCliente[cliente].ultimaCompra || s.salesDate > porCliente[cliente].ultimaCompra) {
                    porCliente[cliente].ultimaCompra = s.salesDate;
                }
            });

            let lista = Object.values(porCliente).map(c => ({ ...c, ticketMedio: c.qtdCompras > 0 ? c.totalComprado / c.qtdCompras : 0 }));
            if (lista.length === 0) { vazio.style.display = 'block'; return; }
            vazio.style.display = 'none';

            const state = getSortState('analise-clientes-table');
            lista = state.key ? ordenarPorEstado(lista, 'analise-clientes-table') : lista.sort((a, b) => b.totalComprado - a.totalComprado);

            lista.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.cliente}</strong></td>
                    <td>${r.qtdCompras}</td>
                    <td style="font-weight:700; color:#0854a0;">R$ ${formatMoeda(r.totalComprado)}</td>
                    <td>R$ ${formatMoeda(r.ticketMedio)}</td>
                    <td>${r.ultimaCompra ? dataISOparaBR(r.ultimaCompra) : '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        window.renderAnaliseRankingClientes = renderAnaliseRankingClientes;
        document.getElementById('btn-clientes-periodo-30d').addEventListener('click', () => setClientesPeriodo(30));
        document.getElementById('btn-clientes-periodo-90d').addEventListener('click', () => setClientesPeriodo(90));
        document.getElementById('btn-clientes-periodo-todos').addEventListener('click', () => setClientesPeriodo(null));

        // ===== ABA 10 - ANÁLISE: FORNECEDORES & COMPRAS =====
        let fornecedoresPeriodoDias = null; // 30, 90 ou null (tudo)
        function setFornecedoresPeriodo(dias) {
            fornecedoresPeriodoDias = dias;
            document.getElementById('btn-fornecedores-periodo-30d').classList.toggle('active', dias === 30);
            document.getElementById('btn-fornecedores-periodo-90d').classList.toggle('active', dias === 90);
            document.getElementById('btn-fornecedores-periodo-todos').classList.toggle('active', dias === null);
            renderAnaliseFornecedores();
        }
        function renderAnaliseFornecedores() {
            const limiteISO = fornecedoresPeriodoDias !== null ? formatDateInputValue(new Date(Date.now() - fornecedoresPeriodoDias * 86400000)) : null;
            document.getElementById('fornecedores-total-gasto-label').textContent = fornecedoresPeriodoDias !== null ? `Total Gasto (${fornecedoresPeriodoDias} dias)` : 'Total Gasto (Tudo)';

            const porFornecedor = {};
            let totalGeral = 0, qtdGeral = 0;
            Object.values(allLoadedComprasSuprimentos).forEach(c => {
                if (limiteISO && (!c.data || c.data < limiteISO)) return;
                const fornecedor = c.fornecedorNome || 'Fornecedor não informado';
                const valor = parseFloat(c.valorTotal || 0);
                if (!porFornecedor[fornecedor]) porFornecedor[fornecedor] = { fornecedor, total: 0, qtd: 0, ultimaCompra: null };
                porFornecedor[fornecedor].total += valor;
                porFornecedor[fornecedor].qtd += 1;
                if (!porFornecedor[fornecedor].ultimaCompra || (c.data && c.data > porFornecedor[fornecedor].ultimaCompra)) {
                    porFornecedor[fornecedor].ultimaCompra = c.data;
                }
                totalGeral += valor;
                qtdGeral += 1;
            });

            document.getElementById('fornecedores-total-gasto').innerText = `R$ ${formatMoeda(totalGeral)}`;
            document.getElementById('fornecedores-qtd-compras').innerText = qtdGeral;

            const tbody = document.getElementById('fornecedores-ranking-table-body');
            const vazio = document.getElementById('fornecedores-ranking-vazio');
            tbody.innerHTML = '';
            let lista = Object.values(porFornecedor);

            const maiorGastoEl = document.getElementById('fornecedores-maior-gasto');
            if (lista.length === 0) {
                vazio.style.display = 'block';
                maiorGastoEl.textContent = '-';
            } else {
                vazio.style.display = 'none';
                const maior = [...lista].sort((a, b) => b.total - a.total)[0];
                maiorGastoEl.textContent = maior.fornecedor;

                const state = getSortState('fornecedores-ranking-table');
                lista = state.key ? ordenarPorEstado(lista, 'fornecedores-ranking-table') : lista.sort((a, b) => b.total - a.total);

                lista.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${r.fornecedor}</strong></td>
                        <td>${r.qtd}</td>
                        <td style="font-weight:700; color:var(--color-negative);">R$ ${formatMoeda(r.total)}</td>
                        <td>${r.ultimaCompra ? dataISOparaBR(r.ultimaCompra) : '-'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // Popula o seletor de insumos a partir do catálogo de suprimentos
            const selectInsumo = document.getElementById('select-insumo-evolucao-preco');
            const insumoSelecionadoAtual = selectInsumo.value;
            const insumosOrdenados = Object.keys(allLoadedSuprimentos).sort((a, b) => (allLoadedSuprimentos[a].name || '').localeCompare(allLoadedSuprimentos[b].name || '', 'pt-BR'));
            selectInsumo.innerHTML = '<option value="">Selecione um insumo...</option>' +
                insumosOrdenados.map(key => `<option value="${key}">${allLoadedSuprimentos[key].name}</option>`).join('');
            selectInsumo.value = insumosOrdenados.includes(insumoSelecionadoAtual) ? insumoSelecionadoAtual : '';

            renderEvolucaoPrecoInsumo();
        }
        window.renderAnaliseFornecedores = renderAnaliseFornecedores;
        document.getElementById('btn-fornecedores-periodo-30d').addEventListener('click', () => setFornecedoresPeriodo(30));
        document.getElementById('btn-fornecedores-periodo-90d').addEventListener('click', () => setFornecedoresPeriodo(90));
        document.getElementById('btn-fornecedores-periodo-todos').addEventListener('click', () => setFornecedoresPeriodo(null));

        function renderEvolucaoPrecoInsumo() {
            const insumoKey = document.getElementById('select-insumo-evolucao-preco').value;
            const tabela = document.getElementById('insumo-evolucao-table');
            const tbody = document.getElementById('insumo-evolucao-table-body');
            const vazio = document.getElementById('insumo-evolucao-vazio');
            const resumo = document.getElementById('insumo-evolucao-resumo');
            tbody.innerHTML = '';

            if (!insumoKey) {
                tabela.style.display = 'none'; resumo.style.display = 'none';
                vazio.textContent = 'Selecione um insumo para ver o histórico de preços.';
                vazio.style.display = 'block';
                return;
            }

            let ocorrencias = [];
            Object.values(allLoadedComprasSuprimentos).forEach(c => {
                if (!c.itens) return;
                c.itens.forEach(item => {
                    if (item.insumoKey !== insumoKey) return;
                    ocorrencias.push({ data: c.data, fornecedor: c.fornecedorNome || '-', quantidade: item.quantidade || 0, custoUnitario: item.custoUnitario || 0, timestamp: c.timestamp || 0 });
                });
            });
            ocorrencias.sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.timestamp - b.timestamp));

            if (ocorrencias.length === 0) {
                tabela.style.display = 'none'; resumo.style.display = 'none';
                vazio.textContent = 'Nenhuma compra registrada para esse insumo ainda.';
                vazio.style.display = 'block';
                return;
            }

            vazio.style.display = 'none';
            tabela.style.display = 'table';
            resumo.style.display = 'block';

            const primeiro = ocorrencias[0].custoUnitario;
            const ultimo = ocorrencias[ocorrencias.length - 1].custoUnitario;
            const variacaoTotal = primeiro > 0 ? ((ultimo - primeiro) / primeiro) * 100 : 0;
            const corVariacaoTotal = variacaoTotal > 0 ? 'var(--color-negative)' : (variacaoTotal < 0 ? 'var(--color-positive)' : 'var(--text-strong)');
            resumo.innerHTML = `Preço na primeira compra: <strong>R$ ${formatMoeda(primeiro)}</strong> → Preço na última compra: <strong>R$ ${formatMoeda(ultimo)}</strong> &nbsp; <span style="color:${corVariacaoTotal}; font-weight:700;">(${variacaoTotal >= 0 ? '▲' : '▼'} ${Math.abs(variacaoTotal).toFixed(1)}%)</span>`;

            let custoAnterior = null;
            ocorrencias.forEach(o => {
                let variacaoTxt = '-';
                let cor = 'var(--text-strong)';
                if (custoAnterior !== null && custoAnterior > 0) {
                    const variacao = ((o.custoUnitario - custoAnterior) / custoAnterior) * 100;
                    cor = variacao > 0 ? 'var(--color-negative)' : (variacao < 0 ? 'var(--color-positive)' : 'var(--text-strong)');
                    variacaoTxt = `${variacao >= 0 ? '▲' : '▼'} ${Math.abs(variacao).toFixed(1)}%`;
                }
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${o.data ? dataISOparaBR(o.data) : '-'}</td>
                    <td>${o.fornecedor}</td>
                    <td>${formatQuantidade(o.quantidade)}</td>
                    <td style="font-weight:600;">R$ ${formatMoeda(o.custoUnitario)}</td>
                    <td style="color:${cor}; font-weight:700;">${variacaoTxt}</td>
                `;
                tbody.appendChild(tr);
                custoAnterior = o.custoUnitario;
            });
        }
        window.renderEvolucaoPrecoInsumo = renderEvolucaoPrecoInsumo;
        document.getElementById('select-insumo-evolucao-preco').addEventListener('change', renderEvolucaoPrecoInsumo);
        bindSortableHeaders('fornecedores-ranking-table', 'fornecedores-ranking-table', renderAnaliseFornecedores);

        // ===== ABA 10 - ANÁLISE: CUSTO & EFICIÊNCIA DE PRODUÇÃO =====
        let producaoPeriodoDias = null; // 30, 90 ou null (tudo)
        function setProducaoPeriodo(dias) {
            producaoPeriodoDias = dias;
            document.getElementById('btn-producao-periodo-30d').classList.toggle('active', dias === 30);
            document.getElementById('btn-producao-periodo-90d').classList.toggle('active', dias === 90);
            document.getElementById('btn-producao-periodo-todos').classList.toggle('active', dias === null);
            renderAnaliseProducao();
        }

        function renderAnaliseProducao() {
            const limiteTimestamp = producaoPeriodoDias !== null ? (Date.now() - producaoPeriodoDias * 86400000) : null;

            let qtdRascunho = 0, totalUnidades = 0, custoTotalGeral = 0, qtdOrdensValidas = 0;
            const porProduto = {};
            Object.values(allLoadedProductions).forEach(op => {
                if (op.status === 'RASCUNHO') { qtdRascunho++; return; }
                if (op.status === 'CANCELADO') return;
                if (op.status !== 'CONFIRMADO' && op.status !== 'PRODUZIDO') return;
                if (limiteTimestamp !== null && (op.timestamp || 0) < limiteTimestamp) return;

                const yieldQty = op.yieldQty || 0;
                const totalCost = op.totalCost || 0;
                totalUnidades += yieldQty;
                custoTotalGeral += totalCost;
                qtdOrdensValidas++;

                const nome = op.name || 'Sem nome';
                if (!porProduto[nome]) porProduto[nome] = { produto: nome, qtdOrdens: 0, qtdProduzida: 0, custoTotal: 0 };
                porProduto[nome].qtdOrdens += 1;
                porProduto[nome].qtdProduzida += yieldQty;
                porProduto[nome].custoTotal += totalCost;
            });

            document.getElementById('producao-total-unidades').innerText = formatQuantidade(totalUnidades);
            document.getElementById('producao-custo-total').innerText = `R$ ${formatMoeda(custoTotalGeral)}`;
            document.getElementById('producao-qtd-ordens').innerText = qtdOrdensValidas;
            document.getElementById('producao-qtd-rascunho').innerText = qtdRascunho;

            const tbody = document.getElementById('producao-por-produto-table-body');
            const vazio = document.getElementById('producao-por-produto-vazio');
            tbody.innerHTML = '';
            let lista = Object.values(porProduto).map(p => ({ ...p, custoMedioUnitario: p.qtdProduzida > 0 ? p.custoTotal / p.qtdProduzida : 0 }));

            if (lista.length === 0) { vazio.style.display = 'block'; }
            else {
                vazio.style.display = 'none';
                const state = getSortState('producao-por-produto-table');
                lista = state.key ? ordenarPorEstado(lista, 'producao-por-produto-table') : lista.sort((a, b) => b.qtdProduzida - a.qtdProduzida);
                lista.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${r.produto}</strong></td>
                        <td>${r.qtdOrdens}</td>
                        <td><span class="badge-stock">${formatQuantidade(r.qtdProduzida)} un</span></td>
                        <td style="color:var(--color-negative); font-weight:600;">R$ ${formatMoeda(r.custoTotal)}</td>
                        <td style="font-weight:700;">R$ ${formatMoeda(r.custoMedioUnitario)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // Popula o seletor de produtos com nomes distintos que já tiveram Ordem de Produção
            const selectProduto = document.getElementById('select-produto-evolucao-custo');
            const produtoSelecionadoAtual = selectProduto.value;
            const nomesDistintos = [...new Set(Object.values(allLoadedProductions).filter(op => op.status === 'CONFIRMADO' || op.status === 'PRODUZIDO').map(op => op.name))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            selectProduto.innerHTML = '<option value="">Selecione um produto...</option>' +
                nomesDistintos.map(n => `<option value="${n}">${n}</option>`).join('');
            selectProduto.value = nomesDistintos.includes(produtoSelecionadoAtual) ? produtoSelecionadoAtual : '';

            renderEvolucaoCustoProducao();
        }
        window.renderAnaliseProducao = renderAnaliseProducao;

        function renderEvolucaoCustoProducao() {
            const nomeProduto = document.getElementById('select-produto-evolucao-custo').value;
            const tabela = document.getElementById('producao-evolucao-table');
            const tbody = document.getElementById('producao-evolucao-table-body');
            const vazio = document.getElementById('producao-evolucao-vazio');
            const resumo = document.getElementById('producao-evolucao-resumo');
            tbody.innerHTML = '';

            if (!nomeProduto) {
                tabela.style.display = 'none'; resumo.style.display = 'none';
                vazio.textContent = 'Selecione um produto para ver o histórico de custo.';
                vazio.style.display = 'block';
                return;
            }

            let ordens = Object.values(allLoadedProductions).filter(op => op.name === nomeProduto && (op.status === 'CONFIRMADO' || op.status === 'PRODUZIDO'));
            ordens.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            if (ordens.length === 0) {
                tabela.style.display = 'none'; resumo.style.display = 'none';
                vazio.textContent = 'Nenhuma Ordem de Produção confirmada para esse produto ainda.';
                vazio.style.display = 'block';
                return;
            }

            vazio.style.display = 'none';
            tabela.style.display = 'table';
            resumo.style.display = 'block';

            const primeiro = ordens[0].costPerUnit || 0;
            const ultimo = ordens[ordens.length - 1].costPerUnit || 0;
            const variacaoTotal = primeiro > 0 ? ((ultimo - primeiro) / primeiro) * 100 : 0;
            const corVariacaoTotal = variacaoTotal > 0 ? 'var(--color-negative)' : (variacaoTotal < 0 ? 'var(--color-positive)' : 'var(--text-strong)');
            resumo.innerHTML = `Custo/un na primeira OP: <strong>R$ ${formatMoeda(primeiro)}</strong> → Custo/un na última OP: <strong>R$ ${formatMoeda(ultimo)}</strong> &nbsp; <span style="color:${corVariacaoTotal}; font-weight:700;">(${variacaoTotal >= 0 ? '▲' : '▼'} ${Math.abs(variacaoTotal).toFixed(1)}%)</span>`;

            let custoAnterior = null;
            ordens.forEach(op => {
                let variacaoTxt = '-';
                let cor = 'var(--text-strong)';
                if (custoAnterior !== null && custoAnterior > 0) {
                    const variacao = ((op.costPerUnit - custoAnterior) / custoAnterior) * 100;
                    cor = variacao > 0 ? 'var(--color-negative)' : (variacao < 0 ? 'var(--color-positive)' : 'var(--text-strong)');
                    variacaoTxt = `${variacao >= 0 ? '▲' : '▼'} ${Math.abs(variacao).toFixed(1)}%`;
                }
                const dataOP = op.timestamp ? new Date(op.timestamp).toLocaleDateString('pt-BR') : '-';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${String(op.pedidoNumero || 0).padStart(3, '0')}</td>
                    <td>${dataOP}</td>
                    <td>${formatQuantidade(op.yieldQty || 0)}</td>
                    <td style="font-weight:600;">R$ ${formatMoeda(op.costPerUnit || 0)}</td>
                    <td style="color:${cor}; font-weight:700;">${variacaoTxt}</td>
                `;
                tbody.appendChild(tr);
                custoAnterior = op.costPerUnit;
            });
        }
        window.renderEvolucaoCustoProducao = renderEvolucaoCustoProducao;
        document.getElementById('select-produto-evolucao-custo').addEventListener('change', renderEvolucaoCustoProducao);
        document.getElementById('btn-producao-periodo-30d').addEventListener('click', () => setProducaoPeriodo(30));
        document.getElementById('btn-producao-periodo-90d').addEventListener('click', () => setProducaoPeriodo(90));
        document.getElementById('btn-producao-periodo-todos').addEventListener('click', () => setProducaoPeriodo(null));
        bindSortableHeaders('producao-por-produto-table', 'producao-por-produto-table', renderAnaliseProducao);

        // ===== ABA 10 - ANÁLISE: DESCONTOS =====
        let descontosPeriodoDias = null; // 30, 90 ou null (tudo)
        function setDescontosPeriodo(dias) {
            descontosPeriodoDias = dias;
            document.getElementById('btn-descontos-periodo-30d').classList.toggle('active', dias === 30);
            document.getElementById('btn-descontos-periodo-90d').classList.toggle('active', dias === 90);
            document.getElementById('btn-descontos-periodo-todos').classList.toggle('active', dias === null);
            renderAnaliseDescontos();
        }

        function renderAnaliseDescontos() {
            const limiteISO = descontosPeriodoDias !== null ? formatDateInputValue(new Date(Date.now() - descontosPeriodoDias * 86400000)) : null;

            let faturamentoBruto = 0, descontoTotal = 0;
            const porProduto = {};
            const porCliente = {};

            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate) return;
                if (limiteISO && s.salesDate < limiteISO) return;
                if (!s.items) return;

                const cliente = s.clientName || 'Cliente não informado';
                s.items.forEach(item => {
                    if (!item.productKey) return;
                    const subtotalItem = (item.sellingPrice || 0) * (item.quantity || 0);
                    const totalLiquidoItem = item.totalItemNet != null ? item.totalItemNet : subtotalItem;
                    const descontoItem = Math.max(0, subtotalItem - totalLiquidoItem);

                    faturamentoBruto += subtotalItem;
                    if (descontoItem <= 0) return;
                    descontoTotal += descontoItem;

                    const nomeProduto = item.productName || 'Produto';
                    if (!porProduto[nomeProduto]) porProduto[nomeProduto] = { produto: nomeProduto, qtdItens: 0, total: 0 };
                    porProduto[nomeProduto].qtdItens += 1;
                    porProduto[nomeProduto].total += descontoItem;

                    if (!porCliente[cliente]) porCliente[cliente] = { cliente, total: 0 };
                    porCliente[cliente].total += descontoItem;
                });
            });

            document.getElementById('descontos-faturamento-bruto').innerText = `R$ ${formatMoeda(faturamentoBruto)}`;
            document.getElementById('descontos-total-concedido').innerText = `R$ ${formatMoeda(descontoTotal)}`;
            document.getElementById('descontos-percentual').innerText = (faturamentoBruto > 0 ? (descontoTotal / faturamentoBruto * 100) : 0).toFixed(1) + '%';

            // Tabela por produto
            const tbodyProduto = document.getElementById('descontos-produto-table-body');
            const vazioProduto = document.getElementById('descontos-produto-vazio');
            tbodyProduto.innerHTML = '';
            let listaProduto = Object.values(porProduto).map(p => ({ ...p, percentual: descontoTotal > 0 ? (p.total / descontoTotal * 100) : 0 }));
            if (listaProduto.length === 0) { vazioProduto.style.display = 'block'; }
            else {
                vazioProduto.style.display = 'none';
                const stateProduto = getSortState('descontos-produto-table');
                listaProduto = stateProduto.key ? ordenarPorEstado(listaProduto, 'descontos-produto-table') : listaProduto.sort((a, b) => b.total - a.total);
                listaProduto.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${r.produto}</strong></td>
                        <td>${r.qtdItens}</td>
                        <td style="color:var(--color-negative); font-weight:600;">R$ ${formatMoeda(r.total)}</td>
                        <td>${r.percentual.toFixed(1)}%</td>
                    `;
                    tbodyProduto.appendChild(tr);
                });
            }

            // Tabela por cliente
            const tbodyCliente = document.getElementById('descontos-cliente-table-body');
            const vazioCliente = document.getElementById('descontos-cliente-vazio');
            tbodyCliente.innerHTML = '';
            let listaCliente = Object.values(porCliente).map(c => ({ ...c, percentual: descontoTotal > 0 ? (c.total / descontoTotal * 100) : 0 }));
            if (listaCliente.length === 0) { vazioCliente.style.display = 'block'; }
            else {
                vazioCliente.style.display = 'none';
                const stateCliente = getSortState('descontos-cliente-table');
                listaCliente = stateCliente.key ? ordenarPorEstado(listaCliente, 'descontos-cliente-table') : listaCliente.sort((a, b) => b.total - a.total);
                listaCliente.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${r.cliente}</strong></td>
                        <td style="color:var(--color-negative); font-weight:600;">R$ ${formatMoeda(r.total)}</td>
                        <td>${r.percentual.toFixed(1)}%</td>
                    `;
                    tbodyCliente.appendChild(tr);
                });
            }
        }
        window.renderAnaliseDescontos = renderAnaliseDescontos;
        document.getElementById('btn-descontos-periodo-30d').addEventListener('click', () => setDescontosPeriodo(30));
        document.getElementById('btn-descontos-periodo-90d').addEventListener('click', () => setDescontosPeriodo(90));
        document.getElementById('btn-descontos-periodo-todos').addEventListener('click', () => setDescontosPeriodo(null));
        bindSortableHeaders('descontos-produto-table', 'descontos-produto-table', renderAnaliseDescontos);
        bindSortableHeaders('descontos-cliente-table', 'descontos-cliente-table', renderAnaliseDescontos);
        bindSortableHeaders('contas-receber-table', 'contas-receber-table', renderAnaliseContasReceber);
        bindSortableHeaders('analise-clientes-table', 'analise-clientes-table', renderAnaliseRankingClientes);

        // ===== ABA 10 - ANÁLISE: CURVA ABC DE PRODUTOS =====
        let abcPeriodoDias = null; // 30, 90 ou null (tudo)
        function setAbcPeriodo(dias) {
            abcPeriodoDias = dias;
            document.getElementById('btn-abc-periodo-30d').classList.toggle('active', dias === 30);
            document.getElementById('btn-abc-periodo-90d').classList.toggle('active', dias === 90);
            document.getElementById('btn-abc-periodo-todos').classList.toggle('active', dias === null);
            renderAnaliseCurvaABC();
        }
        function renderAnaliseCurvaABC() {
            const tbody = document.getElementById('analise-abc-table-body');
            const vazio = document.getElementById('analise-abc-vazio');
            tbody.innerHTML = '';
            const limiteISO = abcPeriodoDias !== null ? formatDateInputValue(new Date(Date.now() - abcPeriodoDias * 86400000)) : null;

            const porProduto = {};
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate) return;
                if (limiteISO && s.salesDate < limiteISO) return;
                if (!s.items) return;
                s.items.forEach(item => {
                    if (!item.productKey) return;
                    const nome = item.productName || 'Produto';
                    if (!porProduto[nome]) porProduto[nome] = { produto: nome, total: 0 };
                    porProduto[nome].total += (item.totalItemNet != null ? item.totalItemNet : (item.sellingPrice || 0) * (item.quantity || 0));
                });
            });

            let lista = Object.values(porProduto).filter(p => p.total > 0).sort((a, b) => b.total - a.total);
            if (lista.length === 0) {
                vazio.style.display = 'block';
                ['abc-qtd-a', 'abc-qtd-b', 'abc-qtd-c'].forEach(id => document.getElementById(id).textContent = '0 produtos');
                ['abc-pct-a', 'abc-pct-b', 'abc-pct-c'].forEach(id => document.getElementById(id).textContent = '0% do faturamento');
                return;
            }
            vazio.style.display = 'none';

            const totalGeral = lista.reduce((acc, p) => acc + p.total, 0);
            let acumulado = 0;
            const contagem = { A: 0, B: 0, C: 0 };
            const totalPorClasse = { A: 0, B: 0, C: 0 };
            lista = lista.map(p => {
                acumulado += p.total;
                const percentual = (p.total / totalGeral) * 100;
                const percentualAcumulado = (acumulado / totalGeral) * 100;
                const classe = percentualAcumulado <= 80 ? 'A' : (percentualAcumulado <= 95 ? 'B' : 'C');
                contagem[classe]++;
                totalPorClasse[classe] += p.total;
                return { ...p, percentual, percentualAcumulado, classe };
            });

            document.getElementById('abc-qtd-a').textContent = `${contagem.A} produto${contagem.A !== 1 ? 's' : ''}`;
            document.getElementById('abc-qtd-b').textContent = `${contagem.B} produto${contagem.B !== 1 ? 's' : ''}`;
            document.getElementById('abc-qtd-c').textContent = `${contagem.C} produto${contagem.C !== 1 ? 's' : ''}`;
            document.getElementById('abc-pct-a').textContent = `${(totalPorClasse.A / totalGeral * 100).toFixed(1)}% do faturamento`;
            document.getElementById('abc-pct-b').textContent = `${(totalPorClasse.B / totalGeral * 100).toFixed(1)}% do faturamento`;
            document.getElementById('abc-pct-c').textContent = `${(totalPorClasse.C / totalGeral * 100).toFixed(1)}% do faturamento`;

            const state = getSortState('analise-abc-table');
            if (state.key) lista = ordenarPorEstado(lista, 'analise-abc-table');

            const corClasse = { A: '#0c5e2e', B: '#c8630a', C: '#bb0000' };
            lista.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span style="display:inline-block; min-width:22px; text-align:center; padding:2px 8px; border-radius: 3px; background:${corClasse[r.classe]}; color:#fff; font-weight:700;">${r.classe}</span></td>
                    <td><strong>${r.produto}</strong></td>
                    <td style="font-weight:700; color:#0854a0;">R$ ${formatMoeda(r.total)}</td>
                    <td>${r.percentual.toFixed(1)}%</td>
                    <td>${r.percentualAcumulado.toFixed(1)}%</td>
                `;
                tbody.appendChild(tr);
            });
        }
        window.renderAnaliseCurvaABC = renderAnaliseCurvaABC;
        document.getElementById('btn-abc-periodo-30d').addEventListener('click', () => setAbcPeriodo(30));
        document.getElementById('btn-abc-periodo-90d').addEventListener('click', () => setAbcPeriodo(90));
        document.getElementById('btn-abc-periodo-todos').addEventListener('click', () => setAbcPeriodo(null));
        bindSortableHeaders('analise-abc-table', 'analise-abc-table', renderAnaliseCurvaABC);

        // ===== ABA 10 - ANÁLISE: RENTABILIDADE POR CLIENTE =====
        // Cruza o faturamento de cada cliente com o custo de produção dos itens vendidos (mesma lógica de
        // custo usada no card de Margem de Lucro), para estimar o lucro real gerado por cliente.
        function renderAnaliseRentabilidadeCliente() {
            const tbody = document.getElementById('analise-rentabilidade-cliente-table-body');
            const vazio = document.getElementById('analise-rentabilidade-cliente-vazio');
            tbody.innerHTML = '';

            const porCliente = {};
            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.items) return;
                const cliente = s.clientName || 'Cliente não informado';
                s.items.forEach(item => {
                    if (!item.productKey) return;
                    const prod = allLoadedProducts[item.productKey];
                    const custoUnitario = prod ? getCustoEfetivoProduto(prod) : 0;
                    if (!custoUnitario || custoUnitario <= 0) return; // só entra se der pra calcular custo real
                    const faturamentoItem = item.totalItemNet != null ? item.totalItemNet : (item.sellingPrice || 0) * (item.quantity || 0);
                    const custoItem = custoUnitario * (item.quantity || 0);
                    if (!porCliente[cliente]) porCliente[cliente] = { cliente, faturamento: 0, custo: 0 };
                    porCliente[cliente].faturamento += faturamentoItem;
                    porCliente[cliente].custo += custoItem;
                });
            });

            let lista = Object.values(porCliente).map(c => {
                const lucro = c.faturamento - c.custo;
                const margemPct = c.faturamento > 0 ? (lucro / c.faturamento) * 100 : 0;
                return { ...c, lucro, margemPct };
            });
            if (lista.length === 0) { vazio.style.display = 'block'; return; }
            vazio.style.display = 'none';

            const state = getSortState('analise-rentabilidade-cliente-table');
            lista = state.key ? ordenarPorEstado(lista, 'analise-rentabilidade-cliente-table') : lista.sort((a, b) => b.lucro - a.lucro);

            lista.forEach(r => {
                const corMargem = r.margemPct < 0 ? '#bb0000' : (r.margemPct < 30 ? '#c8630a' : '#0c5e2e');
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.cliente}</strong></td>
                    <td>R$ ${formatMoeda(r.faturamento)}</td>
                    <td>R$ ${formatMoeda(r.custo)}</td>
                    <td style="color:${corMargem}; font-weight:700;">R$ ${formatMoeda(r.lucro)}</td>
                    <td style="color:${corMargem}; font-weight:700;">${r.margemPct.toFixed(1)}%</td>
                `;
                tbody.appendChild(tr);
            });
        }
        window.renderAnaliseRentabilidadeCliente = renderAnaliseRentabilidadeCliente;
        bindSortableHeaders('analise-rentabilidade-cliente-table', 'analise-rentabilidade-cliente-table', renderAnaliseRentabilidadeCliente);

        // ===== ABA 10 - ANÁLISE: SAZONALIDADE DAS VENDAS =====
        // Gráfico de barras simples reutilizável (sem tooltip), usado pelos dois gráficos desta análise.
        function renderBarChartSimples(svgId, emptyId, categorias, valores, corBarra, formatarValor) {
            const svg = document.getElementById(svgId);
            const emptyEl = document.getElementById(emptyId);
            svg.innerHTML = '';
            const temDados = valores.some(v => v > 0);
            if (!temDados) { emptyEl.style.display = 'block'; svg.style.display = 'none'; return; }
            emptyEl.style.display = 'none';
            svg.style.display = 'block';

            const ns = 'http://www.w3.org/2000/svg';
            const W = 900, H = 260, mL = 60, mR = 20, mT = 24, mB = 40;
            const uw = W - mL - mR, uh = H - mT - mB;
            const maxValor = Math.max(...valores, 1);
            const passo = uw / categorias.length;
            const larguraBarra = Math.min(passo * 0.55, 70);

            for (let i = 0; i <= 4; i++) {
                const y = mT + (uh / 4) * i;
                const linha = document.createElementNS(ns, 'line');
                linha.setAttribute('x1', mL); linha.setAttribute('x2', W - mR);
                linha.setAttribute('y1', y); linha.setAttribute('y2', y);
                linha.setAttribute('stroke', '#eef1f3'); linha.setAttribute('stroke-width', '1');
                svg.appendChild(linha);
                const val = maxValor - (maxValor / 4) * i;
                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', mL - 8); text.setAttribute('y', y + 4);
                text.setAttribute('text-anchor', 'end'); text.setAttribute('font-size', '10');
                text.setAttribute('fill', 'var(--text-muted)'); text.setAttribute('font-family', 'Segoe UI, sans-serif');
                text.textContent = formatarValor(val);
                svg.appendChild(text);
            }

            categorias.forEach((cat, i) => {
                const valor = valores[i] || 0;
                const alturaBarra = (valor / maxValor) * uh;
                const x = mL + i * passo + (passo - larguraBarra) / 2;
                const y = mT + uh - alturaBarra;

                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('x', x); rect.setAttribute('y', y);
                rect.setAttribute('width', larguraBarra); rect.setAttribute('height', Math.max(alturaBarra, 0));
                rect.setAttribute('fill', corBarra); rect.setAttribute('rx', '3');
                svg.appendChild(rect);

                if (valor > 0) {
                    const labelValor = document.createElementNS(ns, 'text');
                    labelValor.setAttribute('x', x + larguraBarra / 2); labelValor.setAttribute('y', y - 6);
                    labelValor.setAttribute('text-anchor', 'middle'); labelValor.setAttribute('font-size', '10');
                    labelValor.setAttribute('fill', 'var(--text-strong)'); labelValor.setAttribute('font-weight', '700');
                    labelValor.setAttribute('font-family', 'Segoe UI, sans-serif');
                    labelValor.textContent = formatarValor(valor);
                    svg.appendChild(labelValor);
                }

                const labelCat = document.createElementNS(ns, 'text');
                labelCat.setAttribute('x', x + larguraBarra / 2); labelCat.setAttribute('y', H - mB + 18);
                labelCat.setAttribute('text-anchor', 'middle'); labelCat.setAttribute('font-size', '10.5');
                labelCat.setAttribute('fill', 'var(--text-muted)'); labelCat.setAttribute('font-family', 'Segoe UI, sans-serif');
                labelCat.textContent = cat;
                svg.appendChild(labelCat);
            });
        }

        function highlightSazonalidadePreset(preset) {
            document.getElementById('btn-sazonalidade-periodo-mes-passado').classList.toggle('active', preset === 'mes-passado');
            document.getElementById('btn-sazonalidade-periodo-mes-atual').classList.toggle('active', preset === 'mes-atual');
            document.getElementById('btn-sazonalidade-periodo-todos').classList.toggle('active', preset === 'todos');
        }

        function setSazonalidadePeriodPreset(preset) {
            const hoje = new Date();
            let inicio, fim;
            if (preset === 'mes-atual') {
                inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            } else if (preset === 'mes-passado') {
                inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
            } else {
                document.getElementById('sazonalidade-data-inicio').value = '';
                document.getElementById('sazonalidade-data-fim').value = '';
                highlightSazonalidadePreset('todos');
                renderAnaliseSazonalidade();
                return;
            }
            document.getElementById('sazonalidade-data-inicio').value = dataISOparaBR(formatDateInputValue(inicio));
            document.getElementById('sazonalidade-data-fim').value = dataISOparaBR(formatDateInputValue(fim));
            highlightSazonalidadePreset(preset);
            renderAnaliseSazonalidade();
        }

        function renderAnaliseSazonalidade() {
            const inicioVal = dataBRparaISO(document.getElementById('sazonalidade-data-inicio').value);
            const fimVal = dataBRparaISO(document.getElementById('sazonalidade-data-fim').value);

            const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const faturamentoPorDia = [0, 0, 0, 0, 0, 0, 0];
            const faixasHorario = ['Madrugada (00h-06h)', 'Manhã (06h-12h)', 'Tarde (12h-18h)', 'Noite (18h-24h)'];
            const faturamentoPorFaixa = [0, 0, 0, 0];
            let temHorario = false;

            Object.values(allLoadedSales).forEach(s => {
                if (s.origemCredito) return;
                if ((s.status || 'PAGO') === 'RASCUNHO') return;
                if (!s.salesDate) return;
                if (inicioVal && s.salesDate < inicioVal) return;
                if (fimVal && s.salesDate > fimVal) return;
                const valor = s.totalValue || 0;
                const diaSemana = new Date(s.salesDate + 'T00:00:00').getDay();
                faturamentoPorDia[diaSemana] += valor;

                if (s.timestamp) {
                    const hora = new Date(s.timestamp).getHours();
                    const faixa = hora < 6 ? 0 : hora < 12 ? 1 : hora < 18 ? 2 : 3;
                    faturamentoPorFaixa[faixa] += valor;
                    temHorario = true;
                }
            });

            const formatarK = (v) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`;
            renderBarChartSimples('sazonalidade-dia-semana-svg', 'sazonalidade-dia-semana-empty', diasSemana.map(d => d.slice(0, 3)), faturamentoPorDia, '#0a6ed1', formatarK);
            if (temHorario) {
                renderBarChartSimples('sazonalidade-horario-svg', 'sazonalidade-horario-empty', faixasHorario, faturamentoPorFaixa, '#0854a0', formatarK);
            } else {
                document.getElementById('sazonalidade-horario-svg').style.display = 'none';
                document.getElementById('sazonalidade-horario-empty').style.display = 'block';
                document.getElementById('sazonalidade-horario-empty').textContent = 'Nenhuma venda com horário registrado no período selecionado.';
            }
        }
        window.renderAnaliseSazonalidade = renderAnaliseSazonalidade;

        document.getElementById('btn-sazonalidade-periodo-mes-passado').addEventListener('click', () => setSazonalidadePeriodPreset('mes-passado'));
        document.getElementById('btn-sazonalidade-periodo-mes-atual').addEventListener('click', () => setSazonalidadePeriodPreset('mes-atual'));
        document.getElementById('btn-sazonalidade-periodo-todos').addEventListener('click', () => setSazonalidadePeriodPreset('todos'));
        document.getElementById('btn-sazonalidade-periodo-custom').addEventListener('click', () => { highlightSazonalidadePreset(-1); renderAnaliseSazonalidade(); });

        onValue(ref(db, 'clientes'), (snap) => {
            allLoadedClientes = snap.val() || {};
            renderClientesTable();
        });

        // ORDENAÇÃO DAS DEMAIS TABELAS DO SITE (mesmo mecanismo, clique no cabeçalho ordena crescente/decrescente)
        // OBS: isto precisa ficar DENTRO de initDatabaseSync() porque as funções de renderização usadas aqui
        // (renderProductionHistory, renderCatalogoProdutos, renderSuprimentosTable, renderSalesHistoryTable)
        // são declaradas dentro desta função - chamá-las fora daqui gerava "function is not defined" e
        // travava a execução de todo o restante do script (por isso as abas paravam de trocar e os dados
        // do banco paravam de aparecer).
        bindSortableHeaders('production-history-table', 'production-history-table', renderProductionHistory);
        bindSortableHeaders('catalog-table', 'catalog-table', renderCatalogoProdutos);
        bindSortableHeaders('analise-margem-table', 'analise-margem-table', renderAnaliseMargemLucro);
        bindSortableHeaders('analise-vendidos-table', 'analise-vendidos-table', renderAnaliseMaisVendidos);
        bindSortableHeaders('fluxocaixa-mensal-table', 'fluxocaixa-mensal-table', () => renderAnaliseFluxoCaixa());
        bindSortableHeaders('fluxocaixa-conta-table', 'fluxocaixa-conta-table', () => renderFluxoCaixaContaTable(getMesesRangeFluxoCaixa(fluxoCaixaPeriodoMeses)));
        bindSortableHeaders('fluxocaixa-despesas-table', 'fluxocaixa-despesas-table', () => renderFluxoCaixaDespesasTable(getMesesRangeFluxoCaixa(fluxoCaixaPeriodoMeses)));
        bindSortableHeaders('dre-mensal-table', 'dre-mensal-table', () => renderAnaliseDRE());
        bindSortableHeaders('suprimentos-table', 'suprimentos-table', renderSuprimentosTable);
        bindSortableHeaders('sales-history-table', 'sales-history-table', renderSalesHistoryTable);

        // FILTROS DE BUSCA - ABA 2 (CATÁLOGO): só aplica ao apertar Enter ou clicar em "Buscar";
        // o "X" limpa e já reaplica na hora. Precisam ficar aqui dentro pelo mesmo motivo do comentário acima.
        const inputBuscaCatalogo = document.getElementById('filtro-busca-catalogo');
        const btnLimparBuscaCatalogo = document.getElementById('btn-limpar-busca-catalogo');
        const btnBuscarCatalogo = document.getElementById('btn-buscar-catalogo');
        function aplicarBuscaCatalogo() {
            filtroBuscaCatalogo = inputBuscaCatalogo.value;
            btnLimparBuscaCatalogo.style.display = filtroBuscaCatalogo ? 'flex' : 'none';
            renderCatalogoProdutos();
        }
        inputBuscaCatalogo.addEventListener('input', () => {
            btnLimparBuscaCatalogo.style.display = inputBuscaCatalogo.value ? 'flex' : 'none';
        });
        inputBuscaCatalogo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarBuscaCatalogo(); } });
        btnBuscarCatalogo.addEventListener('click', aplicarBuscaCatalogo);
        btnLimparBuscaCatalogo.addEventListener('click', () => {
            inputBuscaCatalogo.value = '';
            filtroBuscaCatalogo = '';
            btnLimparBuscaCatalogo.style.display = 'none';
            renderCatalogoProdutos();
            inputBuscaCatalogo.focus();
        });

        // FILTRO DE CATEGORIA (ABA 2): mostra só a categoria escolhida, escondendo as demais
        document.getElementById('filtro-categoria-catalogo').addEventListener('change', (e) => {
            filtroCategoriaCatalogo = e.target.value;
            renderCatalogoProdutos();
        });

        // FILTRO DE BUSCA - ABA 3 (SUPRIMENTOS): mesma lógica de Enter/botão/limpar
        const inputBuscaSuprimentos = document.getElementById('filtro-busca-suprimentos');
        const btnLimparBuscaSuprimentos = document.getElementById('btn-limpar-busca-suprimentos');
        const btnBuscarSuprimentos = document.getElementById('btn-buscar-suprimentos');
        function aplicarBuscaSuprimentos() {
            filtroBuscaSuprimentos = inputBuscaSuprimentos.value;
            btnLimparBuscaSuprimentos.style.display = filtroBuscaSuprimentos ? 'flex' : 'none';
            renderSuprimentosTable();
        }
        inputBuscaSuprimentos.addEventListener('input', () => {
            btnLimparBuscaSuprimentos.style.display = inputBuscaSuprimentos.value ? 'flex' : 'none';
        });
        inputBuscaSuprimentos.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarBuscaSuprimentos(); } });
        btnBuscarSuprimentos.addEventListener('click', aplicarBuscaSuprimentos);
        btnLimparBuscaSuprimentos.addEventListener('click', () => {
            inputBuscaSuprimentos.value = '';
            filtroBuscaSuprimentos = '';
            btnLimparBuscaSuprimentos.style.display = 'none';
            renderSuprimentosTable();
            inputBuscaSuprimentos.focus();
        });
    }

    // FILTRO DE BUSCA - ABA 6 (CLIENTES): filtra a lista por nome em tempo real, sem precisar apertar Enter
    const inputBuscaClientes = document.getElementById('filtro-busca-clientes');
    const btnLimparBuscaClientes = document.getElementById('btn-limpar-busca-clientes');
    if(inputBuscaClientes) {
        inputBuscaClientes.addEventListener('input', () => {
            filtroBuscaClientes = inputBuscaClientes.value;
            btnLimparBuscaClientes.style.display = filtroBuscaClientes ? 'flex' : 'none';
            renderClientesTable();
        });
        btnLimparBuscaClientes.addEventListener('click', () => {
            inputBuscaClientes.value = '';
            filtroBuscaClientes = '';
            btnLimparBuscaClientes.style.display = 'none';
            renderClientesTable();
            inputBuscaClientes.focus();
        });
    }

    // GRÁFICO DE EVOLUÇÃO DE VENDAS (COM FILTRO DE PERÍODO)
    // Formata a data no formato YYYY-MM-DD usando o horário LOCAL do dispositivo (não UTC).
    // Usar toISOString() aqui geraria a data errada à noite para fusos atrás de UTC (ex: Manaus).
    function formatDateInputValue(date) {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }

    function highlightPeriodPreset(days) {
        document.getElementById('btn-periodo-7d').classList.toggle('active', days === 7);
        document.getElementById('btn-periodo-30d').classList.toggle('active', days === 30);
        document.getElementById('btn-periodo-todos').classList.toggle('active', days === null);
    }

    function setChartPeriodPreset(days) {
        const fim = new Date();
        document.getElementById('chart-data-fim').value = dataISOparaBR(formatDateInputValue(fim));
        if(days !== null) {
            const inicio = new Date();
            inicio.setDate(fim.getDate() - (days - 1));
            document.getElementById('chart-data-inicio').value = dataISOparaBR(formatDateInputValue(inicio));
        } else {
            document.getElementById('chart-data-inicio').value = '';
        }
        highlightPeriodPreset(days);
        renderSalesChart();
    }

    // Recalcula Faturamento Total e Lucro Bruto respeitando o MESMO período selecionado no gráfico
    // (Rascunhos não entram, assim como já não abatem estoque)
    function atualizarFaturamentoPeriodo(inicioVal, fimVal) {
        let totalCaixa = 0, lucroCaixa = 0, aReceber = 0;
        Object.values(allLoadedSales).forEach(s => {
            if ((s.status || 'PAGO') === 'RASCUNHO') return;
            if (!s.salesDate) return;
            if (inicioVal && s.salesDate < inicioVal) return;
            if (fimVal && s.salesDate > fimVal) return;
            totalCaixa += (s.totalValue || 0); lucroCaixa += (s.totalProfit || 0);
            if (s.status === 'CONFIRMADA') aReceber += (s.totalValue || 0);
        });
        document.getElementById('dash-revenue').innerText = `R$ ${formatMoeda(totalCaixa)}`;
        document.getElementById('dash-a-receber').innerText = `R$ ${formatMoeda(aReceber)}`;
        document.getElementById('dash-profit').innerText = `R$ ${formatMoeda(lucroCaixa)}`;
    }

    // Exibe a caixinha flutuante customizada (no estilo roxo do gráfico) ao passar o mouse sobre um ponto da linha
    function showChartTooltip(evt, ponto) {
        const wrapper = document.getElementById('sales-chart-card');
        const tooltip = document.getElementById('chart-tooltip');
        const wrapperRect = wrapper.getBoundingClientRect();
        const x = evt.clientX - wrapperRect.left;
        const y = evt.clientY - wrapperRect.top;

        const nomesMesesTooltip = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const dataTooltip = chartAgrupamento === 'mes'
            ? (() => { const [ano, mes] = ponto.data.split('-'); return `${nomesMesesTooltip[parseInt(mes, 10) - 1]}/${ano}`; })()
            : ponto.data.split('-').reverse().join('/');
        tooltip.innerHTML = `<div class="tt-date">${dataTooltip}</div><div class="tt-value">R$ ${formatMoeda(ponto.valor)}</div>`;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.classList.add('show');
    }
    function hideChartTooltip() {
        document.getElementById('chart-tooltip').classList.remove('show');
    }

    function renderSalesChart() {
        const svg = document.getElementById('sales-chart-svg');
        const emptyMsg = document.getElementById('sales-chart-empty');
        const inicioVal = dataBRparaISO(document.getElementById('chart-data-inicio').value);
        const fimVal = dataBRparaISO(document.getElementById('chart-data-fim').value);

        // Faturamento/Lucro exibidos no painel agora acompanham o período escolhido no gráfico
        atualizarFaturamentoPeriodo(inicioVal, fimVal);
        hideChartTooltip();

        const somaPorDia = {};
        const nomesMesesChart = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        Object.values(allLoadedSales).forEach(s => {
            if(!s.salesDate) return;
            if((s.status || 'PAGO') === 'RASCUNHO') return;
            if(s.origemCredito) return; // transações de crédito (Aba 5) não entram no gráfico de vendas
            if(inicioVal && s.salesDate < inicioVal) return;
            if(fimVal && s.salesDate > fimVal) return;
            // No agrupamento Mensal, a chave passa a ser 'YYYY-MM' (soma de todas as vendas do mês)
            const chave = chartAgrupamento === 'mes' ? s.salesDate.slice(0, 7) : s.salesDate;
            somaPorDia[chave] = (somaPorDia[chave] || 0) + (s.totalValue || 0);
        });

        const datas = Object.keys(somaPorDia).sort();
        // Formata o rótulo de cada ponto/barra: DD/MM no modo diário, "Mês/AA" no modo mensal
        const labelPorChave = (chave) => {
            if(chartAgrupamento === 'mes') {
                const [ano, mes] = chave.split('-');
                return `${nomesMesesChart[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
            }
            return chave.split('-').slice(1).reverse().join('/');
        };
        svg.innerHTML = '';

        if(datas.length === 0) {
            emptyMsg.style.display = 'block';
            svg.style.display = 'none';
            return;
        }
        emptyMsg.style.display = 'none';
        svg.style.display = 'block';

        const ns = 'http://www.w3.org/2000/svg';
        const W = 900, H = 300;
        const mL = 72, mR = 20, mT = 24, mB = 48;
        const uw = W - mL - mR;
        const uh = H - mT - mB;
        const maxValor = Math.max(...datas.map(d => somaPorDia[d]), 1);

        // Linhas de grade e labels do eixo Y
        const ySteps = 5;
        for(let i = 0; i <= ySteps; i++) {
            const y = mT + (uh / ySteps) * i;
            const val = maxValor * (1 - i / ySteps);

            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', mL); line.setAttribute('x2', W - mR);
            line.setAttribute('y1', y); line.setAttribute('y2', y);
            line.setAttribute('stroke', document.documentElement.getAttribute('data-theme') === 'dark' ? (i === ySteps ? '#475569' : '#334155') : (i === ySteps ? '#c4cdd5' : '#eef1f3'));
            line.setAttribute('stroke-width', i === ySteps ? '1.5' : '1');
            svg.appendChild(line);

            const text = document.createElementNS(ns, 'text');
            text.setAttribute('x', mL - 10); text.setAttribute('y', y + 4);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('font-size', '11'); text.setAttribute('fill', 'var(--text-muted)');
            text.setAttribute('font-family', 'Segoe UI, sans-serif');
            text.textContent = `R$${val >= 1000 ? (val/1000).toFixed(1)+'k' : val.toFixed(0)}`;
            svg.appendChild(text);
        }

        // Eixo X vertical
        const eixoX = document.createElementNS(ns, 'line');
        eixoX.setAttribute('x1', mL); eixoX.setAttribute('x2', mL);
        eixoX.setAttribute('y1', mT); eixoX.setAttribute('y2', mT + uh);
        eixoX.setAttribute('stroke', '#c4cdd5'); eixoX.setAttribute('stroke-width', '1.5');
        svg.appendChild(eixoX);

        const passoLabel = Math.max(1, Math.ceil(datas.length / 9));

        if(chartType === 'barra') {
            const barGap = 0.25;
            const barW = Math.max(4, (uw / datas.length) * (1 - barGap));
            const spacing = uw / datas.length;

            datas.forEach((d, i) => {
                const barH = (somaPorDia[d] / maxValor) * uh;
                const x = mL + i * spacing + (spacing - barW) / 2;
                const y = mT + uh - barH;

                // Gradiente simulado com dois rects
                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('x', x); rect.setAttribute('y', y);
                rect.setAttribute('width', barW); rect.setAttribute('height', barH);
                rect.setAttribute('rx', '3');
                rect.setAttribute('fill', '#445b73');
                rect.setAttribute('opacity', '0.85');
                rect.style.cursor = 'pointer';
                svg.appendChild(rect);

                // Valor em cima da barra (somente se couber) - fonte maior e mais destacada para melhor leitura
                if(barW > 26) {
                    const valLabel = document.createElementNS(ns, 'text');
                    valLabel.setAttribute('x', x + barW / 2); valLabel.setAttribute('y', y - 8);
                    valLabel.setAttribute('text-anchor', 'middle');
                    valLabel.setAttribute('font-size', '13'); valLabel.setAttribute('font-weight', '800');
                    valLabel.setAttribute('fill', '#553c7b');
                    valLabel.setAttribute('font-family', 'Segoe UI, sans-serif');
                    valLabel.textContent = `R$${somaPorDia[d].toFixed(0)}`;
                    svg.appendChild(valLabel);
                }

                // Caixinha flutuante ao passar o mouse sobre a barra (mesmo padrão do gráfico de linha)
                const ponto = { data: d, valor: somaPorDia[d] };
                rect.addEventListener('mouseenter', (evt) => { rect.setAttribute('opacity', '1'); showChartTooltip(evt, ponto); });
                rect.addEventListener('mousemove', (evt) => showChartTooltip(evt, ponto));
                rect.addEventListener('mouseleave', () => { rect.setAttribute('opacity', '0.85'); hideChartTooltip(); });

                if(i % passoLabel === 0 || i === datas.length - 1) {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', x + barW / 2); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '11'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = labelPorChave(d);
                    svg.appendChild(text);
                }
            });

        } else {
            // GRÁFICO DE LINHA
            const pontos = datas.map((d, i) => ({
                x: datas.length === 1 ? mL + uw / 2 : mL + (uw / (datas.length - 1)) * i,
                y: mT + uh - (somaPorDia[d] / maxValor) * uh,
                valor: somaPorDia[d],
                data: d
            }));

            // Área sob a linha
            const areaPath = `M ${pontos[0].x} ${mT + uh} ` +
                pontos.map(p => `L ${p.x} ${p.y}`).join(' ') +
                ` L ${pontos[pontos.length - 1].x} ${mT + uh} Z`;
            const area = document.createElementNS(ns, 'path');
            area.setAttribute('d', areaPath);
            area.setAttribute('fill', 'rgba(155, 89, 182, 0.10)');
            area.setAttribute('stroke', 'none');
            svg.appendChild(area);

            // Linha principal
            const linePath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d', linePath);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#445b73');
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);

            pontos.forEach((p, i) => {
                // Círculo de ponto (visual)
                const circle = document.createElementNS(ns, 'circle');
                circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
                circle.setAttribute('r', '4.5'); circle.setAttribute('fill', '#445b73');
                circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '2');
                circle.style.transition = 'r .12s ease';
                svg.appendChild(circle);

                // Círculo invisível maior por cima, só para facilitar o hover e acionar o tooltip customizado
                // (substitui o antigo <title> nativo do navegador por uma caixinha flutuante no estilo do gráfico)
                const hitArea = document.createElementNS(ns, 'circle');
                hitArea.setAttribute('cx', p.x); hitArea.setAttribute('cy', p.y);
                hitArea.setAttribute('r', '12'); hitArea.setAttribute('fill', 'transparent');
                hitArea.style.cursor = 'pointer';
                hitArea.addEventListener('mouseenter', (evt) => { circle.setAttribute('r', '6.5'); showChartTooltip(evt, p); });
                hitArea.addEventListener('mousemove', (evt) => showChartTooltip(evt, p));
                hitArea.addEventListener('mouseleave', () => { circle.setAttribute('r', '4.5'); hideChartTooltip(); });
                svg.appendChild(hitArea);

                if(i % passoLabel === 0 || i === pontos.length - 1) {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', p.x); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '11'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = labelPorChave(p.data);
                    svg.appendChild(text);
                }
            });
        }
    }

    // AUTOCOMPLETE DE CLIENTES NO CAMPO "NOME DO CLIENTE" DA VENDA
    const clientNameInput = document.getElementById('sales-client-name');
    const clientDropdown = document.getElementById('client-autocomplete-dropdown');

    function renderClientDropdown(query) {
        const q = (query || '').toLowerCase().trim();
        clientDropdown.innerHTML = '';

        const matches = Object.values(allLoadedClientes)
            .filter(c => !q || c.name.toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name));

        matches.forEach(c => {
            const item = document.createElement('div');
            item.className = 'client-autocomplete-item';
            item.innerText = c.name;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                clientNameInput.value = c.name;
                clientDropdown.classList.remove('open');
            });
            clientDropdown.appendChild(item);
        });

        // Opção de criar novo se não houver match exato
        const exactMatch = Object.values(allLoadedClientes).some(c => c.name.toLowerCase() === q);
        if(q && !exactMatch) {
            const criar = document.createElement('div');
            criar.className = 'client-autocomplete-item create-new';
            criar.innerText = `➕ Criar cliente "${query}"`;
            criar.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const novoRef = push(ref(db, 'clientes'));
                set(novoRef, { name: query }).then(() => {
                    clientNameInput.value = query;
                    clientDropdown.classList.remove('open');
                });
            });
            clientDropdown.appendChild(criar);
        }

        clientDropdown.classList.toggle('open', clientDropdown.children.length > 0);
    }

    clientNameInput.addEventListener('input', () => renderClientDropdown(clientNameInput.value));
    clientNameInput.addEventListener('focus', () => renderClientDropdown(clientNameInput.value));
    clientNameInput.addEventListener('blur', () => setTimeout(() => clientDropdown.classList.remove('open'), 150));

    // MODAL NOVO CLIENTE
    setupModalEvents('btn-trigger-modal-novo-cliente', 'modal-novo-cliente', 'close-modal-novo-cliente');
    document.getElementById('form-novo-cliente').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('novo-cliente-name').value.trim();
        if(!name) return;
        const jaExiste = Object.values(allLoadedClientes).some(c => c.name.toLowerCase() === name.toLowerCase());
        if(jaExiste) { showAlert('Já existe um cliente com este nome.', 'warning'); return; }
        const novoRef = push(ref(db, 'clientes'));
        set(novoRef, { name }).then(() => {
            document.getElementById('modal-novo-cliente').style.display = 'none';
            document.getElementById('form-novo-cliente').reset();
        });
    });

    // RENDERIZA TABELA DE CLIENTES COM TOTAIS DE VENDAS
    function renderClientesTable() {
        const tbody = document.getElementById('clientes-table-body');
        tbody.innerHTML = '';

        // Monta os dados agregados de cada cliente
        let clientes = Object.entries(allLoadedClientes).map(([key, cliente]) => {
            let recebido = 0, aReceber = 0;
            Object.values(allLoadedSales).forEach(v => {
                if((v.clientName || '').toLowerCase() === cliente.name.toLowerCase()) {
                    if(v.status === 'PAGO') recebido += (v.totalValue || 0);
                    if(v.status === 'CONFIRMADA') aReceber += (v.totalValue || 0);
                }
            });
            return { key, nome: cliente.name, recebido, aReceber, credito: calcularCreditoCliente(cliente.name) };
        });

        // Filtro por nome (não diferencia maiúsculas/minúsculas)
        if(filtroBuscaClientes) {
            clientes = clientes.filter(c => c.nome.toLowerCase().includes(filtroBuscaClientes.toLowerCase()));
        }

        if(clientes.length === 0) {
            const msg = filtroBuscaClientes ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado.';
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-faint); padding:20px;">${msg}</td></tr>`;
            return;
        }

        // Aplica a ordenação escolhida pelo usuário (clique no cabeçalho) ou, por padrão, ordem alfabética
        if (clientesSort.key) {
            const dirMult = clientesSort.dir === 'asc' ? 1 : -1;
            clientes.sort((a, b) => {
                const valA = a[clientesSort.key];
                const valB = b[clientesSort.key];
                if (typeof valA === 'string') {
                    return valA.localeCompare(valB) * dirMult;
                }
                return (valA - valB) * dirMult;
            });
        } else {
            clientes.sort((a, b) => a.nome.localeCompare(b.nome));
        }

        clientes.forEach(cliente => {
            const tr = document.createElement('tr');

            // "A RECEBER": valores maiores que zero recebem destaque visual (pílula laranja);
            // valores zerados/abaixo de zero mantêm a exibição simples original.
            const aReceberHtml = cliente.aReceber > 0
                ? `<span class="areceber-pill">R$ ${formatMoeda(cliente.aReceber)}</span>`
                : `<span class="areceber-zero">R$ ${formatMoeda(cliente.aReceber)}</span>`;

            const creditoHtml = cliente.credito > 0
                ? `<span class="credito-pill">R$ ${formatMoeda(cliente.credito)}</span>`
                : `<span class="credito-zero">R$ ${formatMoeda(cliente.credito)}</span>`;

            tr.innerHTML = `
                <td><a href="javascript:void(0)" class="cliente-nome-link" data-key="${cliente.key}">${cliente.nome}</a></td>
                <td style="color:var(--color-positive); font-weight:600;">R$ ${formatMoeda(cliente.recebido)}</td>
                <td>${aReceberHtml}</td>
                <td>${creditoHtml}</td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.cliente-nome-link').forEach(link => {
            link.addEventListener('click', () => abrirDetalheCliente(link.dataset.key));
        });
    }

    // ===== MODAL DETALHE DO CLIENTE (ABA 5 - ABRE AO CLICAR NO NOME NA TABELA) =====
    setupModalEvents(null, 'modal-detalhe-cliente', 'close-modal-detalhe-cliente');

    let currentDetalheClienteKey = null;
    let detalheClienteChartType = 'linha'; // 'linha' ou 'barra'

    function abrirDetalheCliente(key) {
        const cliente = allLoadedClientes[key];
        if (!cliente) return;

        currentDetalheClienteKey = key;
        document.getElementById('detalhe-cliente-nome').innerText = `👤 ${cliente.name}`;
        document.getElementById('detalhe-cliente-nome-view').style.display = 'flex';
        document.getElementById('detalhe-cliente-nome-edit').style.display = 'none';

        atualizarStatsDetalheCliente();

        detalheClienteChartType = 'linha';
        document.getElementById('btn-cliente-chart-linha').classList.add('active');
        document.getElementById('btn-cliente-chart-barra').classList.remove('active');
        setClientePeriodPreset(null); // "Tudo" (já renderiza o gráfico)

        renderDetalheClienteCreditos();

        document.getElementById('modal-detalhe-cliente').style.display = 'flex';
    }
    window.abrirDetalheCliente = abrirDetalheCliente;

    function atualizarStatsDetalheCliente() {
        const cliente = allLoadedClientes[currentDetalheClienteKey];
        if (!cliente) return;
        let recebido = 0, aReceber = 0;
        Object.values(allLoadedSales).forEach(v => {
            if ((v.clientName || '').toLowerCase() === cliente.name.toLowerCase()) {
                if (v.status === 'PAGO') recebido += (v.totalValue || 0);
                if (v.status === 'CONFIRMADA') aReceber += (v.totalValue || 0);
            }
        });
        document.getElementById('detalhe-cliente-recebido').innerText = `R$ ${formatMoeda(recebido)}`;
        document.getElementById('detalhe-cliente-areceber').innerText = `R$ ${formatMoeda(aReceber)}`;
        document.getElementById('detalhe-cliente-credito').innerText = `R$ ${formatMoeda(calcularCreditoCliente(cliente.name))}`;
    }

    // Caixinha flutuante do gráfico de compras do cliente (mesmo estilo do gráfico da Aba 4)
    function showDetalheClienteTooltip(evt, ponto) {
        const wrapper = document.getElementById('detalhe-cliente-chart-svg').closest('.card');
        const tooltip = document.getElementById('detalhe-cliente-chart-tooltip');
        const wrapperRect = wrapper.getBoundingClientRect();
        tooltip.innerHTML = `<div class="tt-date">${ponto.data.split('-').reverse().join('/')}</div><div class="tt-value">R$ ${formatMoeda(ponto.valor)}</div>`;
        tooltip.style.left = `${evt.clientX - wrapperRect.left}px`;
        tooltip.style.top = `${evt.clientY - wrapperRect.top}px`;
        tooltip.classList.add('show');
    }

    function highlightClientePeriodPreset(days) {
        document.getElementById('btn-cliente-periodo-7d').classList.toggle('active', days === 7);
        document.getElementById('btn-cliente-periodo-30d').classList.toggle('active', days === 30);
        document.getElementById('btn-cliente-periodo-todos').classList.toggle('active', days === null);
    }

    function setClientePeriodPreset(days) {
        const fim = new Date();
        document.getElementById('detalhe-cliente-data-fim').value = dataISOparaBR(formatDateInputValue(fim));
        if (days !== null) {
            const inicio = new Date();
            inicio.setDate(fim.getDate() - (days - 1));
            document.getElementById('detalhe-cliente-data-inicio').value = dataISOparaBR(formatDateInputValue(inicio));
        } else {
            document.getElementById('detalhe-cliente-data-inicio').value = '';
        }
        highlightClientePeriodPreset(days);
        renderDetalheClienteChart();
    }

    // Gráfico de compras REAIS do cliente (exclui transações de crédito), no mesmo estilo visual do gráfico da Aba 4,
    // com suporte a visualização em Linha/Barras e período personalizado (dd/mm/aaaa até dd/mm/aaaa)
    function renderDetalheClienteChart() {
        const cliente = allLoadedClientes[currentDetalheClienteKey];
        if (!cliente) return;
        const svg = document.getElementById('detalhe-cliente-chart-svg');
        const emptyMsg = document.getElementById('detalhe-cliente-chart-empty');
        document.getElementById('detalhe-cliente-chart-tooltip').classList.remove('show');

        const inicioVal = dataBRparaISO(document.getElementById('detalhe-cliente-data-inicio').value);
        const fimVal = dataBRparaISO(document.getElementById('detalhe-cliente-data-fim').value);

        const somaPorDia = {};
        let totalValor = 0, totalQtd = 0;
        Object.values(allLoadedSales).forEach(s => {
            if (!s.salesDate) return;
            if ((s.status || 'PAGO') === 'RASCUNHO') return;
            if (s.origemCredito) return;
            if ((s.clientName || '').toLowerCase() !== cliente.name.toLowerCase()) return;
            if (inicioVal && s.salesDate < inicioVal) return;
            if (fimVal && s.salesDate > fimVal) return;
            somaPorDia[s.salesDate] = (somaPorDia[s.salesDate] || 0) + (s.totalValue || 0);
            totalValor += (s.totalValue || 0);
            totalQtd += (s.quantity || 0);
        });

        document.getElementById('detalhe-cliente-total-valor').innerText = `R$ ${formatMoeda(totalValor)}`;
        document.getElementById('detalhe-cliente-total-qtd').innerText = `${formatQuantidade(totalQtd)} un`;

        const datas = Object.keys(somaPorDia).sort();
        svg.innerHTML = '';

        if (datas.length === 0) {
            emptyMsg.style.display = 'block';
            svg.style.display = 'none';
            return;
        }
        emptyMsg.style.display = 'none';
        svg.style.display = 'block';

        const ns = 'http://www.w3.org/2000/svg';
        const W = 780, H = 240;
        const mL = 64, mR = 16, mT = 20, mB = 40;
        const uw = W - mL - mR;
        const uh = H - mT - mB;
        const maxValor = Math.max(...datas.map(d => somaPorDia[d]), 1);

        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = mT + (uh / ySteps) * i;
            const val = maxValor * (1 - i / ySteps);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', mL); line.setAttribute('x2', W - mR);
            line.setAttribute('y1', y); line.setAttribute('y2', y);
            line.setAttribute('stroke', document.documentElement.getAttribute('data-theme') === 'dark' ? (i === ySteps ? '#475569' : '#334155') : (i === ySteps ? '#c4cdd5' : '#eef1f3'));
            line.setAttribute('stroke-width', i === ySteps ? '1.5' : '1');
            svg.appendChild(line);

            const text = document.createElementNS(ns, 'text');
            text.setAttribute('x', mL - 8); text.setAttribute('y', y + 4);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('font-size', '10'); text.setAttribute('fill', 'var(--text-muted)');
            text.setAttribute('font-family', 'Segoe UI, sans-serif');
            text.textContent = `R$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)}`;
            svg.appendChild(text);
        }

        const eixoX = document.createElementNS(ns, 'line');
        eixoX.setAttribute('x1', mL); eixoX.setAttribute('x2', mL);
        eixoX.setAttribute('y1', mT); eixoX.setAttribute('y2', mT + uh);
        eixoX.setAttribute('stroke', '#c4cdd5'); eixoX.setAttribute('stroke-width', '1.5');
        svg.appendChild(eixoX);

        const passoLabel = Math.max(1, Math.ceil(datas.length / 7));

        if (detalheClienteChartType === 'barra') {
            const barGap = 0.25;
            const barW = Math.max(4, (uw / datas.length) * (1 - barGap));
            const spacing = uw / datas.length;

            datas.forEach((d, i) => {
                const barH = (somaPorDia[d] / maxValor) * uh;
                const x = mL + i * spacing + (spacing - barW) / 2;
                const y = mT + uh - barH;

                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('x', x); rect.setAttribute('y', y);
                rect.setAttribute('width', barW); rect.setAttribute('height', barH);
                rect.setAttribute('rx', '3');
                rect.setAttribute('fill', '#0a6ed1');
                rect.setAttribute('opacity', '0.85');
                rect.style.cursor = 'pointer';
                svg.appendChild(rect);

                if (barW > 22) {
                    const valLabel = document.createElementNS(ns, 'text');
                    valLabel.setAttribute('x', x + barW / 2); valLabel.setAttribute('y', y - 6);
                    valLabel.setAttribute('text-anchor', 'middle');
                    valLabel.setAttribute('font-size', '11'); valLabel.setAttribute('font-weight', '800');
                    valLabel.setAttribute('fill', '#0854a0');
                    valLabel.setAttribute('font-family', 'Segoe UI, sans-serif');
                    valLabel.textContent = `R$${somaPorDia[d].toFixed(0)}`;
                    svg.appendChild(valLabel);
                }

                const pontoBarra = { data: d, valor: somaPorDia[d] };
                rect.addEventListener('mouseenter', (evt) => { rect.setAttribute('opacity', '1'); showDetalheClienteTooltip(evt, pontoBarra); });
                rect.addEventListener('mousemove', (evt) => showDetalheClienteTooltip(evt, pontoBarra));
                rect.addEventListener('mouseleave', () => { rect.setAttribute('opacity', '0.85'); document.getElementById('detalhe-cliente-chart-tooltip').classList.remove('show'); });

                if (i % passoLabel === 0 || i === datas.length - 1) {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', x + barW / 2); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '10'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = d.split('-').slice(1).reverse().join('/');
                    svg.appendChild(text);
                }
            });

        } else {
            const pontos = datas.map((d, i) => ({
                x: datas.length === 1 ? mL + uw / 2 : mL + (uw / (datas.length - 1)) * i,
                y: mT + uh - (somaPorDia[d] / maxValor) * uh,
                valor: somaPorDia[d],
                data: d
            }));

            const areaPath = `M ${pontos[0].x} ${mT + uh} ` +
                pontos.map(p => `L ${p.x} ${p.y}`).join(' ') +
                ` L ${pontos[pontos.length - 1].x} ${mT + uh} Z`;
            const area = document.createElementNS(ns, 'path');
            area.setAttribute('d', areaPath);
            area.setAttribute('fill', 'rgba(52, 152, 219, 0.10)');
            area.setAttribute('stroke', 'none');
            svg.appendChild(area);

            const linePath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d', linePath);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#0a6ed1');
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);

            pontos.forEach((p, i) => {
                const circle = document.createElementNS(ns, 'circle');
                circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
                circle.setAttribute('r', '4'); circle.setAttribute('fill', '#0a6ed1');
                circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '2');
                svg.appendChild(circle);

                const hitArea = document.createElementNS(ns, 'circle');
                hitArea.setAttribute('cx', p.x); hitArea.setAttribute('cy', p.y);
                hitArea.setAttribute('r', '11'); hitArea.setAttribute('fill', 'transparent');
                hitArea.style.cursor = 'pointer';
                hitArea.addEventListener('mouseenter', (evt) => { circle.setAttribute('r', '6'); showDetalheClienteTooltip(evt, p); });
                hitArea.addEventListener('mousemove', (evt) => showDetalheClienteTooltip(evt, p));
                hitArea.addEventListener('mouseleave', () => { circle.setAttribute('r', '4'); document.getElementById('detalhe-cliente-chart-tooltip').classList.remove('show'); });
                svg.appendChild(hitArea);

                if (i % passoLabel === 0 || i === pontos.length - 1) {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', p.x); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '10'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = p.data.split('-').slice(1).reverse().join('/');
                    svg.appendChild(text);
                }
            });
        }
    }

    document.getElementById('btn-cliente-chart-linha').addEventListener('click', () => {
        detalheClienteChartType = 'linha';
        document.getElementById('btn-cliente-chart-linha').classList.add('active');
        document.getElementById('btn-cliente-chart-barra').classList.remove('active');
        renderDetalheClienteChart();
    });
    document.getElementById('btn-cliente-chart-barra').addEventListener('click', () => {
        detalheClienteChartType = 'barra';
        document.getElementById('btn-cliente-chart-barra').classList.add('active');
        document.getElementById('btn-cliente-chart-linha').classList.remove('active');
        renderDetalheClienteChart();
    });
    document.getElementById('btn-cliente-periodo-7d').addEventListener('click', () => setClientePeriodPreset(7));
    document.getElementById('btn-cliente-periodo-30d').addEventListener('click', () => setClientePeriodPreset(30));
    document.getElementById('btn-cliente-periodo-todos').addEventListener('click', () => setClientePeriodPreset(null));
    document.getElementById('btn-cliente-periodo-custom').addEventListener('click', () => { highlightClientePeriodPreset(-1); renderDetalheClienteChart(); });


    // Lista as transações que compõem o saldo de crédito do cliente: tanto as lançadas manualmente na
    // Aba 5 (Adicionado/Retirada) quanto o crédito gerado/usado automaticamente dentro de vendas normais
    // (Aba 4, quando o cliente paga a mais ou usa o crédito para abater uma venda) - a coluna ORIGEM deixa
    // claro de onde veio cada valor. Só as transações manuais podem ser excluídas por aqui; as vinculadas
    // a uma venda são desfeitas revertendo o status da venda na Aba 4 (ver "Reversão de Venda Paga").
    function renderDetalheClienteCreditos() {
        const cliente = allLoadedClientes[currentDetalheClienteKey];
        const tbody = document.getElementById('detalhe-cliente-creditos-body');
        tbody.innerHTML = '';
        if (!cliente) return;

        const nomeLower = cliente.name.toLowerCase();
        const linhas = [];

        Object.entries(allLoadedSales).forEach(([key, s]) => {
            if ((s.clientName || '').toLowerCase() !== nomeLower) return;

            if (s.origemCredito) {
                // Lançamento manual de crédito (Aba 5): Adicionado ou Retirada
                linhas.push({
                    key, timestamp: s.timestamp || 0, salesDate: s.salesDate,
                    isRetirada: !!s.retiradaCredito, valor: Math.abs(s.totalValue || 0),
                    origem: 'Manual (Aba 5)', excluivel: true
                });
            } else if ((s.status || 'PAGO') === 'PAGO') {
                // Crédito gerado/usado automaticamente dentro de uma venda normal (Aba 4)
                if ((s.creditoGerado || 0) > 0) {
                    linhas.push({
                        key, timestamp: s.timestamp || 0, salesDate: s.salesDate,
                        isRetirada: false, valor: parseFloat(s.creditoGerado || 0),
                        origem: 'Veio de venda (pagou a mais)', excluivel: false
                    });
                }
                if ((s.creditoUsado || 0) > 0) {
                    linhas.push({
                        key, timestamp: s.timestamp || 0, salesDate: s.salesDate,
                        isRetirada: true, valor: parseFloat(s.creditoUsado || 0),
                        origem: 'Usado em venda', excluivel: false
                    });
                }
            }
        });

        linhas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (linhas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-faint); padding:16px;">Nenhuma transação de crédito registrada.</td></tr>';
            return;
        }

        linhas.forEach((t, idx) => {
            const dataFormatada = t.salesDate ? t.salesDate.split('-').reverse().join('/') : '---';
            const tr = document.createElement('tr');
            const acaoHtml = t.excluivel
                ? `<button class="btn-action-prod btn-delete-prod" onclick="excluirTransacaoCredito('${t.key}')">🗑️ Excluir</button>`
                : `<span style="color:var(--text-faint); font-size:9pt;">Ajustar na venda (Aba 4)</span>`;
            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td><span class="badge-status ${t.isRetirada ? 'status-cancelado' : 'status-pago'}">${t.isRetirada ? '➖ Retirada' : '➕ Adicionado'}</span></td>
                <td style="font-size:9pt; color:var(--text-muted);">${t.origem}</td>
                <td style="font-weight:600; color:${t.isRetirada ? 'var(--color-negative)' : 'var(--color-positive)'};">R$ ${formatMoeda(t.valor)}</td>
                <td>${acaoHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Exclui uma transação de crédito lançada por engano (ex: testes) e desfaz o efeito dela no saldo do cliente:
    // se era um crédito "Adicionado", remove o valor do saldo; se era uma "Retirada", devolve o valor ao saldo.
    // Isso corrige automaticamente valores de "Recebido (Pago)" que ficaram errados por causa de lançamentos de teste.
    function excluirTransacaoCredito(key) {
        const transacao = allLoadedSales[key];
        if (!transacao) return;

        const isRetirada = !!transacao.retiradaCredito;
        const valorAbs = Math.abs(transacao.totalValue || 0);
        const temMovCaixa = !!(transacao.movimentacaoCaixaKey && transacao.contaPagamentoKey && allLoadedContas[transacao.contaPagamentoKey]);
        const avisoCaixa = temMovCaixa ? `\n• O lançamento correspondente na conta "${transacao.contaPagamentoNome}" (Aba 6 - Caixa) também será desfeito.` : '';

        showConfirm(
            `Deseja excluir esta transação de crédito (${isRetirada ? 'Retirada' : 'Adicionado'} de R$ ${formatMoeda(valorAbs)})?\n\nAo confirmar:\n• O lançamento será apagado permanentemente.\n• O saldo de crédito do cliente será ajustado automaticamente (${isRetirada ? 'o valor retirado voltará para o saldo' : 'o valor será removido do saldo'}).\n• O "Recebido (Pago)" deste cliente também será corrigido.${avisoCaixa}`,
            'warning',
            'Excluir Transação de Crédito'
        ).then(ok => {
            if (!ok) return;

            // O saldo de crédito é sempre derivado do histórico (calcularCreditoCliente), então basta
            // apagar o lançamento de vendas/{key} - o saldo do cliente se ajusta sozinho automaticamente.
            remove(ref(db, `vendas/${key}`)).then(() => {
                delete allLoadedSales[key];

                // Desfaz o lançamento de Caixa gerado por esta transação de crédito (Aba 6): remove a
                // movimentação e devolve o saldo da conta ao valor de antes dela existir. Como a "Retirada"
                // grava uma saída (valorPago negativo) e o "Adicionado" grava uma entrada (valorPago positivo),
                // basta subtrair valorPago do saldo em ambos os casos para reverter corretamente.
                const finalizarExclusao = () => {
                    atualizarStatsDetalheCliente();
                    renderDetalheClienteChart();
                    renderDetalheClienteCreditos();
                    renderClientesTable();
                    renderSalesHistoryTable();
                    showAlert('Transação de crédito excluída e saldo ajustado com sucesso!', 'success');
                };

                if (temMovCaixa) {
                    const saldoAtual = parseFloat(allLoadedContas[transacao.contaPagamentoKey].saldo || 0);
                    const novoSaldo = parseFloat((saldoAtual - (transacao.valorPago || 0)).toFixed(2));
                    Promise.all([
                        remove(ref(db, `movimentacoesCaixa/${transacao.movimentacaoCaixaKey}`)),
                        update(ref(db, `contas/${transacao.contaPagamentoKey}`), { saldo: novoSaldo })
                    ]).then(finalizarExclusao);
                } else {
                    finalizarExclusao();
                }
            });
        });
    }
    window.excluirTransacaoCredito = excluirTransacaoCredito;

    // Edição do nome do cliente (in-line no cabeçalho do modal)
    document.getElementById('btn-editar-nome-cliente').addEventListener('click', () => {
        const cliente = allLoadedClientes[currentDetalheClienteKey];
        if (!cliente) return;
        document.getElementById('detalhe-cliente-nome-input').value = cliente.name;
        document.getElementById('detalhe-cliente-nome-view').style.display = 'none';
        document.getElementById('detalhe-cliente-nome-edit').style.display = 'flex';
        document.getElementById('detalhe-cliente-nome-input').focus();
    });

    document.getElementById('btn-cancelar-nome-cliente').addEventListener('click', () => {
        document.getElementById('detalhe-cliente-nome-edit').style.display = 'none';
        document.getElementById('detalhe-cliente-nome-view').style.display = 'flex';
    });

    // Ao salvar o novo nome, propaga a alteração para TODAS as vendas/transações de crédito já ligadas ao cliente
    // (é o nome que faz a ligação entre cliente e vendas em todo o sistema, então tudo precisa ser atualizado junto)
    document.getElementById('btn-salvar-nome-cliente').addEventListener('click', () => {
        const cliente = allLoadedClientes[currentDetalheClienteKey];
        if (!cliente) return;
        const novoNome = document.getElementById('detalhe-cliente-nome-input').value.trim();

        if (!novoNome) { showAlert('Informe um nome válido.', 'warning'); return; }
        const nomeAtual = cliente.name;
        // Comparação EXATA (sensível a maiúsculas/minúsculas): se só a caixa do nome mudou (ex: "Marcelo" -> "MARCELO"),
        // isso ainda conta como alteração e precisa ser salvo. Só pula o salvamento se o texto for idêntico.
        if (novoNome === nomeAtual) {
            document.getElementById('detalhe-cliente-nome-edit').style.display = 'none';
            document.getElementById('detalhe-cliente-nome-view').style.display = 'flex';
            return;
        }

        const jaExiste = Object.entries(allLoadedClientes).some(([k, c]) => k !== currentDetalheClienteKey && (c.name || '').toLowerCase() === novoNome.toLowerCase());
        if (jaExiste) { showAlert('Já existe um cliente cadastrado com este nome.', 'warning'); return; }

        const vendasParaAtualizar = Object.keys(allLoadedSales).filter(k => (allLoadedSales[k].clientName || '').toLowerCase() === nomeAtual.toLowerCase());

        const promessas = [update(ref(db, `clientes/${currentDetalheClienteKey}`), { name: novoNome })];
        vendasParaAtualizar.forEach(k => promessas.push(update(ref(db, `vendas/${k}`), { clientName: novoNome })));

        Promise.all(promessas).then(() => {
            // Atualiza o cache local imediatamente, sem esperar a sincronização do Firebase
            allLoadedClientes[currentDetalheClienteKey].name = novoNome;
            vendasParaAtualizar.forEach(k => { allLoadedSales[k].clientName = novoNome; });

            document.getElementById('detalhe-cliente-nome').innerText = `👤 ${novoNome}`;
            document.getElementById('detalhe-cliente-nome-edit').style.display = 'none';
            document.getElementById('detalhe-cliente-nome-view').style.display = 'flex';

            atualizarStatsDetalheCliente();
            renderDetalheClienteChart();
            renderDetalheClienteCreditos();
            renderClientesTable();
            renderSalesHistoryTable();

            showAlert(`Nome atualizado para "${novoNome}" com sucesso! ${vendasParaAtualizar.length} registro(s) de venda/crédito vinculados também foram atualizados.`, 'success');
        });
    });

    // ===== MODAL "CRÉDITOS" (ABA 5, BOTÃO AO LADO DE "NOVO CLIENTE") =====
    // Adicionar: cliente paga antecipadamente por um produto que ainda vai retirar (ex: paga hoje, retira amanhã).
    // Retirar: remove crédito do saldo do cliente (ex: correção de lançamento indevido, estorno, etc.).
    setupModalEvents('btn-trigger-modal-adicionar-credito', 'modal-adicionar-credito', 'close-modal-adicionar-credito');

    let tipoOperacaoCredito = 'adicionar';

    const addCreditoClienteInput = document.getElementById('adicionar-credito-cliente-nome');
    const addCreditoDropdown = document.getElementById('adicionar-credito-cliente-dropdown');

    // Reseta o modal para o estado padrão ("Adicionar") toda vez que ele é aberto
    document.getElementById('btn-trigger-modal-adicionar-credito').addEventListener('click', () => {
        tipoOperacaoCredito = 'adicionar';
        document.querySelectorAll('.credito-tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.tipo === 'adicionar'));
        document.getElementById('form-adicionar-credito').reset();
        popularSelectContaCredito();
        atualizarUiTipoCredito();
    });

    // Busca (por nome exato) o crédito atual do cliente digitado no modal
    function getCreditoAtualClienteModal() {
        const nome = addCreditoClienteInput.value.trim().toLowerCase();
        if (!nome) return 0;
        const key = Object.keys(allLoadedClientes).find(k => (allLoadedClientes[k].name || '').toLowerCase() === nome);
        return key ? calcularCreditoCliente(allLoadedClientes[key].name) : 0;
    }

    // Atualiza textos, rótulos e a exibição do crédito disponível conforme o tipo de operação selecionado
    function atualizarUiTipoCredito() {
        const label = document.getElementById('adicionar-credito-valor-label');
        const explicacao = document.getElementById('adicionar-credito-explicacao');
        const infoCadastro = document.getElementById('adicionar-credito-info-cadastro');
        const disponivelInfo = document.getElementById('adicionar-credito-disponivel-info');
        const disponivelValor = document.getElementById('adicionar-credito-disponivel-valor');
        const btnSalvar = document.getElementById('btn-salvar-credito');
        const valorInput = document.getElementById('adicionar-credito-valor');

        const contaLabel = document.getElementById('adicionar-credito-conta-label');

        if (tipoOperacaoCredito === 'retirar') {
            label.innerText = 'Valor do Crédito a Retirar (R$)';
            explicacao.innerText = 'Use para remover crédito do saldo do cliente (ex: lançamento feito por engano, estorno, etc.). O valor é descontado do saldo do cliente e também é removido do Faturamento Total, já que o dinheiro deixa de estar contabilizado como recebido. O valor também sai da conta selecionada abaixo (Aba 6 - Caixa).';
            infoCadastro.style.display = 'none';
            const creditoAtual = getCreditoAtualClienteModal();
            disponivelInfo.style.display = 'block';
            disponivelValor.innerText = `R$ ${formatMoeda(creditoAtual)}`;
            valorInput.max = creditoAtual;
            btnSalvar.innerText = 'Salvar';
            btnSalvar.style.backgroundColor = 'var(--color-negative)';
            contaLabel.innerText = 'Conta de Onde o Valor Vai Sair';
        } else {
            label.innerText = 'Valor do Crédito a Adicionar (R$)';
            explicacao.innerText = 'Use quando o cliente pagar antecipadamente por um produto que ainda será retirado depois (ex: pagou hoje, retira amanhã). O valor fica disponível como crédito do cliente e entra imediatamente no Faturamento Total e na conta selecionada abaixo (Aba 6 - Caixa), com Lucro Bruto de R$ 0,00 - o lucro só é reconhecido quando o produto for de fato entregue/vendido na Aba 4.';
            infoCadastro.style.display = 'block';
            disponivelInfo.style.display = 'none';
            valorInput.removeAttribute('max');
            btnSalvar.innerText = 'Salvar';
            btnSalvar.style.backgroundColor = '#33465a';
            contaLabel.innerText = 'Conta que Recebeu o Valor';
        }
    }

    document.querySelectorAll('.credito-tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            tipoOperacaoCredito = btn.dataset.tipo;
            document.querySelectorAll('.credito-tipo-btn').forEach(b => b.classList.toggle('active', b === btn));
            atualizarUiTipoCredito();
        });
    });

    function renderAddCreditoClientDropdown(query) {
        const q = (query || '').toLowerCase().trim();
        addCreditoDropdown.innerHTML = '';

        const matches = Object.values(allLoadedClientes)
            .filter(c => !q || c.name.toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name));

        matches.forEach(c => {
            const item = document.createElement('div');
            item.className = 'client-autocomplete-item';
            item.innerText = c.name;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                addCreditoClienteInput.value = c.name;
                addCreditoDropdown.classList.remove('open');
                atualizarUiTipoCredito();
            });
            addCreditoDropdown.appendChild(item);
        });

        const exactMatch = Object.values(allLoadedClientes).some(c => c.name.toLowerCase() === q);
        if(q && !exactMatch) {
            const criar = document.createElement('div');
            criar.className = 'client-autocomplete-item create-new';
            criar.innerText = `➕ Novo cliente "${query}"`;
            criar.addEventListener('mousedown', (e) => {
                e.preventDefault();
                addCreditoClienteInput.value = query;
                addCreditoDropdown.classList.remove('open');
            });
            addCreditoDropdown.appendChild(criar);
        }

        addCreditoDropdown.classList.toggle('open', addCreditoDropdown.children.length > 0);
    }

    addCreditoClienteInput.addEventListener('input', () => { renderAddCreditoClientDropdown(addCreditoClienteInput.value); atualizarUiTipoCredito(); });
    addCreditoClienteInput.addEventListener('focus', () => renderAddCreditoClientDropdown(addCreditoClienteInput.value));
    addCreditoClienteInput.addEventListener('blur', () => setTimeout(() => addCreditoDropdown.classList.remove('open'), 150));

    document.getElementById('form-adicionar-credito').addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = addCreditoClienteInput.value.trim();
        const valor = parseFloat(document.getElementById('adicionar-credito-valor').value);
        const contaKey = document.getElementById('adicionar-credito-conta').value;

        if (!nome) { showAlert('Informe o nome do cliente.', 'warning'); return; }
        if (isNaN(valor) || valor <= 0) { showAlert('Informe um valor válido.', 'warning'); return; }
        if (!contaKey || !allLoadedContas[contaKey]) { showAlert('Selecione a conta.', 'warning'); return; }
        const contaNome = allLoadedContas[contaKey].name;

        const clienteKeyExistente = Object.keys(allLoadedClientes).find(k => (allLoadedClientes[k].name || '').toLowerCase() === nome.toLowerCase());

        // ===== RETIRAR CRÉDITO =====
        if (tipoOperacaoCredito === 'retirar') {
            const creditoAtual = clienteKeyExistente ? calcularCreditoCliente(allLoadedClientes[clienteKeyExistente].name) : 0;

            if (!clienteKeyExistente || creditoAtual <= 0) { showAlert('Este cliente não possui crédito disponível para retirar.', 'warning'); return; }
            if (valor > creditoAtual) { showAlert(`Este cliente possui apenas R$ ${formatMoeda(creditoAtual)} de crédito disponível.`, 'warning'); return; }

            // Registra a retirada como uma movimentação negativa no caixa, já que o valor estava
            // contabilizado no Faturamento Total no momento em que o crédito foi adicionado.
            // O saldo de crédito do cliente é sempre derivado do histórico (calcularCreditoCliente),
            // então não é preciso (nem correto) escrever manualmente em `clientes/{key}/credito` aqui.
            // Também lança uma saída na conta escolhida (Aba 6 - Caixa), desfazendo a entrada que a
            // adição original desse crédito havia gerado.
            const hoje = formatDateInputValue(new Date());
            const novaVendaRef = push(ref(db, 'vendas'));
            const movRefCaixaRetirada = push(ref(db, 'movimentacoesCaixa'));
            set(novaVendaRef, {
                clientName: nome,
                salesDate: hoje,
                salesDueDate: hoje,
                status: 'PAGO',
                items: [{ productKey: '', productName: 'Retirada de Crédito do Cliente', quantity: 1, sellingPrice: -valor, discountType: '$', discountValue: 0, totalItemNet: -valor }],
                totalValue: -valor,
                totalProfit: 0,
                quantity: 1,
                valorPago: -valor,
                creditoUsado: 0,
                creditoGerado: 0,
                origemCredito: true,
                retiradaCredito: true,
                contaPagamentoKey: contaKey,
                contaPagamentoNome: contaNome,
                movimentacaoCaixaKey: movRefCaixaRetirada.key,
                timestamp: Date.now()
            }).then(() => {
                const saldoAtual = parseFloat(allLoadedContas[contaKey].saldo || 0);
                const novoSaldo = parseFloat((saldoAtual - valor).toFixed(2));
                return Promise.all([
                    set(movRefCaixaRetirada, {
                        contaKey, contaNome, tipo: 'saida',
                        valor: valor, descricao: `Retirada de crédito de ${nome}`,
                        data: hoje, timestamp: Date.now()
                    }),
                    update(ref(db, `contas/${contaKey}`), { saldo: novoSaldo })
                ]);
            }).then(() => {
                document.getElementById('modal-adicionar-credito').style.display = 'none';
                document.getElementById('form-adicionar-credito').reset();
                showAlert(`Crédito de R$ ${formatMoeda(valor)} retirado de ${nome} e descontado da conta "${contaNome}".`, 'success');
            });
            return;
        }

        // ===== ADICIONAR CRÉDITO =====
        // Registra o valor como uma movimentação "PAGA" no caixa (entra no Faturamento Total agora, pois é
        // dinheiro que já entrou no caixa hoje) com Lucro = R$0 (o custo do produto só será reconhecido quando
        // o cliente de fato retirar o produto, evitando contar lucro antes da entrega). Também lança uma
        // entrada na conta escolhida (Aba 6 - Caixa) e soma o valor ao saldo dela, já que é dinheiro que
        // já entrou de fato.
        const registrarMovimentacaoDeCredito = () => {
            const hoje = formatDateInputValue(new Date());
            const novaVendaRef = push(ref(db, 'vendas'));
            const movRefCaixa = push(ref(db, 'movimentacoesCaixa'));
            return set(novaVendaRef, {
                clientName: nome,
                salesDate: hoje,
                salesDueDate: hoje,
                status: 'PAGO',
                items: [{ productKey: '', productName: 'Crédito Adicionado (Pagamento Antecipado)', quantity: 1, sellingPrice: valor, discountType: '$', discountValue: 0, totalItemNet: valor }],
                totalValue: valor,
                totalProfit: 0,
                quantity: 1,
                valorPago: valor,
                creditoUsado: 0,
                creditoGerado: 0,
                origemCredito: true,
                contaPagamentoKey: contaKey,
                contaPagamentoNome: contaNome,
                movimentacaoCaixaKey: movRefCaixa.key,
                timestamp: Date.now()
            }).then(() => {
                const saldoAtual = parseFloat(allLoadedContas[contaKey].saldo || 0);
                const novoSaldo = parseFloat((saldoAtual + valor).toFixed(2));
                return Promise.all([
                    set(movRefCaixa, {
                        contaKey, contaNome, tipo: 'entrada',
                        valor: valor, descricao: `Crédito adicionado de ${nome}`,
                        data: hoje, timestamp: Date.now()
                    }),
                    update(ref(db, `contas/${contaKey}`), { saldo: novoSaldo })
                ]);
            });
        };

        const finalizar = () => {
            registrarMovimentacaoDeCredito().then(() => {
                document.getElementById('modal-adicionar-credito').style.display = 'none';
                document.getElementById('form-adicionar-credito').reset();
                showAlert(`Crédito de R$ ${formatMoeda(valor)} adicionado para ${nome} e somado ao Faturamento Total e à conta "${contaNome}".`, 'success');
            });
        };

        // O saldo de crédito do cliente é sempre derivado do histórico (calcularCreditoCliente), então
        // aqui só é preciso garantir que o cliente exista cadastrado - sem escrever o campo credito.
        if (clienteKeyExistente) {
            finalizar();
        } else {
            const novoClienteRef = push(ref(db, 'clientes'));
            set(novoClienteRef, { name: nome }).then(finalizar);
        }
    });

    // ORDENAÇÃO DA TABELA DE CLIENTES AO CLICAR NO CABEÇALHO DAS COLUNAS
    document.querySelectorAll('#clientes-tab th.th-sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sortKey;
            if (clientesSort.key === key) {
                clientesSort.dir = clientesSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                clientesSort.key = key;
                clientesSort.dir = 'asc';
            }
            document.querySelectorAll('#clientes-tab th.th-sortable').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(clientesSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
            renderClientesTable();
        });
    });

    // ORDENAÇÃO DAS DEMAIS TABELAS DO SITE: ver dentro de initDatabaseSync(), pois as funções de
    // renderização usadas como callback são locais a essa função (ver comentário lá).

    document.getElementById('btn-periodo-7d').addEventListener('click', () => setChartPeriodPreset(7));
    document.getElementById('btn-periodo-30d').addEventListener('click', () => setChartPeriodPreset(30));
    document.getElementById('btn-periodo-todos').addEventListener('click', () => setChartPeriodPreset(null));
    document.getElementById('btn-periodo-custom').addEventListener('click', () => { highlightPeriodPreset(-1); renderSalesChart(); });

    document.getElementById('btn-chart-linha').addEventListener('click', () => {
        chartType = 'linha';
        document.getElementById('btn-chart-linha').classList.add('active');
        document.getElementById('btn-chart-barra').classList.remove('active');
        renderSalesChart();
    });
    document.getElementById('btn-chart-barra').addEventListener('click', () => {
        chartType = 'barra';
        document.getElementById('btn-chart-barra').classList.add('active');
        document.getElementById('btn-chart-linha').classList.remove('active');
        renderSalesChart();
    });

    // Alterna entre ver o gráfico dia a dia ou agrupado mês a mês (para comparar se um mês vendeu mais que outro)
    document.getElementById('btn-agrupamento-dia').addEventListener('click', () => {
        chartAgrupamento = 'dia';
        document.getElementById('btn-agrupamento-dia').classList.add('active');
        document.getElementById('btn-agrupamento-mes').classList.remove('active');
        setChartPeriodPreset(30);
    });
    document.getElementById('btn-agrupamento-mes').addEventListener('click', () => {
        chartAgrupamento = 'mes';
        document.getElementById('btn-agrupamento-mes').classList.add('active');
        document.getElementById('btn-agrupamento-dia').classList.remove('active');
        // No modo mensal faz mais sentido comparar todo o histórico, então já muda o período para "Tudo"
        setChartPeriodPreset(null);
    });

    setChartPeriodPreset(30);

    document.getElementById('tab-link-producao').addEventListener('click', (e) => switchTab('producao-tab', e.currentTarget));
    document.getElementById('tab-link-sabores').addEventListener('click', (e) => switchTab('sabores', e.currentTarget));
    document.getElementById('tab-link-suprimentos').addEventListener('click', (e) => switchTab('suprimentos', e.currentTarget));
    document.getElementById('tab-link-vendas').addEventListener('click', (e) => switchTab('vendas', e.currentTarget));
    document.getElementById('tab-link-clientes').addEventListener('click', (e) => switchTab('clientes-tab', e.currentTarget));
    document.getElementById('tab-link-caixa').addEventListener('click', (e) => switchTab('caixa-tab', e.currentTarget));
    document.getElementById('tab-link-compras').addEventListener('click', (e) => switchTab('compras-tab', e.currentTarget));
    document.getElementById('tab-link-fornecedores').addEventListener('click', (e) => switchTab('fornecedores-tab', e.currentTarget));
    document.getElementById('tab-link-analise').addEventListener('click', (e) => switchTab('analise-tab', e.currentTarget));
    document.getElementById('tab-link-qrcodes').addEventListener('click', (e) => switchTab('qrcodes-tab', e.currentTarget));
    document.getElementById('tab-link-precoslocal').addEventListener('click', (e) => switchTab('precoslocal-tab', e.currentTarget));
    document.getElementById('tab-link-orcamentos').addEventListener('click', (e) => switchTab('orcamentos-tab', e.currentTarget));

    // Ao carregar/atualizar a página, reabre a aba que estava salva na URL (#slug) - simula um clique
    // de verdade no botão da aba pra disparar também qualquer render/carregamento extra que o clique
    // daquela aba específica faça (não só o switchTab). Se não houver hash reconhecido, mantém a aba
    // padrão que já vem marcada como ativa no HTML (Aba 1 - Ordens de Produção).
    (function restaurarAbaDaUrlAoCarregar() {
        const slug = (window.location.hash || '').replace('#', '');
        const info = ABA_SLUG_PARA_TAB[slug];
        if (!info) return;
        const btn = document.getElementById(info.btnId);
        if (btn) btn.click();
    })();

    // ===== ABA 6 - CAIXA (CONTAS E MOVIMENTAÇÕES) =====
    onValue(ref(db, 'contas'), (snapshot) => {
        allLoadedContas = snapshot.val() || {};
        renderContasTable();
        popularFiltroContaMovimentacoes();
        popularSelectContaEditarMovimentacao();
        popularSelectContaCredito();
        atualizarResumoCaixa();
    });

    // Preenche o select de conta do modal de Créditos do Cliente (Aba 5), preservando a conta
    // já selecionada quando possível (ex: quando allLoadedContas é atualizado em tempo real).
    function popularSelectContaCredito() {
        const select = document.getElementById('adicionar-credito-conta');
        if (!select) return;
        const valorAtual = select.value;
        select.innerHTML = '<option value="">Selecione a conta...</option>';
        Object.keys(allLoadedContas).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key; opt.innerText = allLoadedContas[key].name;
            select.appendChild(opt);
        });
        if (valorAtual && allLoadedContas[valorAtual]) select.value = valorAtual;
    }

    sincronizarColecaoIncremental('movimentacoesCaixa', allLoadedMovimentacoesCaixa, () => {
        renderMovimentacoesTable();
        atualizarResumoCaixa();
    });

    function atualizarResumoCaixa() {
        const contas = Object.values(allLoadedContas);
        const saldoTotal = contas.reduce((acc, c) => acc + parseFloat(c.saldo || 0), 0);
        document.getElementById('caixa-saldo-total').innerText = `R$ ${formatMoeda(saldoTotal)}`;
        document.getElementById('caixa-total-contas').innerText = contas.length;

        // CORREÇÃO: antes usava uma janela rolante de "últimos 30 dias corridos". Agora usa sempre o
        // mês calendário atual (do dia 1 até hoje) — quando o mês vira, reinicia automaticamente do zero.
        const hojeCaixa = new Date();
        const limiteStr = `${hojeCaixa.getFullYear()}-${String(hojeCaixa.getMonth() + 1).padStart(2, '0')}-01`;
        let entradas = 0, saidas = 0;
        Object.values(allLoadedMovimentacoesCaixa).forEach(m => {
            if (!m.data || m.data < limiteStr) return;
            // Transferências entre contas (registro único "transferencia" ou, em dados antigos, o par
            // entrada/saída marcado com transferenciaId) não entram nesta soma: elas não são dinheiro
            // entrando ou saindo da empresa, só mudam de conta - contá-las aqui inflaria os dois totais.
            if (m.tipo === 'transferencia' || m.transferenciaId) return;
            // Ajustes manuais de saldo (correção de conta) também não entram: não representam
            // dinheiro real entrando/saindo, só uma correção do valor registrado no sistema.
            if (m.ajuste) return;
            if (m.tipo === 'entrada') entradas += (m.valor || 0);
            else saidas += (m.valor || 0);
        });
        document.getElementById('caixa-entradas-30d').innerText = `R$ ${formatMoeda(entradas)}`;
        document.getElementById('caixa-saidas-30d').innerText = `R$ ${formatMoeda(saidas)}`;
    }

    function renderContasTable() {
        const tbody = document.getElementById('contas-table-body');
        tbody.innerHTML = '';
        let lista = Object.keys(allLoadedContas).map(key => ({
            key, nome: allLoadedContas[key].name, tipo: allLoadedContas[key].tipo || 'Outro', saldo: parseFloat(allLoadedContas[key].saldo || 0)
        }));

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.</td></tr>';
            return;
        }

        lista = ordenarPorEstado(lista, 'contas-table');
        lista.forEach(c => {
            const conta = allLoadedContas[c.key] || {};
            const badgePix = conta.pixAtivo
                ? ` <span class="badge-status status-pago" title="Chave: ${conta.pixChave || ''}">🔑 Pix</span>`
                : '';
            const badgeEspecie = conta.especieAtivo
                ? ` <span class="badge-status status-transferencia">Em Espécie</span>`
                : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.nome}</strong>${badgePix}${badgeEspecie}</td>
                <td>${c.tipo}</td>
                <td style="font-weight:700; color:${c.saldo >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'};">R$ ${formatMoeda(c.saldo)}</td>
                <td>
                    <button class="btn-action-prod btn-edit-prod" onclick="abrirModalMovimentar('${c.key}')">💸 Movimentar</button>
                    <button class="btn-action-prod btn-edit-prod" onclick="abrirModalEditarConta('${c.key}')">✏️ Editar</button>
                    <button class="btn-action-prod btn-delete-prod" onclick="excluirConta('${c.key}')">✕ Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function popularFiltroContaMovimentacoes() {
        const select = document.getElementById('caixa-filtro-conta');
        const valorAtual = select.value;
        select.innerHTML = '<option value="">Todas as Contas</option>';
        Object.keys(allLoadedContas).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key; opt.innerText = allLoadedContas[key].name;
            select.appendChild(opt);
        });
        select.value = valorAtual;
    }

    function renderMovimentacoesTable() {
        const tbody = document.getElementById('movimentacoes-table-body');
        tbody.innerHTML = '';
        const filtroConta = document.getElementById('caixa-filtro-conta').value;
        const filtroTipo = document.getElementById('caixa-filtro-tipo').value;

        let lista = Object.entries(allLoadedMovimentacoesCaixa)
            .filter(([, m]) => !filtroConta || m.contaKey === filtroConta || m.contaOrigemKey === filtroConta || m.contaDestinoKey === filtroConta)
            .filter(([, m]) => {
                if (!filtroTipo) return true;
                if (filtroTipo === 'ajuste') return !!m.ajuste;
                if (filtroTipo === 'transferencia') return m.tipo === 'transferencia' || !!m.transferenciaId;
                return m.tipo === filtroTipo && !m.ajuste;
            })
            .map(([key, m]) => ({
                key,
                data: m.data,
                contaNome: m.tipo === 'transferencia' ? `${m.contaOrigemNome} ➜ ${m.contaDestinoNome}` : m.contaNome,
                tipo: m.tipo,
                ajuste: !!m.ajuste,
                descricao: m.descricao || '',
                valor: parseFloat(m.valor || 0),
                timestamp: m.timestamp || 0
            }));

        const state = getSortState('movimentacoes-table');
        lista = state.key ? ordenarPorEstado(lista, 'movimentacoes-table') : lista.sort((a, b) => b.timestamp - a.timestamp);

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma movimentação registrada.</td></tr>';
            return;
        }

        lista.forEach(m => {
            const dataFormatada = m.data ? m.data.split('-').reverse().join('/') : '---';
            const isEntrada = m.tipo === 'entrada';
            const isTransferencia = m.tipo === 'transferencia';
            const isTransferenciaLegado = !isTransferencia && !!allLoadedMovimentacoesCaixa[m.key]?.transferenciaId;
            let rotuloTipo, corValor, classeBadge;
            if (isTransferencia) {
                rotuloTipo = '🔄 Transferência';
                corValor = 'var(--text-strong)';
                classeBadge = 'status-transferencia';
            } else if (m.ajuste) {
                rotuloTipo = '🛠️ Ajuste de Saldo';
                corValor = isEntrada ? 'var(--color-positive)' : 'var(--color-negative)';
                classeBadge = 'status-transferencia';
            } else if (isTransferenciaLegado) {
                rotuloTipo = isEntrada ? '🔄 Transf. (entrada)' : '🔄 Transf. (saída)';
                corValor = isEntrada ? 'var(--color-positive)' : 'var(--color-negative)';
                classeBadge = isEntrada ? 'status-pago' : 'status-cancelado';
            } else {
                rotuloTipo = isEntrada ? '➕ Entrada' : '➖ Saída';
                corValor = isEntrada ? 'var(--color-positive)' : 'var(--color-negative)';
                classeBadge = isEntrada ? 'status-pago' : 'status-cancelado';
            }
            const tr = document.createElement('tr');
            const editavel = !allLoadedMovimentacoesCaixa[m.key]?.compraKey && !isTransferencia && !isTransferenciaLegado;
            const acaoEditar = editavel
                ? `<button class="btn-action-prod btn-edit-prod" onclick="abrirModalEditarMovimentacao('${m.key}')">✏️ Editar</button>`
                : '';
            const acaoExcluir = m.compraKey
                ? `<span title="Esta movimentação foi gerada por uma Compra de Suprimentos. Exclua a compra na Aba 7 para removê-la." style="font-size:8.5pt; color:var(--text-faint); cursor:not-allowed;">🔒 Via Compra</span>`
                : `<button class="btn-action-prod btn-delete-prod" onclick="excluirMovimentacao('${m.key}')">🗑️ Excluir</button>`;
            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${m.contaNome}</td>
                <td><span class="badge-status ${classeBadge}" ${isTransferencia ? 'style="background:#dbeafe; color:#1d4ed8;"' : ''}>${rotuloTipo}</span></td>
                <td>${m.descricao || '-'}</td>
                <td style="font-weight:600; color:${corValor};">R$ ${formatMoeda(m.valor)}</td>
                <td>${acaoEditar} ${acaoExcluir}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    document.getElementById('caixa-filtro-conta').addEventListener('change', renderMovimentacoesTable);
    document.getElementById('caixa-filtro-tipo').addEventListener('change', renderMovimentacoesTable);
    bindSortableHeaders('contas-table', 'contas-table', renderContasTable);
    bindSortableHeaders('movimentacoes-table', 'movimentacoes-table', renderMovimentacoesTable);

    // ----- MODAL NOVA/EDITAR CONTA -----
    setupModalEvents('btn-trigger-modal-nova-conta', 'modal-conta', 'close-modal-conta');
    let editandoContaKey = null;

    // Só é permitida 1 conta com cada flag (Pix / Em Espécie) por vez, já que o Autoatendimento
    // usa essas flags pra decidir qual conta real recebe cada uma dessas 2 formas de pagamento.
    function encontrarOutraContaComFlag(flag, excludeKey) {
        return Object.keys(allLoadedContas).find(k => k !== excludeKey && allLoadedContas[k][flag]);
    }

    document.getElementById('btn-trigger-modal-nova-conta').addEventListener('click', () => {
        editandoContaKey = null;
        document.getElementById('modal-conta-titulo').innerText = '🏦 Nova Conta';
        document.getElementById('form-conta').reset();
        document.getElementById('conta-saldo').value = '0';
        document.getElementById('conta-saldo-hint').innerText = 'Saldo inicial da conta ao criá-la.';
        document.getElementById('conta-pix-ativo').checked = false;
        document.getElementById('conta-pix-campos').style.display = 'none';
        document.getElementById('conta-especie-ativo').checked = false;
    });

    document.getElementById('conta-pix-ativo').addEventListener('change', (e) => {
        document.getElementById('conta-pix-campos').style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) return;
        const outraKey = encontrarOutraContaComFlag('pixAtivo', editandoContaKey);
        if (outraKey) {
            const outraNome = allLoadedContas[outraKey].name;
            showConfirm(`A conta "${outraNome}" já está marcada para receber Pix. Só é permitida 1 conta com Pix ativo por vez.\n\nDeseja desativar o Pix em "${outraNome}" e ativar nesta conta?`, 'warning', 'Trocar conta do Pix').then(ok => {
                if (!ok) {
                    e.target.checked = false;
                    document.getElementById('conta-pix-campos').style.display = 'none';
                }
            });
        }
    });

    document.getElementById('conta-especie-ativo').addEventListener('change', (e) => {
        if (!e.target.checked) return;
        const outraKey = encontrarOutraContaComFlag('especieAtivo', editandoContaKey);
        if (outraKey) {
            const outraNome = allLoadedContas[outraKey].name;
            showConfirm(`A conta "${outraNome}" já está marcada como "Em Espécie". Só é permitida 1 conta com essa marcação por vez.\n\nDeseja desativar em "${outraNome}" e ativar nesta conta?`, 'warning', 'Trocar conta "Em Espécie"').then(ok => {
                if (!ok) e.target.checked = false;
            });
        }
    });

    function abrirModalEditarConta(key) {
        const conta = allLoadedContas[key];
        if (!conta) return;
        editandoContaKey = key;
        document.getElementById('modal-conta-titulo').innerText = '✏️ Editar Conta';
        document.getElementById('conta-nome').value = conta.name;
        document.getElementById('conta-tipo').value = conta.tipo || 'Outro';
        document.getElementById('conta-saldo').value = parseFloat(conta.saldo || 0).toFixed(2);
        document.getElementById('conta-saldo-hint').innerText = 'Alterar este valor corrige o saldo diretamente e registra um ajuste no histórico de movimentações.';
        document.getElementById('conta-pix-ativo').checked = !!conta.pixAtivo;
        document.getElementById('conta-pix-campos').style.display = conta.pixAtivo ? 'block' : 'none';
        document.getElementById('conta-pix-chave').value = conta.pixChave || '';
        document.getElementById('conta-especie-ativo').checked = !!conta.especieAtivo;
        document.getElementById('modal-conta').style.display = 'flex';
    }
    window.abrirModalEditarConta = abrirModalEditarConta;

    document.getElementById('form-conta').addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = document.getElementById('conta-nome').value.trim();
        const tipo = document.getElementById('conta-tipo').value;
        const saldo = parseFloat(document.getElementById('conta-saldo').value);
        const pixAtivo = document.getElementById('conta-pix-ativo').checked;
        const pixChave = document.getElementById('conta-pix-chave').value.trim();
        const especieAtivo = document.getElementById('conta-especie-ativo').checked;

        if (!nome) { showAlert('Informe o nome da conta.', 'warning'); return; }
        if (isNaN(saldo)) { showAlert('Informe um saldo válido.', 'warning'); return; }
        if (pixAtivo && !pixChave) {
            showAlert('Para ativar o recebimento por Pix, informe a Chave Pix.', 'warning');
            return;
        }

        const dadosConta = {
            name: nome, tipo, saldo: parseFloat(saldo.toFixed(2)),
            pixAtivo, pixChave: pixAtivo ? pixChave : '', especieAtivo
        };

        const promessasExtras = [];
        if (pixAtivo) {
            const outraKey = encontrarOutraContaComFlag('pixAtivo', editandoContaKey);
            if (outraKey) promessasExtras.push(update(ref(db, `contas/${outraKey}`), { pixAtivo: false }));
        }
        if (especieAtivo) {
            const outraKey = encontrarOutraContaComFlag('especieAtivo', editandoContaKey);
            if (outraKey) promessasExtras.push(update(ref(db, `contas/${outraKey}`), { especieAtivo: false }));
        }

        const fechar = () => {
            document.getElementById('modal-conta').style.display = 'none';
            document.getElementById('form-conta').reset();
            document.getElementById('conta-pix-campos').style.display = 'none';
        };

        if (editandoContaKey) {
            const contaAtual = allLoadedContas[editandoContaKey];
            const saldoAnterior = parseFloat(contaAtual.saldo || 0);
            const delta = parseFloat((saldo - saldoAnterior).toFixed(2));

            const promessas = [update(ref(db, `contas/${editandoContaKey}`), dadosConta), ...promessasExtras];

            // Toda alteração de saldo feita por aqui vira um "Ajuste manual" no histórico, para nunca perder rastro do dinheiro
            if (Math.abs(delta) > 0.001) {
                const hoje = formatDateInputValue(new Date());
                const movRef = push(ref(db, 'movimentacoesCaixa'));
                promessas.push(set(movRef, {
                    contaKey: editandoContaKey, contaNome: nome,
                    tipo: delta > 0 ? 'entrada' : 'saida',
                    ajuste: true,
                    valor: Math.abs(delta),
                    descricao: 'Ajuste manual de saldo',
                    data: hoje, timestamp: Date.now()
                }));
            }

            Promise.all(promessas).then(() => { fechar(); showAlert('Conta atualizada com sucesso!', 'success'); });
        } else {
            const novaContaRef = push(ref(db, 'contas'));
            Promise.all([set(novaContaRef, { ...dadosConta, timestamp: Date.now() }), ...promessasExtras]).then(() => {
                fechar();
                showAlert('Conta criada com sucesso!', 'success');
            });
        }
    });

    function excluirConta(key) {
        const conta = allLoadedContas[key];
        if (!conta) return;
        showConfirm(`Deseja excluir a conta "${conta.name}"?\n\nO histórico de movimentações já registrado permanecerá salvo, mas deixará de aparecer no filtro por conta.`, 'warning', 'Excluir Conta').then(ok => {
            if (!ok) return;
            remove(ref(db, `contas/${key}`)).then(() => showAlert('Conta excluída.', 'success'));
        });
    }
    window.excluirConta = excluirConta;

    // ----- MODAL MOVIMENTAR CONTA (ENTRADA/SAÍDA) -----
    setupModalEvents(null, 'modal-movimentar-conta', 'close-modal-movimentar-conta');
    let movimentandoContaKey = null;
    let tipoMovimentacao = 'entrada';

    function abrirModalMovimentar(key) {
        const conta = allLoadedContas[key];
        if (!conta) return;
        movimentandoContaKey = key;
        tipoMovimentacao = 'entrada';
        document.getElementById('form-movimentar-conta').reset();
        document.getElementById('movimentar-conta-nome').value = conta.name;
        document.querySelectorAll('#movimentacao-tipo-selector .credito-tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.tipo === 'entrada'));
        document.getElementById('modal-movimentar-conta').style.display = 'flex';
    }
    window.abrirModalMovimentar = abrirModalMovimentar;

    document.querySelectorAll('#movimentacao-tipo-selector .credito-tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            tipoMovimentacao = btn.dataset.tipo;
            document.querySelectorAll('#movimentacao-tipo-selector .credito-tipo-btn').forEach(b => b.classList.toggle('active', b === btn));
        });
    });

    document.getElementById('form-movimentar-conta').addEventListener('submit', (e) => {
        e.preventDefault();
        const conta = allLoadedContas[movimentandoContaKey];
        if (!conta) return;
        const valor = parseFloat(document.getElementById('movimentar-valor').value);
        const descricao = document.getElementById('movimentar-descricao').value.trim();

        if (isNaN(valor) || valor <= 0) { showAlert('Informe um valor válido.', 'warning'); return; }

        const saldoAtual = parseFloat(conta.saldo || 0);
        const novoSaldo = parseFloat((tipoMovimentacao === 'entrada' ? saldoAtual + valor : saldoAtual - valor).toFixed(2));
        const hoje = formatDateInputValue(new Date());
        const movRef = push(ref(db, 'movimentacoesCaixa'));

        Promise.all([
            update(ref(db, `contas/${movimentandoContaKey}`), { saldo: novoSaldo }),
            set(movRef, { contaKey: movimentandoContaKey, contaNome: conta.name, tipo: tipoMovimentacao, valor, descricao, data: hoje, timestamp: Date.now() })
        ]).then(() => {
            document.getElementById('modal-movimentar-conta').style.display = 'none';
            document.getElementById('form-movimentar-conta').reset();
            showAlert('Movimentação registrada com sucesso!', 'success');
        });
    });

    // Desfaz o efeito de UMA movimentação individual no saldo da conta correspondente (usado tanto para
    // exclusões avulsas quanto para desfazer os dois lados de uma transferência entre contas).
    function reverterEfeitoMovimentacao(mov, promessas) {
        const conta = allLoadedContas[mov.contaKey];
        if (conta) {
            const saldoAtual = parseFloat(conta.saldo || 0);
            const novoSaldo = parseFloat((mov.tipo === 'entrada' ? saldoAtual - mov.valor : saldoAtual + mov.valor).toFixed(2));
            promessas.push(update(ref(db, `contas/${mov.contaKey}`), { saldo: novoSaldo }));
        }
    }

    function excluirMovimentacao(key) {
        const mov = allLoadedMovimentacoesCaixa[key];
        if (!mov) return;

        // Movimentação gerada automaticamente por uma Compra de Suprimentos (Aba 7): não pode ser
        // excluída diretamente por aqui, senão o saldo da conta seria desfeito sem reverter o estoque
        // que a compra deu entrada. A exclusão só pode acontecer pela própria compra.
        if (mov.compraKey) {
            showAlert('Esta movimentação foi gerada por uma Compra de Suprimentos e não pode ser excluída por aqui.\n\nPara removê-la, exclua a compra correspondente na Aba 7 - Compras. Isso já reverte automaticamente o saldo da conta e o estoque dos insumos.', 'warning');
            return;
        }

        // Transferência entre contas registrada como UM ÚNICO lançamento (modelo atual): reverte as
        // duas contas (origem e destino) direto a partir deste mesmo registro, sem precisar de um "par".
        if (mov.tipo === 'transferencia') {
            showConfirm(`Deseja excluir esta transferência (${mov.contaOrigemNome} ➜ ${mov.contaDestinoNome}, R$ ${formatMoeda(parseFloat(mov.valor || 0))})?\n\nOs saldos das duas contas envolvidas serão ajustados automaticamente para desfazer o efeito dela.`, 'warning', 'Excluir Transferência').then(ok => {
                if (!ok) return;
                const promessas = [remove(ref(db, `movimentacoesCaixa/${key}`))];
                const contaOrigem = allLoadedContas[mov.contaOrigemKey];
                const contaDestino = allLoadedContas[mov.contaDestinoKey];
                if (contaOrigem) promessas.push(update(ref(db, `contas/${mov.contaOrigemKey}`), { saldo: parseFloat((parseFloat(contaOrigem.saldo || 0) + parseFloat(mov.valor || 0)).toFixed(2)) }));
                if (contaDestino) promessas.push(update(ref(db, `contas/${mov.contaDestinoKey}`), { saldo: parseFloat((parseFloat(contaDestino.saldo || 0) - parseFloat(mov.valor || 0)).toFixed(2)) }));
                Promise.all(promessas).then(() => showAlert('Transferência excluída e saldos das duas contas ajustados.', 'success'));
            });
            return;
        }

        // Compatibilidade com transferências antigas, registradas como um PAR de lançamentos (entrada/saída)
        // ligados por um mesmo transferenciaId. Ela tem uma "irmã" do outro lado. Para nunca deixar o
        // extrato com uma perna solta, as duas são sempre excluídas e revertidas juntas.
        if (mov.transferenciaId) {
            const parKey = Object.keys(allLoadedMovimentacoesCaixa).find(k => k !== key && allLoadedMovimentacoesCaixa[k].transferenciaId === mov.transferenciaId);
            const parMov = parKey ? allLoadedMovimentacoesCaixa[parKey] : null;
            const origem = mov.tipo === 'saida' ? mov : parMov;
            const destino = mov.tipo === 'entrada' ? mov : parMov;
            const nomeOrigem = origem ? origem.contaNome : '?';
            const nomeDestino = destino ? destino.contaNome : '?';

            showConfirm(`Esta movimentação faz parte de uma Transferência entre Contas (${nomeOrigem} ➜ ${nomeDestino}, R$ ${formatMoeda(parseFloat(mov.valor || 0))}).\n\nExcluir irá desfazer a transferência inteira, ajustando o saldo das duas contas envolvidas.`, 'warning', 'Excluir Transferência').then(ok => {
                if (!ok) return;
                const promessas = [remove(ref(db, `movimentacoesCaixa/${key}`))];
                reverterEfeitoMovimentacao(mov, promessas);
                if (parKey && parMov) {
                    promessas.push(remove(ref(db, `movimentacoesCaixa/${parKey}`)));
                    reverterEfeitoMovimentacao(parMov, promessas);
                }
                Promise.all(promessas).then(() => showAlert('Transferência excluída e saldos das duas contas ajustados.', 'success'));
            });
            return;
        }

        showConfirm(`Deseja excluir esta movimentação (${mov.tipo === 'entrada' ? 'Entrada' : 'Saída'} de R$ ${formatMoeda(parseFloat(mov.valor || 0))})?\n\nO saldo da conta "${mov.contaNome}" será ajustado automaticamente para desfazer o efeito dela.`, 'warning', 'Excluir Movimentação').then(ok => {
            if (!ok) return;

            const promessas = [remove(ref(db, `movimentacoesCaixa/${key}`))];
            reverterEfeitoMovimentacao(mov, promessas);
            Promise.all(promessas).then(() => showAlert('Movimentação excluída e saldo ajustado.', 'success'));
        });
    }
    window.excluirMovimentacao = excluirMovimentacao;

    // ----- MODAL EDITAR MOVIMENTAÇÃO (valor, data, conta, tipo e descrição de um lançamento avulso) -----
    setupModalEvents(null, 'modal-editar-movimentacao', 'close-modal-editar-movimentacao');
    let editandoMovimentacaoKey = null;
    let tipoEditandoMovimentacao = 'entrada';

    function popularSelectContaEditarMovimentacao() {
        const select = document.getElementById('editar-mov-conta');
        const valorAtual = select.value;
        select.innerHTML = '';
        Object.keys(allLoadedContas).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key; opt.innerText = allLoadedContas[key].name;
            select.appendChild(opt);
        });
        if (valorAtual) select.value = valorAtual;
    }

    function abrirModalEditarMovimentacao(key) {
        const mov = allLoadedMovimentacoesCaixa[key];
        if (!mov) return;
        if (mov.compraKey) {
            showAlert('Esta movimentação foi gerada por uma Compra de Suprimentos e não pode ser editada por aqui.\n\nPara ajustá-la, edite a compra correspondente na Aba 7 - Compras.', 'warning');
            return;
        }
        if (mov.tipo === 'transferencia' || mov.transferenciaId) {
            showAlert('Transferências entre contas não podem ser editadas. Se precisar corrigir, exclua a transferência e registre uma nova.', 'warning');
            return;
        }
        editandoMovimentacaoKey = key;
        tipoEditandoMovimentacao = mov.tipo === 'saida' ? 'saida' : 'entrada';
        popularSelectContaEditarMovimentacao();
        document.getElementById('editar-mov-conta').value = mov.contaKey;
        document.querySelectorAll('#editar-mov-tipo-selector .credito-tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.tipo === tipoEditandoMovimentacao));
        document.getElementById('editar-mov-valor').value = parseFloat(mov.valor || 0);
        document.getElementById('editar-mov-data').value = dataISOparaBR(mov.data || formatDateInputValue(new Date()));
        document.getElementById('editar-mov-descricao').value = mov.descricao || '';
        document.getElementById('modal-editar-movimentacao').style.display = 'flex';
    }
    window.abrirModalEditarMovimentacao = abrirModalEditarMovimentacao;

    document.querySelectorAll('#editar-mov-tipo-selector .credito-tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            tipoEditandoMovimentacao = btn.dataset.tipo;
            document.querySelectorAll('#editar-mov-tipo-selector .credito-tipo-btn').forEach(b => b.classList.toggle('active', b === btn));
        });
    });

    document.getElementById('form-editar-movimentacao').addEventListener('submit', (e) => {
        e.preventDefault();
        const mov = allLoadedMovimentacoesCaixa[editandoMovimentacaoKey];
        if (!mov) return;

        const novaContaKey = document.getElementById('editar-mov-conta').value;
        const novoValor = parseFloat(document.getElementById('editar-mov-valor').value);
        const novaData = dataBRparaISO(document.getElementById('editar-mov-data').value);
        const novaDescricao = document.getElementById('editar-mov-descricao').value.trim();
        const novoTipo = tipoEditandoMovimentacao;

        if (!novaContaKey || isNaN(novoValor) || novoValor <= 0 || !novaData) { showAlert('Preencha conta, valor e data corretamente.', 'warning'); return; }

        const promessas = [];

        // 1) Desfaz o efeito ANTIGO desta movimentação no saldo da conta ANTIGA
        const contaAntiga = allLoadedContas[mov.contaKey];
        let saldoContaAntigaRevertido = contaAntiga ? parseFloat(contaAntiga.saldo || 0) : 0;
        if (contaAntiga) {
            saldoContaAntigaRevertido = parseFloat((mov.tipo === 'entrada' ? saldoContaAntigaRevertido - parseFloat(mov.valor || 0) : saldoContaAntigaRevertido + parseFloat(mov.valor || 0)).toFixed(2));
        }

        // 2) Aplica o efeito NOVO na conta NOVA (que pode ser a mesma conta ou uma diferente)
        if (novaContaKey === mov.contaKey) {
            // Mesma conta: parte do saldo já revertido acima, e aplica o novo valor em cima dele
            const saldoFinal = parseFloat((novoTipo === 'entrada' ? saldoContaAntigaRevertido + novoValor : saldoContaAntigaRevertido - novoValor).toFixed(2));
            promessas.push(update(ref(db, `contas/${novaContaKey}`), { saldo: saldoFinal }));
        } else {
            // Conta diferente: grava o saldo revertido na conta antiga, e aplica o novo lançamento na conta nova
            if (contaAntiga) promessas.push(update(ref(db, `contas/${mov.contaKey}`), { saldo: saldoContaAntigaRevertido }));
            const contaNova = allLoadedContas[novaContaKey];
            const saldoContaNova = contaNova ? parseFloat(contaNova.saldo || 0) : 0;
            const saldoContaNovaFinal = parseFloat((novoTipo === 'entrada' ? saldoContaNova + novoValor : saldoContaNova - novoValor).toFixed(2));
            promessas.push(update(ref(db, `contas/${novaContaKey}`), { saldo: saldoContaNovaFinal }));
        }

        // 3) Atualiza o registro da movimentação em si
        const contaNovaObj = allLoadedContas[novaContaKey];
        promessas.push(update(ref(db, `movimentacoesCaixa/${editandoMovimentacaoKey}`), {
            contaKey: novaContaKey,
            contaNome: contaNovaObj ? contaNovaObj.name : mov.contaNome,
            tipo: novoTipo,
            valor: novoValor,
            data: novaData,
            descricao: novaDescricao
        }));

        Promise.all(promessas).then(() => {
            document.getElementById('modal-editar-movimentacao').style.display = 'none';
            showAlert('Movimentação atualizada e saldo(s) recalculado(s) com sucesso!', 'success');
        });
    });

    // ----- MODAL TRANSFERÊNCIA ENTRE CONTAS -----
    setupModalEvents(null, 'modal-transferencia', 'close-modal-transferencia');

    document.getElementById('btn-trigger-modal-transferencia').addEventListener('click', () => {
        if (Object.keys(allLoadedContas).length < 2) {
            showAlert('Você precisa de pelo menos 2 contas cadastradas para transferir valores entre elas.', 'warning');
            return;
        }
        document.getElementById('form-transferencia').reset();
        popularSelectsTransferencia();
        atualizarHintsSaldoTransferencia();
        document.getElementById('modal-transferencia').style.display = 'flex';
    });

    function popularSelectsTransferencia() {
        const origem = document.getElementById('transferencia-origem');
        const destino = document.getElementById('transferencia-destino');
        origem.innerHTML = '';
        destino.innerHTML = '';
        Object.keys(allLoadedContas).forEach(key => {
            const nome = allLoadedContas[key].name;
            origem.appendChild(new Option(nome, key));
            destino.appendChild(new Option(nome, key));
        });
        // Por padrão, sugere duas contas diferentes (origem = primeira, destino = segunda)
        if (destino.options.length > 1) destino.selectedIndex = 1;
    }

    function atualizarHintsSaldoTransferencia() {
        const origemKey = document.getElementById('transferencia-origem').value;
        const destinoKey = document.getElementById('transferencia-destino').value;
        const contaOrigem = allLoadedContas[origemKey];
        const contaDestino = allLoadedContas[destinoKey];
        document.getElementById('transferencia-origem-saldo').innerText = contaOrigem ? `Saldo atual: R$ ${formatMoeda(parseFloat(contaOrigem.saldo || 0))}` : '';
        document.getElementById('transferencia-destino-saldo').innerText = contaDestino ? `Saldo atual: R$ ${formatMoeda(parseFloat(contaDestino.saldo || 0))}` : '';
    }
    document.getElementById('transferencia-origem').addEventListener('change', atualizarHintsSaldoTransferencia);
    document.getElementById('transferencia-destino').addEventListener('change', atualizarHintsSaldoTransferencia);

    document.getElementById('form-transferencia').addEventListener('submit', (e) => {
        e.preventDefault();
        const origemKey = document.getElementById('transferencia-origem').value;
        const destinoKey = document.getElementById('transferencia-destino').value;
        const valor = parseFloat(document.getElementById('transferencia-valor').value);
        const descricaoInformada = document.getElementById('transferencia-descricao').value.trim();

        if (!origemKey || !destinoKey) { showAlert('Selecione a conta de origem e a conta de destino.', 'warning'); return; }
        if (origemKey === destinoKey) { showAlert('A conta de origem e a conta de destino precisam ser diferentes.', 'warning'); return; }
        if (isNaN(valor) || valor <= 0) { showAlert('Informe um valor válido para a transferência.', 'warning'); return; }

        const contaOrigem = allLoadedContas[origemKey];
        const contaDestino = allLoadedContas[destinoKey];
        if (!contaOrigem || !contaDestino) return;

        const executarTransferencia = () => {
            const saldoOrigemAtual = parseFloat(contaOrigem.saldo || 0);
            const saldoDestinoAtual = parseFloat(contaDestino.saldo || 0);
            const novoSaldoOrigem = parseFloat((saldoOrigemAtual - valor).toFixed(2));
            const novoSaldoDestino = parseFloat((saldoDestinoAtual + valor).toFixed(2));
            const hoje = formatDateInputValue(new Date());
            const timestamp = Date.now();

            const descricao = descricaoInformada || `Transferência de "${contaOrigem.name}" para "${contaDestino.name}"`;

            // A transferência vira UM ÚNICO lançamento no extrato (tipo "transferencia"), guardando origem
            // e destino no mesmo registro. Isso evita que ela seja contada como Entrada E Saída ao mesmo
            // tempo nos totais de "Entradas/Saídas (Mês Atual)", o que inflaria os dois artificialmente
            // mesmo o dinheiro não tendo saído da empresa - só mudado de conta.
            const movRef = push(ref(db, 'movimentacoesCaixa'));

            Promise.all([
                update(ref(db, `contas/${origemKey}`), { saldo: novoSaldoOrigem }),
                update(ref(db, `contas/${destinoKey}`), { saldo: novoSaldoDestino }),
                set(movRef, {
                    tipo: 'transferencia',
                    contaOrigemKey: origemKey, contaOrigemNome: contaOrigem.name,
                    contaDestinoKey: destinoKey, contaDestinoNome: contaDestino.name,
                    valor, descricao, data: hoje, timestamp
                })
            ]).then(() => {
                document.getElementById('modal-transferencia').style.display = 'none';
                document.getElementById('form-transferencia').reset();
                showAlert(`Transferência de R$ ${formatMoeda(valor)} de "${contaOrigem.name}" para "${contaDestino.name}" realizada com sucesso!`, 'success');
            });
        };

        const saldoOrigemAtual = parseFloat(contaOrigem.saldo || 0);
        if (valor > saldoOrigemAtual) {
            showConfirm(`A conta "${contaOrigem.name}" tem saldo atual de R$ ${formatMoeda(saldoOrigemAtual)}, menor que o valor da transferência (R$ ${formatMoeda(valor)}).\n\nO saldo dessa conta ficará negativo. Deseja continuar mesmo assim?`, 'warning', 'Saldo Insuficiente').then(ok => {
                if (ok) executarTransferencia();
            });
        } else {
            executarTransferencia();
        }
    });

    // ===== ABA 7 - COMPRAS DE SUPRIMENTOS / MATÉRIAS-PRIMAS =====
    function ativarComprasSubview(view) {
        document.querySelectorAll('.compras-subview-btn').forEach(b => b.classList.toggle('ativo', b.getAttribute('data-compras-view') === view));
        document.getElementById('compras-view-pedidos').style.display = view === 'pedidos' ? '' : 'none';
        document.getElementById('compras-view-recebimentos').style.display = view === 'recebimentos' ? '' : 'none';
        document.getElementById('compras-view-notas').style.display = view === 'notas' ? '' : 'none';
    }
    document.querySelectorAll('.compras-subview-btn').forEach(btn => {
        btn.addEventListener('click', () => ativarComprasSubview(btn.getAttribute('data-compras-view')));
    });

    sincronizarColecaoIncremental('comprasSuprimentos', allLoadedComprasSuprimentos, () => {
        renderComprasTable();
        renderRecebimentosTable();
        atualizarResumoCompras();
        renderFornecedoresTable();
        if (document.getElementById('modal-detalhe-fornecedor').style.display === 'flex') {
            atualizarStatsDetalheFornecedor();
            renderDetalheFornecedorChart();
        }
    });

    // ===== ABA 7 - PEDIDOS DE COMPRA (etapa anterior à nota fiscal - ainda não mexe em estoque nem caixa) =====
    onValue(ref(db, 'pedidosCompra'), (snapshot) => {
        allLoadedPedidosCompra = snapshot.val() || {};
        renderPedidosCompraTable();
    });

    // ===== ABA 13 - ORÇAMENTOS (projetos, compras planejadas, despesas e afins) =====
    onValue(ref(db, 'orcamentos'), (snapshot) => {
        allLoadedOrcamentos = snapshot.val() || {};
        renderOrcamentosTudo();
    });

    // ===== ABA 8 - FORNECEDORES =====
    onValue(ref(db, 'fornecedores'), (snapshot) => {
        allLoadedFornecedores = snapshot.val() || {};
        renderFornecedoresTable();
        popularDatalistFornecedoresCompra();
    });

    // Preenche a datalist do campo "Nome do Fornecedor" (modo Compra sem CNPJ) com todos os fornecedores
    // já cadastrados, para que o usuário possa escolher um já existente digitando/selecionando o nome -
    // e, se digitar um nome que não está na lista, um fornecedor novo é criado automaticamente ao salvar.
    function popularDatalistFornecedoresCompra() {
        const datalist = document.getElementById('datalist-fornecedores-compra');
        if (!datalist) return;
        const nomesOrdenados = Object.values(allLoadedFornecedores)
            .map(f => f.name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        datalist.innerHTML = nomesOrdenados.map(nome => `<option value="${nome.replace(/"/g, '&quot;')}"></option>`).join('');
    }

    // Soma todas as compras (Aba 7) vinculadas a este fornecedor: por chave (vínculo mais confiável) ou,
    // como reforço para casos antigos, pelo CNPJ normalizado registrado na compra.
    function comprasDoFornecedor(key) {
        const fornecedor = allLoadedFornecedores[key];
        if (!fornecedor) return [];
        const cnpjDigits = normalizeCnpj(fornecedor.cnpj);
        return Object.keys(allLoadedComprasSuprimentos)
            .map(k => ({ key: k, ...allLoadedComprasSuprimentos[k] }))
            .filter(c =>
                c.fornecedorKey === key || (cnpjDigits && normalizeCnpj(c.fornecedorCnpj) === cnpjDigits)
            );
    }

    // RENDERIZA TABELA DE FORNECEDORES COM O TOTAL COMPRADO (SOMA DAS COMPRAS DA ABA 7)
    function renderFornecedoresTable() {
        const tbody = document.getElementById('fornecedores-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        let fornecedores = Object.entries(allLoadedFornecedores).map(([key, forn]) => {
            const totalComprado = comprasDoFornecedor(key).reduce((acc, c) => acc + parseFloat(c.valorTotal || 0), 0);
            return { key, nome: forn.name, cnpj: forn.cnpj || '', totalComprado: parseFloat(totalComprado.toFixed(2)) };
        });

        if (fornecedores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhum fornecedor cadastrado.</td></tr>';
            return;
        }

        if (getSortState('fornecedores-table').key) {
            fornecedores = ordenarPorEstado(fornecedores, 'fornecedores-table');
        } else {
            fornecedores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        }

        fornecedores.forEach(forn => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><a href="javascript:void(0)" class="fornecedor-nome-link" data-key="${forn.key}">${forn.nome}</a></td>
                <td>${formatCnpjOuInformal(forn.cnpj)}</td>
                <td style="font-weight:700; color:#a85209;">R$ ${formatMoeda(forn.totalComprado)}</td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.fornecedor-nome-link').forEach(link => {
            link.addEventListener('click', () => abrirDetalheFornecedor(link.dataset.key));
        });
    }
    bindSortableHeaders('fornecedores-tab', 'fornecedores-table', renderFornecedoresTable);

    // ----- MODAL NOVO FORNECEDOR (BOTÃO NO TOPO DA ABA 8) -----
    setupModalEvents('btn-trigger-modal-novo-fornecedor', 'modal-novo-fornecedor', 'close-modal-novo-fornecedor');

    function atualizarModoNovoFornecedorSemCnpj() {
        const semCnpj = document.getElementById('novo-fornecedor-sem-cnpj').checked;
        const cnpjInput = document.getElementById('novo-fornecedor-cnpj');
        const cnpjLabel = document.getElementById('novo-fornecedor-cnpj-label');
        cnpjInput.required = !semCnpj;
        cnpjLabel.innerText = semCnpj ? 'CPF do Fornecedor (opcional)' : 'CNPJ do Fornecedor';
        cnpjInput.placeholder = semCnpj ? 'Ex: CPF do vendedor, se houver' : 'Ex: 12.345.678/0001-90';
    }
    document.getElementById('novo-fornecedor-sem-cnpj').addEventListener('change', atualizarModoNovoFornecedorSemCnpj);
    document.getElementById('btn-trigger-modal-novo-fornecedor').addEventListener('click', () => {
        document.getElementById('form-novo-fornecedor').reset();
        atualizarModoNovoFornecedorSemCnpj();
    });

    document.getElementById('form-novo-fornecedor').addEventListener('submit', (e) => {
        e.preventDefault();
        const semCnpj = document.getElementById('novo-fornecedor-sem-cnpj').checked;
        const cnpjDigitado = document.getElementById('novo-fornecedor-cnpj').value.trim();
        const nome = document.getElementById('novo-fornecedor-nome').value.trim();
        const digits = normalizeCnpj(cnpjDigitado);
        if (!nome) return;
        if (!semCnpj && !digits) { showAlert('Informe o CNPJ do fornecedor, ou marque "Fornecedor sem CNPJ".', 'warning'); return; }
        if (digits && findFornecedorPorCnpj(digits)) { showAlert('Já existe um fornecedor cadastrado com este CNPJ.', 'warning'); return; }
        const novoRef = push(ref(db, 'fornecedores'));
        set(novoRef, { name: nome, cnpj: digits ? cnpjDigitado : '' }).then(() => {
            document.getElementById('modal-novo-fornecedor').style.display = 'none';
            document.getElementById('form-novo-fornecedor').reset();
        });
    });

    // ===== MODAL DETALHE DO FORNECEDOR (ABA 8 - ABRE AO CLICAR NO NOME NA TABELA) =====
    setupModalEvents(null, 'modal-detalhe-fornecedor', 'close-modal-detalhe-fornecedor');

    let currentDetalheFornecedorKey = null;
    let detalheFornecedorChartType = 'linha';

    function abrirDetalheFornecedor(key) {
        const fornecedor = allLoadedFornecedores[key];
        if (!fornecedor) return;

        currentDetalheFornecedorKey = key;
        document.getElementById('detalhe-fornecedor-nome').innerText = `${fornecedor.name}`;
        document.getElementById('detalhe-fornecedor-cnpj-view').innerHTML = formatCnpjOuInformal(fornecedor.cnpj);
        document.getElementById('detalhe-fornecedor-nome-view').style.display = 'flex';
        document.getElementById('detalhe-fornecedor-nome-edit').style.display = 'none';

        atualizarStatsDetalheFornecedor();

        detalheFornecedorChartType = 'linha';
        document.getElementById('btn-fornecedor-chart-linha').classList.add('active');
        document.getElementById('btn-fornecedor-chart-barra').classList.remove('active');
        setFornecedorPeriodPreset(null); // "Tudo" (já renderiza o gráfico)

        document.getElementById('modal-detalhe-fornecedor').style.display = 'flex';
    }
    window.abrirDetalheFornecedor = abrirDetalheFornecedor;

    function atualizarStatsDetalheFornecedor() {
        if (!currentDetalheFornecedorKey || !allLoadedFornecedores[currentDetalheFornecedorKey]) return;
        const compras = comprasDoFornecedor(currentDetalheFornecedorKey);
        const total = compras.reduce((acc, c) => acc + parseFloat(c.valorTotal || 0), 0);
        document.getElementById('detalhe-fornecedor-total-geral').innerText = `R$ ${formatMoeda(total)}`;
        document.getElementById('detalhe-fornecedor-qtd-compras').innerText = compras.length;
        renderTabelaComprasFornecedor();
    }

    // Tabela simples com o histórico completo de compras do fornecedor aberto no modal (Data, Chave de Acesso, Valor Líquido)
    function renderTabelaComprasFornecedor() {
        const tbody = document.getElementById('detalhe-fornecedor-compras-table-body');
        if (!tbody || !currentDetalheFornecedorKey) return;
        tbody.innerHTML = '';

        let lista = comprasDoFornecedor(currentDetalheFornecedorKey)
            .map(c => ({ ...c, valorTotal: parseFloat(c.valorTotal || 0) }));
        lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        lista = ordenarPorEstado(lista, 'detalhe-fornecedor-compras-table');

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma compra registrada ainda.</td></tr>';
            return;
        }

        lista.forEach(c => {
            const dataFormatada = c.data ? c.data.split('-').reverse().join('/') : '---';
            const chaveAcessoDisplay = c.nfChaveAcesso
                ? `<span style="font-family:var(--font-mono); font-size:8.5pt; word-break:break-all;">${c.nfChaveAcesso}</span>`
                : '<span style="color:var(--text-faint);">-</span>';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${chaveAcessoDisplay}</td>
                <td style="font-weight:700; color:#a85209;">R$ ${formatMoeda(c.valorTotal)}</td>
                <td><button class="btn-action-prod btn-edit-prod" onclick="abrirDetalheCompra('${c.key}')">👁️ Ver</button></td>
            `;
            tbody.appendChild(tr);
        });
    }
    bindSortableHeaders('detalhe-fornecedor-compras-table', 'detalhe-fornecedor-compras-table', renderTabelaComprasFornecedor);

    // Caixinha flutuante do gráfico de compras do fornecedor (mesmo estilo do gráfico da Aba 5)
    function showDetalheFornecedorTooltip(evt, ponto) {
        const wrapper = document.getElementById('detalhe-fornecedor-chart-svg').closest('.card');
        const tooltip = document.getElementById('detalhe-fornecedor-chart-tooltip');
        const wrapperRect = wrapper.getBoundingClientRect();
        tooltip.innerHTML = `<div class="tt-date">${ponto.data.split('-').reverse().join('/')}</div><div class="tt-value">R$ ${formatMoeda(ponto.valor)}</div>`;
        tooltip.style.left = `${evt.clientX - wrapperRect.left}px`;
        tooltip.style.top = `${evt.clientY - wrapperRect.top}px`;
        tooltip.classList.add('show');
    }

    function highlightFornecedorPeriodPreset(days) {
        document.getElementById('btn-fornecedor-periodo-7d').classList.toggle('active', days === 7);
        document.getElementById('btn-fornecedor-periodo-30d').classList.toggle('active', days === 30);
        document.getElementById('btn-fornecedor-periodo-todos').classList.toggle('active', days === null);
    }

    function setFornecedorPeriodPreset(days) {
        const fim = new Date();
        document.getElementById('detalhe-fornecedor-data-fim').value = dataISOparaBR(formatDateInputValue(fim));
        if (days !== null) {
            const inicio = new Date();
            inicio.setDate(fim.getDate() - (days - 1));
            document.getElementById('detalhe-fornecedor-data-inicio').value = dataISOparaBR(formatDateInputValue(inicio));
        } else {
            document.getElementById('detalhe-fornecedor-data-inicio').value = '';
        }
        highlightFornecedorPeriodPreset(days);
        renderDetalheFornecedorChart();
    }

    // Gráfico do valor comprado com o fornecedor (mesmo estilo visual do gráfico de compras do cliente na Aba 5),
    // com suporte a visualização em Linha/Barras e período personalizado (dd/mm/aaaa até dd/mm/aaaa)
    function renderDetalheFornecedorChart() {
        if (!currentDetalheFornecedorKey || !allLoadedFornecedores[currentDetalheFornecedorKey]) return;
        const svg = document.getElementById('detalhe-fornecedor-chart-svg');
        const emptyMsg = document.getElementById('detalhe-fornecedor-chart-empty');
        document.getElementById('detalhe-fornecedor-chart-tooltip').classList.remove('show');

        const inicioVal = dataBRparaISO(document.getElementById('detalhe-fornecedor-data-inicio').value);
        const fimVal = dataBRparaISO(document.getElementById('detalhe-fornecedor-data-fim').value);

        const somaPorDia = {};
        let totalValor = 0, totalQtdCompras = 0;
        comprasDoFornecedor(currentDetalheFornecedorKey).forEach(c => {
            if (!c.data) return;
            if (inicioVal && c.data < inicioVal) return;
            if (fimVal && c.data > fimVal) return;
            somaPorDia[c.data] = (somaPorDia[c.data] || 0) + parseFloat(c.valorTotal || 0);
            totalValor += parseFloat(c.valorTotal || 0);
            totalQtdCompras += 1;
        });

        document.getElementById('detalhe-fornecedor-total-valor').innerText = `R$ ${formatMoeda(totalValor)}`;
        document.getElementById('detalhe-fornecedor-total-qtd').innerText = `${totalQtdCompras}`;

        const datas = Object.keys(somaPorDia).sort();
        svg.innerHTML = '';

        if (datas.length === 0) {
            emptyMsg.style.display = 'block';
            svg.style.display = 'none';
            return;
        }
        emptyMsg.style.display = 'none';
        svg.style.display = 'block';

        const ns = 'http://www.w3.org/2000/svg';
        const W = 780, H = 240;
        const mL = 64, mR = 16, mT = 20, mB = 40;
        const uw = W - mL - mR;
        const uh = H - mT - mB;
        const maxValor = Math.max(...datas.map(d => somaPorDia[d]), 1);

        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = mT + (uh / ySteps) * i;
            const val = maxValor * (1 - i / ySteps);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', mL); line.setAttribute('x2', W - mR);
            line.setAttribute('y1', y); line.setAttribute('y2', y);
            line.setAttribute('stroke', document.documentElement.getAttribute('data-theme') === 'dark' ? (i === ySteps ? '#475569' : '#334155') : (i === ySteps ? '#c4cdd5' : '#eef1f3'));
            line.setAttribute('stroke-width', i === ySteps ? '1.5' : '1');
            svg.appendChild(line);

            const text = document.createElementNS(ns, 'text');
            text.setAttribute('x', mL - 8); text.setAttribute('y', y + 4);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('font-size', '10'); text.setAttribute('fill', 'var(--text-muted)');
            text.setAttribute('font-family', 'Segoe UI, sans-serif');
            text.textContent = `R$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)}`;
            svg.appendChild(text);
        }

        const eixoX = document.createElementNS(ns, 'line');
        eixoX.setAttribute('x1', mL); eixoX.setAttribute('x2', mL);
        eixoX.setAttribute('y1', mT); eixoX.setAttribute('y2', mT + uh);
        eixoX.setAttribute('stroke', '#c4cdd5'); eixoX.setAttribute('stroke-width', '1.5');
        svg.appendChild(eixoX);

        const passoLabel = Math.max(1, Math.ceil(datas.length / 7));

        if (detalheFornecedorChartType === 'barra') {
            const barGap = 0.25;
            const barW = Math.max(4, (uw / datas.length) * (1 - barGap));
            const spacing = uw / datas.length;

            datas.forEach((d, i) => {
                const barH = (somaPorDia[d] / maxValor) * uh;
                const x = mL + i * spacing + (spacing - barW) / 2;
                const y = mT + uh - barH;

                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('x', x); rect.setAttribute('y', y);
                rect.setAttribute('width', barW); rect.setAttribute('height', barH);
                rect.setAttribute('rx', '3');
                rect.setAttribute('fill', '#c05e0a');
                rect.setAttribute('opacity', '0.85');
                rect.style.cursor = 'pointer';
                svg.appendChild(rect);

                if (barW > 22) {
                    const valLabel = document.createElementNS(ns, 'text');
                    valLabel.setAttribute('x', x + barW / 2); valLabel.setAttribute('y', y - 6);
                    valLabel.setAttribute('text-anchor', 'middle');
                    valLabel.setAttribute('font-size', '11'); valLabel.setAttribute('font-weight', '800');
                    valLabel.setAttribute('fill', '#a85209');
                    valLabel.setAttribute('font-family', 'Segoe UI, sans-serif');
                    valLabel.textContent = `R$${somaPorDia[d].toFixed(0)}`;
                    svg.appendChild(valLabel);
                }

                const pontoBarra = { data: d, valor: somaPorDia[d] };
                rect.addEventListener('mouseenter', (evt) => { rect.setAttribute('opacity', '1'); showDetalheFornecedorTooltip(evt, pontoBarra); });
                rect.addEventListener('mousemove', (evt) => showDetalheFornecedorTooltip(evt, pontoBarra));
                rect.addEventListener('mouseleave', () => { rect.setAttribute('opacity', '0.85'); document.getElementById('detalhe-fornecedor-chart-tooltip').classList.remove('show'); });

                if (i % passoLabel === 0 || i === datas.length - 1) {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', x + barW / 2); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '10'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = d.split('-').slice(1).reverse().join('/');
                    svg.appendChild(text);
                }
            });

        } else {
            const pontos = datas.map((d, i) => ({
                x: datas.length === 1 ? mL + uw / 2 : mL + (uw / (datas.length - 1)) * i,
                y: mT + uh - (somaPorDia[d] / maxValor) * uh,
                valor: somaPorDia[d],
                data: d
            }));

            const areaPath = `M ${pontos[0].x} ${mT + uh} ` +
                pontos.map(p => `L ${p.x} ${p.y}`).join(' ') +
                ` L ${pontos[pontos.length - 1].x} ${mT + uh} Z`;
            const area = document.createElementNS(ns, 'path');
            area.setAttribute('d', areaPath);
            area.setAttribute('fill', 'rgba(211, 84, 0, 0.10)');
            area.setAttribute('stroke', 'none');
            svg.appendChild(area);

            const linePath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d', linePath);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#c05e0a');
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);

            pontos.forEach((p, i) => {
                const circle = document.createElementNS(ns, 'circle');
                circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
                circle.setAttribute('r', '4'); circle.setAttribute('fill', '#c05e0a');
                circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '2');
                svg.appendChild(circle);

                const hitArea = document.createElementNS(ns, 'circle');
                hitArea.setAttribute('cx', p.x); hitArea.setAttribute('cy', p.y);
                hitArea.setAttribute('r', '11'); hitArea.setAttribute('fill', 'transparent');
                hitArea.style.cursor = 'pointer';
                hitArea.addEventListener('mouseenter', (evt) => { circle.setAttribute('r', '6'); showDetalheFornecedorTooltip(evt, p); });
                hitArea.addEventListener('mousemove', (evt) => showDetalheFornecedorTooltip(evt, p));
                hitArea.addEventListener('mouseleave', () => { circle.setAttribute('r', '4'); document.getElementById('detalhe-fornecedor-chart-tooltip').classList.remove('show'); });
                svg.appendChild(hitArea);

                if (i % passoLabel === 0 || i === pontos.length - 1) {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', p.x); text.setAttribute('y', H - mB + 16);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-size', '10'); text.setAttribute('fill', 'var(--text-muted)');
                    text.setAttribute('font-family', 'Segoe UI, sans-serif');
                    text.textContent = p.data.split('-').slice(1).reverse().join('/');
                    svg.appendChild(text);
                }
            });
        }
    }

    document.getElementById('btn-fornecedor-chart-linha').addEventListener('click', () => {
        detalheFornecedorChartType = 'linha';
        document.getElementById('btn-fornecedor-chart-linha').classList.add('active');
        document.getElementById('btn-fornecedor-chart-barra').classList.remove('active');
        renderDetalheFornecedorChart();
    });
    document.getElementById('btn-fornecedor-chart-barra').addEventListener('click', () => {
        detalheFornecedorChartType = 'barra';
        document.getElementById('btn-fornecedor-chart-barra').classList.add('active');
        document.getElementById('btn-fornecedor-chart-linha').classList.remove('active');
        renderDetalheFornecedorChart();
    });
    document.getElementById('btn-fornecedor-periodo-7d').addEventListener('click', () => setFornecedorPeriodPreset(7));
    document.getElementById('btn-fornecedor-periodo-30d').addEventListener('click', () => setFornecedorPeriodPreset(30));
    document.getElementById('btn-fornecedor-periodo-todos').addEventListener('click', () => setFornecedorPeriodPreset(null));
    document.getElementById('btn-fornecedor-periodo-custom').addEventListener('click', () => { highlightFornecedorPeriodPreset(-1); renderDetalheFornecedorChart(); });


    // Edição do CNPJ/Nome do fornecedor a partir do modal de detalhe
    document.getElementById('btn-editar-fornecedor').addEventListener('click', () => {
        const fornecedor = allLoadedFornecedores[currentDetalheFornecedorKey];
        if (!fornecedor) return;
        document.getElementById('detalhe-fornecedor-cnpj-input').value = fornecedor.cnpj || '';
        document.getElementById('detalhe-fornecedor-nome-input').value = fornecedor.name || '';
        document.getElementById('detalhe-fornecedor-nome-view').style.display = 'none';
        document.getElementById('detalhe-fornecedor-nome-edit').style.display = 'flex';
        document.getElementById('detalhe-fornecedor-cnpj-input').focus();
    });
    document.getElementById('btn-cancelar-fornecedor').addEventListener('click', () => {
        document.getElementById('detalhe-fornecedor-nome-edit').style.display = 'none';
        document.getElementById('detalhe-fornecedor-nome-view').style.display = 'flex';
    });
    document.getElementById('btn-salvar-fornecedor').addEventListener('click', () => {
        const fornecedor = allLoadedFornecedores[currentDetalheFornecedorKey];
        if (!fornecedor) return;
        const novoCnpjDigitado = document.getElementById('detalhe-fornecedor-cnpj-input').value.trim();
        const novoNome = document.getElementById('detalhe-fornecedor-nome-input').value.trim();
        const novosDigits = normalizeCnpj(novoCnpjDigitado);
        if (!novoNome) { showAlert('Informe o nome do fornecedor.', 'warning'); return; }
        if (novosDigits) {
            const jaExiste = Object.entries(allLoadedFornecedores).some(([k, f]) => k !== currentDetalheFornecedorKey && normalizeCnpj(f.cnpj) === novosDigits);
            if (jaExiste) { showAlert('Já existe outro fornecedor cadastrado com este CNPJ.', 'warning'); return; }
        }
        const cnpjFinal = novosDigits ? novoCnpjDigitado : '';
        update(ref(db, `fornecedores/${currentDetalheFornecedorKey}`), { name: novoNome, cnpj: cnpjFinal }).then(() => {
            allLoadedFornecedores[currentDetalheFornecedorKey].name = novoNome;
            allLoadedFornecedores[currentDetalheFornecedorKey].cnpj = cnpjFinal;
            document.getElementById('detalhe-fornecedor-nome').innerText = `${novoNome}`;
            document.getElementById('detalhe-fornecedor-cnpj-view').innerHTML = formatCnpjOuInformal(cnpjFinal);
            document.getElementById('detalhe-fornecedor-nome-edit').style.display = 'none';
            document.getElementById('detalhe-fornecedor-nome-view').style.display = 'flex';
            renderFornecedoresTable();
            atualizarStatsDetalheFornecedor();
            renderDetalheFornecedorChart();
        });
    });

    // ----- MODAL CADASTRO RÁPIDO DE FORNECEDOR (ABERTO A PARTIR DO CAMPO CNPJ NA ABA 7) -----
    setupModalEvents(null, 'modal-cadastro-rapido-fornecedor', 'close-modal-cadastro-rapido-fornecedor');

    function abrirModalCadastroRapidoFornecedor(cnpjDigitado) {
        document.getElementById('rapido-fornecedor-cnpj').value = cnpjDigitado;
        // Se o CNPJ veio de uma nota importada em PDF, já sugere a Razão Social dela como nome
        document.getElementById('rapido-fornecedor-nome').value = notaFiscalImportadaAtual ? (notaFiscalImportadaAtual.razaoSocial || '') : '';
        document.getElementById('modal-cadastro-rapido-fornecedor').style.display = 'flex';
        setTimeout(() => document.getElementById('rapido-fornecedor-nome').focus(), 50);
    }

    document.getElementById('close-modal-cadastro-rapido-fornecedor').addEventListener('click', () => {
        // Se o usuário cancelar o cadastro rápido, limpa o CNPJ da compra para forçar uma nova tentativa
        document.getElementById('compra-fornecedor-cnpj').value = '';
        document.getElementById('compra-fornecedor-nome').value = '';
        document.getElementById('compra-fornecedor-cnpj').dataset.fornecedorKey = '';
    });

    document.getElementById('form-cadastro-rapido-fornecedor').addEventListener('submit', (e) => {
        e.preventDefault();
        const cnpjDigitado = document.getElementById('rapido-fornecedor-cnpj').value.trim();
        const nome = document.getElementById('rapido-fornecedor-nome').value.trim();
        const digits = normalizeCnpj(cnpjDigitado);
        if (!digits || !nome) return;
        if (findFornecedorPorCnpj(digits)) { showAlert('Já existe um fornecedor cadastrado com este CNPJ.', 'warning'); return; }
        const novoRef = push(ref(db, 'fornecedores'));
        set(novoRef, { name: nome, cnpj: cnpjDigitado }).then(() => {
            document.getElementById('compra-fornecedor-cnpj').value = cnpjDigitado;
            document.getElementById('compra-fornecedor-nome').value = nome;
            document.getElementById('compra-fornecedor-cnpj').dataset.fornecedorKey = novoRef.key;
            document.getElementById('modal-cadastro-rapido-fornecedor').style.display = 'none';
            document.getElementById('form-cadastro-rapido-fornecedor').reset();
            showAlert(`Fornecedor "${nome}" cadastrado com sucesso! Pode continuar preenchendo a compra.`, 'success');
        }).catch(err => showAlert('Erro ao cadastrar fornecedor: ' + err.message, 'danger'));
    });

    // ----- MODO "COMPRA SEM CNPJ" (fornecedor informal/autônomo, sem nota fiscal) -----
    // Quando marcado: o CNPJ deixa de ser obrigatório (aceita CPF ou fica em branco) e o nome do
    // fornecedor passa a usar uma lista suspensa (datalist) com os fornecedores já cadastrados -
    // o usuário pode escolher um existente ou digitar um nome novo, que é cadastrado na hora ao salvar.
    function atualizarModoCompraSemCnpj() {
        const semCnpj = document.getElementById('compra-sem-cnpj').checked;
        const cnpjInput = document.getElementById('compra-fornecedor-cnpj');
        const nomeInput = document.getElementById('compra-fornecedor-nome');
        const cnpjLabel = document.getElementById('compra-fornecedor-cnpj-label');
        const nomeLabel = document.getElementById('compra-fornecedor-nome-label');
        const nomeHint = document.getElementById('compra-fornecedor-nome-hint');
        if (semCnpj) {
            cnpjInput.required = false;
            cnpjLabel.innerText = 'CPF do Fornecedor (opcional)';
            cnpjInput.placeholder = 'Ex: CPF do vendedor, se houver';
            nomeInput.readOnly = false;
            nomeInput.placeholder = 'Selecione ou digite o nome do fornecedor/vendedor';
            nomeInput.setAttribute('list', 'datalist-fornecedores-compra');
            nomeLabel.innerText = 'Nome do Fornecedor';
            nomeHint.style.display = 'block';
            nomeHint.innerText = 'Escolha um fornecedor já cadastrado na lista ou digite um nome novo para cadastrá-lo automaticamente.';
            popularDatalistFornecedoresCompra();
        } else {
            cnpjInput.required = true;
            cnpjLabel.innerText = 'CNPJ do Fornecedor';
            cnpjInput.placeholder = 'Ex: 12.345.678/0001-90';
            nomeInput.readOnly = true;
            nomeInput.placeholder = 'Preenchido automaticamente pelo CNPJ';
            nomeInput.removeAttribute('list');
            nomeLabel.innerText = 'Nome do Fornecedor';
            nomeHint.style.display = 'none';
            // Ao voltar para o modo normal, refaz a busca/validação do fornecedor pelo que já estiver digitado
            cnpjInput.dispatchEvent(new Event('blur'));
        }
    }
    document.getElementById('compra-sem-cnpj').addEventListener('change', atualizarModoCompraSemCnpj);

    // ===== CONDIÇÃO DE PAGAMENTO DA COMPRA (À Vista / A Prazo) =====
    // À vista: mantém o comportamento de sempre (abate das contas na hora). A prazo: não mexe em
    // nenhuma conta agora - só guarda a data de vencimento; o pagamento de fato (e o abatimento da
    // conta) só acontece quando o usuário "dá baixa" depois, na tela de Histórico de Compras.
    document.querySelectorAll('.compra-condicao-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.compra-condicao-btn').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            const condicao = btn.getAttribute('data-condicao');
            document.getElementById('compra-condicao-pagamento').value = condicao;
            document.getElementById('compra-bloco-avista').style.display = condicao === 'avista' ? '' : 'none';
            document.getElementById('compra-bloco-prazo').style.display = condicao === 'prazo' ? '' : 'none';
        });
    });

    // No modo "Compra sem CNPJ", ao digitar/escolher o nome do fornecedor: se o nome digitado bater
    // (ignorando maiúsculas/acentos) com um fornecedor já cadastrado, vincula a compra a esse cadastro
    // existente (e aproveita o CNPJ/CPF dele, se houver e o campo ainda estiver vazio) - assim as compras
    // desse fornecedor informal ficam todas somadas no mesmo cadastro, em vez de criar um novo a cada compra.
    document.getElementById('compra-fornecedor-nome').addEventListener('input', () => {
        const semCnpj = document.getElementById('compra-sem-cnpj').checked;
        if (!semCnpj) return;
        const nomeInput = document.getElementById('compra-fornecedor-nome');
        const cnpjInput = document.getElementById('compra-fornecedor-cnpj');
        const nomeDigitado = normalizarBusca(nomeInput.value);
        const match = Object.entries(allLoadedFornecedores).find(([k, f]) => normalizarBusca(f.name) === nomeDigitado);
        if (match && nomeDigitado) {
            nomeInput.dataset.fornecedorKey = match[0];
            if (!cnpjInput.value.trim() && match[1].cnpj) cnpjInput.value = match[1].cnpj;
        } else {
            nomeInput.dataset.fornecedorKey = '';
        }
    });

    // Ao sair do campo de CNPJ na Aba 7: procura o fornecedor já cadastrado e preenche o nome automaticamente,
    // ou abre o cadastro rápido caso o CNPJ ainda não exista. No modo "Compra sem CNPJ", um CPF/CNPJ digitado
    // e não encontrado não força o cadastro rápido - o nome já é digitado livremente pelo usuário.
    document.getElementById('compra-fornecedor-cnpj').addEventListener('blur', () => {
        const input = document.getElementById('compra-fornecedor-cnpj');
        const nomeInput = document.getElementById('compra-fornecedor-nome');
        const semCnpj = document.getElementById('compra-sem-cnpj').checked;
        const digits = normalizeCnpj(input.value);
        if (!digits) {
            input.dataset.fornecedorKey = '';
            if (!semCnpj) nomeInput.value = '';
            return;
        }
        const match = findFornecedorPorCnpj(digits);
        if (match) {
            input.dataset.fornecedorKey = match[0];
            nomeInput.value = match[1].name;
        } else {
            input.dataset.fornecedorKey = '';
            if (semCnpj) return;
            nomeInput.value = '';
            abrirModalCadastroRapidoFornecedor(input.value.trim());
        }
    });

    function popularFiltroContaCompras() {
        const select = document.getElementById('compras-filtro-conta');
        const valorAtual = select.value;
        select.innerHTML = '<option value="">Todas as Contas Debitadas</option>';
        Object.keys(allLoadedContas).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key; opt.innerText = allLoadedContas[key].name;
            select.appendChild(opt);
        });
        select.value = valorAtual;
    }
    document.getElementById('compras-filtro-conta').addEventListener('change', renderComprasTable);

    function atualizarResumoCompras() {
        const limite = new Date();
        limite.setDate(limite.getDate() - 29);
        const limiteStr = formatDateInputValue(limite);
        let total30d = 0, itens30d = 0, totalAPagar = 0;
        const lista = Object.values(allLoadedComprasSuprimentos);
        lista.forEach(c => {
            if (c.statusPagamento === 'PENDENTE') totalAPagar += parseFloat(c.valorTotal || 0);
            if (!c.data || c.data < limiteStr) return;
            total30d += parseFloat(c.valorTotal || 0);
            itens30d += (c.itens || []).reduce((acc, it) => acc + parseFloat(it.quantidade || 0), 0);
        });
        document.getElementById('compras-total-30d').innerText = `R$ ${formatMoeda(total30d)}`;
        document.getElementById('compras-total-qtd').innerText = lista.length;
        document.getElementById('compras-itens-30d').innerText = formatQuantidade(itens30d);
        document.getElementById('compras-total-a-pagar').innerText = `R$ ${formatMoeda(totalAPagar)}`;
    }

    function renderComprasTable() {
        const tbody = document.getElementById('compras-table-body');
        tbody.innerHTML = '';
        popularFiltroContaCompras();
        const filtroConta = document.getElementById('compras-filtro-conta').value;
        const filtroStatusPag = document.getElementById('compras-filtro-status-pagamento').value;

        let lista = Object.keys(allLoadedComprasSuprimentos)
            .map(key => ({ key, ...allLoadedComprasSuprimentos[key] }))
            .filter(c => !filtroConta || (c.pagamentos || []).some(p => p.contaKey === filtroConta))
            .filter(c => !filtroStatusPag || (c.statusPagamento || 'PAGO') === filtroStatusPag);

        lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        lista = ordenarPorEstado(lista.map(c => ({ ...c, fornecedor: c.fornecedorNome || c.fornecedor || '', valorTotal: parseFloat(c.valorTotal || 0) })), 'compras-table');

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhuma compra registrada ainda.</td></tr>';
            return;
        }

        const hoje = formatDateInputValue(new Date());
        lista.forEach(c => {
            const dataFormatada = c.data ? c.data.split('-').reverse().join('/') : '---';
            const fornecedorDisplay = c.fornecedorNome
                ? `${c.fornecedorNome}<br><span style="font-size:8pt; color:var(--text-muted);">${formatCnpjOuInformal(c.fornecedorCnpj)}</span>`
                : (c.fornecedor || '<span style="color:var(--text-faint);">-</span>');
            const chaveAcessoDisplay = c.nfChaveAcesso
                ? `<span style="font-family:var(--font-mono); font-size:8.5pt; word-break:break-all;">${c.nfChaveAcesso}</span>`
                : '<span style="color:var(--text-faint);">-</span>';

            const statusPagamento = c.statusPagamento || 'PAGO'; // compras antigas (antes dessa funcionalidade) já eram sempre pagas na hora
            let pagamentoDisplay;
            if (statusPagamento === 'PAGO') {
                pagamentoDisplay = `<span class="badge-status status-pago">Pago</span>`;
            } else {
                const vencida = c.dataVencimento && c.dataVencimento < hoje;
                pagamentoDisplay = `<span class="badge-status ${vencida ? 'status-cancelado' : 'status-confirmado'}">${vencida ? '⚠️ Vencida' : 'Pendente'}</span>`
                    + (c.dataVencimento ? `<br><span style="font-size:8pt; color:${vencida ? 'var(--color-negative)' : 'var(--text-muted)'};">Vence ${dataISOparaBR(c.dataVencimento)}</span>` : '');
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${fornecedorDisplay}</td>
                <td>${chaveAcessoDisplay}</td>
                <td style="font-weight:700; color:#a85209;">R$ ${formatMoeda(parseFloat(c.valorTotal || 0))}</td>
                <td>${pagamentoDisplay}</td>
                <td style="white-space:nowrap;">
                    <button class="btn-action-prod btn-edit-prod" onclick="abrirDetalheCompra('${c.key}')">👁️ Ver</button>
                    ${statusPagamento === 'PENDENTE' ? `<button class="btn-action-prod btn-edit-prod" style="background-color:var(--color-positive);" onclick="abrirModalDarBaixaCompra('${c.key}')">✅ Dar Baixa</button>` : ''}
                    <button class="btn-action-prod btn-delete-prod" onclick="excluirCompra('${c.key}')">🗑️ Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    bindSortableHeaders('compras-table', 'compras-table', renderComprasTable);
    document.getElementById('compras-filtro-status-pagamento').addEventListener('change', renderComprasTable);

    // ===== RECEBIMENTOS DE MERCADORIA (visão logística da mesma coleção comprasSuprimentos - foco =====
    // ===== no que chegou/foi recebido, não na parte fiscal/financeira que já é a aba de Notas) =====
    function renderRecebimentosTable() {
        const tbody = document.getElementById('recebimentos-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        const filtroVinculo = document.getElementById('recebimentos-filtro-vinculo').value;

        let lista = Object.keys(allLoadedComprasSuprimentos)
            .map(key => ({ key, ...allLoadedComprasSuprimentos[key] }))
            .filter(c => !filtroVinculo || (filtroVinculo === 'vinculado' ? !!c.pedidoCompraKey : !c.pedidoCompraKey));

        lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        lista = ordenarPorEstado(lista.map(c => ({ ...c, fornecedor: c.fornecedorNome || c.fornecedor || '', valorTotal: parseFloat(c.valorTotal || 0) })), 'recebimentos-table');

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhum recebimento de mercadoria registrado ainda.</td></tr>';
            return;
        }

        lista.forEach(c => {
            const dataFormatada = c.data ? c.data.split('-').reverse().join('/') : '---';
            const pedidoVinculado = c.pedidoCompraKey && allLoadedPedidosCompra[c.pedidoCompraKey];
            const pedidoDisplay = pedidoVinculado
                ? `<a href="javascript:void(0)" class="cliente-nome-link" onclick="abrirDetalhePedidoCompra('${c.pedidoCompraKey}')">Pedido ${String(pedidoVinculado.pedidoNumero).padStart(3,'0')}</a>`
                : '<span style="color:var(--text-faint);">Avulso</span>';
            const qtdTipos = (c.itens || []).length;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${pedidoDisplay}</td>
                <td>${c.fornecedorNome || c.fornecedor || '<span style="color:var(--text-faint);">-</span>'}</td>
                <td><span class="produtos-badge" data-compra-key="${c.key}">${qtdTipos} ${qtdTipos === 1 ? 'item' : 'itens'}</span></td>
                <td style="font-weight:700; color:#a85209;">R$ ${formatMoeda(parseFloat(c.valorTotal || 0))}</td>
                <td><button class="btn-action-prod btn-edit-prod" onclick="abrirDetalheCompra('${c.key}')">👁️ Ver</button></td>
            `;
            tbody.appendChild(tr);
        });
    }
    bindSortableHeaders('recebimentos-table', 'recebimentos-table', renderRecebimentosTable);
    document.getElementById('recebimentos-filtro-vinculo').addEventListener('change', renderRecebimentosTable);

    // Tooltip com os itens recebidos ao passar o mouse sobre o selo "X itens" - mesmo padrão usado
    // no selo "produtos" do Histórico de Vendas (Aba 5), só que lendo de comprasSuprimentos.
    (function initItensRecebimentoTooltip() {
        const tooltip = document.createElement('div');
        tooltip.id = 'recebimento-itens-tooltip';
        document.body.appendChild(tooltip);
        const tbodyReceb = document.getElementById('recebimentos-table-body');

        function montarTabelaItensRecebidos(compraKey) {
            const c = allLoadedComprasSuprimentos[compraKey];
            if (!c) return '';
            const linhas = (c.itens || []).map(it => `<tr><td>${nomeClicavelInsumo(it.insumoKey, it.insumoNome || it.descricao || 'Item')}</td><td class="tt-qtd">${formatQuantidade(it.quantidade || 0)}</td></tr>`).join('');
            return `<table><thead><tr><th>Item</th><th>Qtd.</th></tr></thead><tbody>${linhas}</tbody></table>`;
        }

        tbodyReceb.addEventListener('mouseover', (e) => {
            const badge = e.target.closest('.produtos-badge');
            if (!badge) return;
            tooltip.innerHTML = montarTabelaItensRecebidos(badge.dataset.compraKey);
            const rect = badge.getBoundingClientRect();
            const margem = 10;
            const ttWidth = tooltip.offsetWidth;
            const ttHeight = tooltip.offsetHeight;
            let top = rect.bottom + 8;
            if (top + ttHeight > window.innerHeight - margem) {
                top = rect.top - ttHeight - 8;
                if (top < margem) top = margem;
            }
            let left = rect.left;
            if (left + ttWidth > window.innerWidth - margem) left = window.innerWidth - ttWidth - margem;
            if (left < margem) left = margem;
            tooltip.style.transform = `translate(${left}px, ${top}px)`;
            tooltip.classList.add('visible');
        });
        tbodyReceb.addEventListener('mouseout', (e) => {
            if (!e.target.closest('.produtos-badge')) return;
            if (e.relatedTarget && tooltip.contains(e.relatedTarget)) return;
            tooltip.classList.remove('visible');
        });
        tooltip.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    })();

    // ===== MODAL DETALHE DE COMPRA JÁ REGISTRADA (mostra os itens e as contas debitadas daquela compra) =====
    setupModalEvents(null, 'modal-detalhe-compra', 'close-modal-detalhe-compra');
    function abrirDetalheCompra(key) {
        const compra = allLoadedComprasSuprimentos[key];
        if (!compra) return;

        document.getElementById('detalhe-compra-fornecedor').innerText = compra.fornecedorNome || compra.fornecedor || '-';
        document.getElementById('detalhe-compra-data').innerText = compra.data ? compra.data.split('-').reverse().join('/') : '---';

        const chaveWrap = document.getElementById('detalhe-compra-chave-wrap');
        if (compra.nfChaveAcesso) {
            chaveWrap.style.display = 'block';
            document.getElementById('detalhe-compra-chave').innerText = compra.nfChaveAcesso;
        } else {
            chaveWrap.style.display = 'none';
        }

        const tbodyItens = document.getElementById('detalhe-compra-itens-table-body');
        tbodyItens.innerHTML = '';
        (compra.itens || []).forEach(it => {
            const tr = document.createElement('tr');
            const nomeExibido = it.semEstoque
                ? `${it.insumoNome || '-'} <span style="font-size:7.5pt; color:#085caf;">(sem estoque)</span>`
                : nomeClicavelInsumo(it.insumoKey, it.insumoNome || '-');
            // Compras antigas (feitas antes desse campo existir) não têm unitarioBruto salvo - nesse
            // caso trata como "sem desconto", usando o próprio custoUnitario como bruto.
            const temUnitarioBruto = it.unitarioBruto !== undefined && it.unitarioBruto !== null;
            const unitarioBruto = temUnitarioBruto ? parseFloat(it.unitarioBruto) : parseFloat(it.custoUnitario || 0);
            const descontoUnitario = parseFloat(it.descontoUnitario || 0);
            const descontoDisplay = descontoUnitario > 0
                ? (it.descontoTipo === 'percentual'
                    ? `${parseFloat(it.descontoValor || 0).toLocaleString('pt-BR')}% <span style="color:var(--text-faint); font-size:8pt;">(R$ ${formatMoeda(descontoUnitario)}/un)</span>`
                    : `R$ ${formatMoeda(descontoUnitario)}/un`)
                : '-';
            tr.innerHTML = `
                <td>${nomeExibido}</td>
                <td>${formatQuantidade(parseFloat(it.quantidade || 0))}</td>
                <td>${it.unidade || '-'}</td>
                <td>R$ ${formatMoeda(unitarioBruto)}</td>
                <td style="color:var(--color-negative);">${descontoDisplay}</td>
                <td style="font-weight:600;">R$ ${formatMoeda(parseFloat(it.custoUnitario || 0))}</td>
                <td style="font-weight:600;">R$ ${formatMoeda(parseFloat(it.subtotal || 0))}</td>
            `;
            tbodyItens.appendChild(tr);
        });
        if ((compra.itens || []).length === 0) {
            tbodyItens.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-faint); padding:14px;">Nenhum item registrado.</td></tr>';
        }

        const tbodyPagamentos = document.getElementById('detalhe-compra-pagamentos-table-body');
        tbodyPagamentos.innerHTML = '';
        (compra.pagamentos || []).forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${p.contaNome || '-'}</td><td style="font-weight:600;">R$ ${formatMoeda(parseFloat(p.valor || 0))}</td>`;
            tbodyPagamentos.appendChild(tr);
        });
        if ((compra.pagamentos || []).length === 0) {
            tbodyPagamentos.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--text-faint); padding:14px;">Nenhum pagamento registrado.</td></tr>';
        }

        document.getElementById('detalhe-compra-total').innerText = `R$ ${formatMoeda(parseFloat(compra.valorTotal || 0))}`;
        document.getElementById('modal-detalhe-compra').style.display = 'flex';
    }
    window.abrirDetalheCompra = abrirDetalheCompra;

    // ----- MODAL NOVA COMPRA: LINHAS DE ITENS -----
    // Calcula o custo líquido (após desconto) de uma linha de item de compra. O campo "Unitário"
    // continua representando o preço BRUTO (o que está na nota/foi negociado antes do desconto) -
    // o desconto informado aqui não mexe nesse valor nem no Total Bruto/Líquido oficiais da nota
    // (quando importada), só ajusta o custo que efetivamente entra no estoque e nas Ordens de
    // Produção. Isso evita que um desconto negociado item a item (mas lançado pelo fornecedor como
    // desconto geral no rodapé da nota) fique "escondido" e o sistema continue custeando a matéria-
    // prima pelo valor cheio.
    function calcularCustoLiquidoItem(row) {
        const qtd = parseFloat(row.querySelector('.item-compra-qtd').value) || 0;
        const unitarioBruto = parseFloat(row.querySelector('.item-compra-custo').value) || 0;
        const descontoEl = row.querySelector('.item-compra-desconto-valor');
        const descontoTipoEl = row.querySelector('.item-compra-desconto-tipo');
        const descontoValor = descontoEl ? (parseFloat(descontoEl.value) || 0) : 0;
        const descontoTipo = descontoTipoEl ? descontoTipoEl.value : 'valor'; // 'valor' (R$ por unidade) ou 'percentual'
        const descontoUnitario = descontoTipo === 'percentual'
            ? unitarioBruto * (Math.min(descontoValor, 100) / 100)
            : Math.min(descontoValor, unitarioBruto);
        const custoLiquidoUnitario = Math.max(0, parseFloat((unitarioBruto - descontoUnitario).toFixed(4)));
        return {
            qtd, unitarioBruto, descontoValor, descontoTipo, descontoUnitario, custoLiquidoUnitario,
            brutoTotal: parseFloat((qtd * unitarioBruto).toFixed(2)),
            liquidoTotal: parseFloat((qtd * custoLiquidoUnitario).toFixed(2))
        };
    }

    // Cria o par de campos "Desconto" (valor + tipo R$/%) reutilizado tanto nas linhas manuais quanto
    // nas linhas importadas de nota fiscal.
    function criarCamposDescontoItem() {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'flex:1 1 110px; display:flex; gap:3px;';

        const inputDesconto = document.createElement('input');
        inputDesconto.type = 'number'; inputDesconto.min = '0'; inputDesconto.step = 'any'; inputDesconto.placeholder = '0';
        inputDesconto.className = 'item-compra-desconto-valor';
        inputDesconto.value = '0';
        inputDesconto.title = 'Desconto negociado neste item. Não altera o valor da nota - só o custo que entra no estoque/produção.';
        inputDesconto.style.cssText = 'flex:1 1 60px; margin:0; font-size:9.5pt;';

        const selectTipo = document.createElement('select');
        selectTipo.className = 'item-compra-desconto-tipo';
        selectTipo.style.cssText = 'flex:0 0 54px; margin:0; font-size:9.5pt; padding-left:2px; padding-right:2px;';
        selectTipo.innerHTML = '<option value="valor">R$</option><option value="percentual">%</option>';

        wrapper.appendChild(inputDesconto);
        wrapper.appendChild(selectTipo);
        return { wrapper, inputDesconto, selectTipo };
    }

    let contadorItemCompra = 0;
    function criarLinhaItemCompra() {
        contadorItemCompra++;
        const rowId = `item-compra-${contadorItemCompra}`;
        const div = document.createElement('div');
        div.className = 'linha-item-compra';
        div.id = rowId;
        div.style.cssText = 'display:flex; gap:8px; align-items:flex-end; margin-bottom:8px; flex-wrap:wrap; background:var(--bg-soft); padding:8px; border-radius: 3px;';

        // Envolve o seletor de insumo + a alternativa "não é matéria-prima" numa coluna só, pra poder
        // trocar entre os dois sem bagunçar o alinhamento das outras colunas (qtd, custo, subtotal).
        const selectWrapper = document.createElement('div');
        selectWrapper.style.cssText = 'flex:2 1 160px; display:flex; flex-direction:column; gap:4px;';

        const selectInsumo = document.createElement('select');
        selectInsumo.className = 'item-compra-insumo';
        selectInsumo.style.cssText = 'width:100%; margin:0;';
        selectInsumo.innerHTML = '<option value="">-- Selecione o Insumo --</option>' +
            Object.keys(allLoadedSuprimentos).map(key => `<option value="${key}">${allLoadedSuprimentos[key].name}</option>`).join('');

        // Usada só quando "não é matéria-prima" está marcado - mesma classe usada nos itens importados
        // de nota (.item-compra-descricao-nota), pra alimentar o nome do item ao salvar a compra sem
        // precisar duplicar lógica de leitura no momento de confirmar.
        const inputDescManual = document.createElement('input');
        inputDescManual.type = 'text';
        inputDescManual.className = 'item-compra-descricao-nota';
        inputDescManual.placeholder = 'Descrição do item comprado';
        inputDescManual.style.cssText = 'width:100%; margin:0; display:none;';

        const labelSemEstoque = document.createElement('label');
        labelSemEstoque.style.cssText = 'display:flex; align-items:center; gap:5px; font-size:7.8pt; color:var(--text-muted); cursor:pointer;';
        const inputSemEstoque = document.createElement('input');
        inputSemEstoque.type = 'checkbox';
        inputSemEstoque.className = 'item-compra-sem-estoque';
        inputSemEstoque.style.cssText = 'margin:0; cursor:pointer;';
        labelSemEstoque.appendChild(inputSemEstoque);
        labelSemEstoque.appendChild(document.createTextNode('Não é matéria-prima (não dá entrada em estoque)'));

        selectWrapper.appendChild(selectInsumo);
        selectWrapper.appendChild(inputDescManual);
        selectWrapper.appendChild(labelSemEstoque);

        const inputQtd = document.createElement('input');
        inputQtd.type = 'number'; inputQtd.min = '0.0001'; inputQtd.step = 'any'; inputQtd.placeholder = 'Qtd.';
        inputQtd.className = 'item-compra-qtd';
        inputQtd.style.cssText = 'flex:1 1 80px; margin:0;';

        const inputCusto = document.createElement('input');
        // step="any" permite digitar o custo unitário com quantas casas decimais forem necessárias
        // (ex: compra de R$ 40,00 em 30 unidades = 1,3333 por unidade) sem o navegador bloquear o
        // valor por "não corresponder ao step". O arredondamento pra 2 casas decimais no cadastro do
        // insumo é feito depois, ao salvar a compra.
        inputCusto.type = 'number'; inputCusto.min = '0'; inputCusto.step = 'any'; inputCusto.placeholder = 'Custo Unit. (R$)';
        inputCusto.className = 'item-compra-custo';
        inputCusto.title = 'Valor unitário BRUTO (sem desconto) deste item.';
        inputCusto.style.cssText = 'flex:1 1 105px; margin:0;';

        const { wrapper: descontoWrapper, inputDesconto, selectTipo: selectDescontoTipo } = criarCamposDescontoItem();

        const spanBruto = document.createElement('span');
        spanBruto.className = 'item-compra-bruto';
        spanBruto.title = 'Valor Bruto (quantidade × unitário, sem desconto)';
        spanBruto.style.cssText = 'flex:1 1 80px; font-weight:600; color:var(--text-muted); font-size:9pt; text-align:right; text-decoration:line-through; padding-top:4px;';
        spanBruto.innerText = 'R$ 0,00';

        const spanSubtotal = document.createElement('span');
        spanSubtotal.className = 'item-compra-subtotal';
        spanSubtotal.title = 'Valor Líquido (após o desconto) - é este valor que entra no estoque/produção.';
        spanSubtotal.style.cssText = 'flex:1 1 90px; font-weight:700; color:var(--text-strong); font-size:9.5pt; text-align:right;';
        spanSubtotal.innerText = 'R$ 0,00';

        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.innerText = '✕';
        btnRemover.title = 'Remover item';
        btnRemover.className = 'btn-action-prod btn-delete-prod';
        btnRemover.style.cssText = 'flex:0 0 auto; padding:6px 10px;';
        btnRemover.addEventListener('click', () => { div.remove(); recalcularTotalCompra(); });

        selectInsumo.addEventListener('change', () => {
            const insumo = allLoadedSuprimentos[selectInsumo.value];
            inputCusto.value = insumo ? parseFloat(insumo.price || 0).toFixed(2) : '';
            recalcularSubtotalItem();
        });

        // Alterna entre "vincular a um insumo cadastrado" (normal, dá entrada em estoque) e "item de
        // uso/material que não é matéria-prima" (só descrição livre, não mexe em estoque nenhum).
        inputSemEstoque.addEventListener('change', () => {
            const semEstoque = inputSemEstoque.checked;
            selectInsumo.style.display = semEstoque ? 'none' : '';
            inputDescManual.style.display = semEstoque ? '' : 'none';
            if (semEstoque) { selectInsumo.value = ''; } else { inputDescManual.value = ''; }
        });

        function recalcularSubtotalItem() {
            const calc = calcularCustoLiquidoItem(div);
            // Só mostra o Bruto riscado quando há de fato desconto - senão os dois valores ficam
            // iguais e o risco em cima só polui a tela à toa.
            spanBruto.style.display = calc.descontoUnitario > 0 ? '' : 'none';
            spanBruto.innerText = `R$ ${formatMoeda(calc.brutoTotal)}`;
            spanSubtotal.innerText = `R$ ${formatMoeda(calc.liquidoTotal)}`;
            recalcularTotalCompra();
        }
        inputQtd.addEventListener('input', recalcularSubtotalItem);
        inputCusto.addEventListener('input', recalcularSubtotalItem);
        inputDesconto.addEventListener('input', recalcularSubtotalItem);
        selectDescontoTipo.addEventListener('change', recalcularSubtotalItem);

        div.appendChild(selectWrapper);
        div.appendChild(inputQtd);
        div.appendChild(inputCusto);
        div.appendChild(descontoWrapper);
        div.appendChild(spanBruto);
        div.appendChild(spanSubtotal);
        div.appendChild(btnRemover);
        recalcularSubtotalItem();
        return div;
    }

    document.getElementById('btn-add-item-compra').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('compra-itens-lista').appendChild(criarLinhaItemCompra());
    });

    function getValorTotalCompraAtual() {
        // Quando uma nota fiscal em PDF foi importada, o valor a pagar é o TOTAL LÍQUIDO DA NOTA
        // (que já contempla eventuais descontos gerais) - não a simples soma dos itens, que pode
        // divergir centavos por causa de arredondamento por item.
        if (notaFiscalImportadaAtual) return notaFiscalImportadaAtual.totalLiquido;

        // Soma o valor LÍQUIDO (já com o desconto de cada item aplicado) - é esse o valor que
        // realmente precisa ser distribuído entre as contas de pagamento.
        let total = 0;
        document.querySelectorAll('#compra-itens-lista .linha-item-compra').forEach(row => {
            total += calcularCustoLiquidoItem(row).liquidoTotal;
        });
        return parseFloat(total.toFixed(2));
    }

    function recalcularTotalCompra() {
        const total = getValorTotalCompraAtual();
        document.getElementById('compra-valor-total-display').innerText = `R$ ${formatMoeda(total)}`;
        recalcularRestantePagamento();
    }

    // ===== IMPORTAÇÃO DE NOTA FISCAL (NFC-e/NF-e) EM PDF - ABA 7 =====
    // Guarda os dados extraídos do PDF importado (cabeçalho + totais oficiais da nota) enquanto o
    // modal de nova compra estiver aberto. Fica null quando a compra é 100% preenchida manualmente.
    let notaFiscalImportadaAtual = null;

    // Converte um número no formato brasileiro ("1.234,56") para float. Usado em todos os valores
    // extraídos do texto do PDF (que vêm sempre nesse formato, igual ao "leitor_NFC-e_em_PDF.html").
    function parseNumeroBR(str) {
        if (!str) return 0;
        return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
    }

    // Extrai o texto de todas as páginas do PDF e aplica as mesmas expressões regulares do
    // "leitor_NFC-e_em_PDF.html" para separar cabeçalho, itens e totais da nota.
    async function processarPdfNotaFiscal(file) {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(buffer).promise;

        let textoCompleto = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            textoCompleto += content.items.map(x => x.str).join(' ') + '\n';
        }

        // --- Cabeçalho / Emitente ---
        const numeroNfMatch = textoCompleto.match(/Número\s*(?:NF-\s*e:?|NF-e:?)\s*(\d+)/i) || textoCompleto.match(/Número\s*NF\s*(\d+)/i);
        const chaveMatch = textoCompleto.match(/Chave\s*de\s*Acesso:\s*([\d\s]{44,60})/i);
        const cnpjMatch = textoCompleto.match(/CNPJ\s*([\d\.\/\-]+)/i);
        const razaoMatch = textoCompleto.match(/(?:Nome\s*\/\s*Razão Social|Razão Social)\s*([\w\d\s\-\&\.\/]+?)(?=\s*Inscrição|\s*UF|\s*CNPJ|\s*Bairro|\s*Endereço|\s*Destinatário|\s*Dados do)/i);

        const numeroNf = numeroNfMatch ? numeroNfMatch[1].trim() : null;
        const cnpj = cnpjMatch ? cnpjMatch[1].trim() : null;
        const razaoSocial = razaoMatch ? razaoMatch[1].trim() : null;
        const chaveAcesso = chaveMatch ? chaveMatch[1].replace(/\s+/g, '').trim() : null;

        // --- Itens ---
        // Delimita estritamente o bloco dos produtos, cortando antes dos Totais / Dados do Transporte /
        // Dados de Cobrança, para impedir que a regex capture por engano informações de frete ou cobrança.
        const itens = [];
        const contagemEan = {};
        const contagemDesc = {};

        const inicioBlocoProdutos = textoCompleto.indexOf('Dados dos Produtos');
        let textoProdutos = inicioBlocoProdutos !== -1 ? textoCompleto.substring(inicioBlocoProdutos) : textoCompleto;
        const fimBlocoIndex = textoProdutos.search(/\n\s*(?:Totais|Dados do Transporte|Dados de Cobrança)/i);
        if (fimBlocoIndex !== -1) {
            textoProdutos = textoProdutos.substring(0, fimBlocoIndex);
        }

        // Captura item + descrição "crua", parando antes de qualquer um dos marcadores que sempre vêm
        // logo depois da descrição na NF (mais tolerante a formatos diferentes de nota do que a versão
        // antiga, que exigia Qtd/Unidade/Total colados na mesma linha do item).
        const regexProduto = /(?:^|\n|\s)(\d{1,3})\s+([A-Z0-9\s\-\/\.\(\)\&\,\+\#]+?)(?=\s+Código do Produto|\s+Código NCM|\s+Qtd|\s+1,0000|\s+\d{1,3}\s+[A-Z])/gi;

        // 1ª passada: só localiza os itens (número + descrição bruta) e a posição de cada um no texto.
        const matchesBrutos = [];
        let match;
        while ((match = regexProduto.exec(textoProdutos)) !== null) {
            const descricaoBruta = match[2].trim();
            if (descricaoBruta.includes('Dados dos Produtos') ||
                descricaoBruta.includes('Valor Total') ||
                descricaoBruta.includes('Sem Frete') ||
                descricaoBruta.includes('Modalidade do Frete') ||
                descricaoBruta.length < 2) continue;
            matchesBrutos.push({ index: match.index, itemNum: match[1], descricaoBruta });
        }

        // 2ª passada: para cada item, o "trecho" analisado vai até o início do PRÓXIMO item encontrado
        // (em vez de uma janela fixa de 2000 caracteres) - evita que dados de um item "vazem" para o
        // item seguinte quando a nota tem itens muito próximos um do outro no texto extraído do PDF.
        for (let i = 0; i < matchesBrutos.length; i++) {
            const atual = matchesBrutos[i];
            const proximoIndex = (i + 1 < matchesBrutos.length) ? matchesBrutos[i + 1].index : textoProdutos.length;
            const trechoItem = textoProdutos.substring(atual.index, proximoIndex);

            const itemNum = atual.itemNum;
            let descricao = atual.descricaoBruta;

            // A unidade de medida (UN/KG/PA/CX/KIT/M2) às vezes gruda no final da descrição capturada -
            // guarda ela antes de limpar, pois é usada depois para o cadastro rápido de insumo (Aba 3).
            const umMatchDescricao = descricao.match(/\s+[\d\.\,]+\s+(KIT|UN|PA|KG|PC|CX|M2)\b.*$/i);
            descricao = descricao.replace(/\s+[\d\.\,]+\s+(?:KIT|UN|PA|KG|PC|CX|M2).*$/i, '').trim();

            // Valor Unitário: tenta primeiro o valor de COMERCIALIZAÇÃO e, se a nota não trouxer esse
            // campo, cai para o valor de TRIBUTAÇÃO (algumas notas só trazem um dos dois).
            const unitMatch = trechoItem.match(/(?:Valor unitário de comercialização|comercialização)\s*([\d\.]+,[\d]{2,4})/i) ||
                               trechoItem.match(/Valor unitário de tributação\s*([\d\.]+,[\d]{2,4})/i);
            const unitario = unitMatch ? parseNumeroBR(unitMatch[1]) : 0;

            // Quantidade Comercial (ignora datas, lê apenas o número associado à comercialização) + Unidade.
            // IMPORTANTE: usa parseFloat/parseNumeroBR aqui, NUNCA parseInt - produtos pesados (ex.:
            // "Morango Kg", quantidade 0,2480) têm quantidade fracionária, e arredondar pra inteiro fazia
            // 0,2480 virar 0 e cair no fallback "|| 1", comprando 1 KG inteiro em vez de 0,248 KG e
            // inflando o valor do item bem acima do que realmente foi pago na nota.
            let qtd = 1, um = umMatchDescricao ? umMatchDescricao[1].toUpperCase() : 'UN';
            const qtdMatch = trechoItem.match(/(?:Quantidade Comercial|Qtd\.)\s*(?:[^\d\n\r]*?\b)?([\d\.]+,[\d]{2,4})/i) ||
                             trechoItem.match(/([\d\.]+,[\d]{2,4})\s+(KIT|UN|PA|KG|PC|CX|M2)\b/i);
            if (qtdMatch) {
                const qtdLida = parseNumeroBR(qtdMatch[1]);
                qtd = qtdLida > 0 ? qtdLida : 1;
                if (qtdMatch[2]) um = qtdMatch[2].toUpperCase();
            }

            // Código EAN: tenta primeiro o EAN COMERCIAL e, se não encontrar, cai para o EAN TRIBUTÁVEL
            // (algumas notas só preenchem um dos dois campos).
            let ean = 'N/A';
            const eanMatch = trechoItem.match(/Código EAN Comercial[\s\S]*?(\d{8,14})/i) ||
                             trechoItem.match(/Código EAN Tributável[\s\S]*?(\d{8,14})/i);
            if (eanMatch) ean = eanMatch[1].replace(/^0+/, '') || '0';

            if (ean !== 'N/A' && ean !== '' && ean !== '0') {
                contagemEan[ean] = (contagemEan[ean] || 0) + 1;
            } else {
                // Sem EAN: usa a descrição normalizada como chave para detectar duplicidade também
                // (ex.: "MORANGO KG" comprado 2x na mesma nota, sem código de barras).
                const chaveDesc = normalizarDescricaoItemNota(descricao);
                contagemDesc[chaveDesc] = (contagemDesc[chaveDesc] || 0) + 1;
            }

            const total = unitario > 0 ? parseFloat((unitario * qtd).toFixed(2)) : 0;

            itens.push({ itemNum, descricao, ean, qtd, um, unitario, total });
        }
        itens.forEach(it => {
            it.duplicado = it.ean !== 'N/A'
                ? contagemEan[it.ean] > 1
                : contagemDesc[normalizarDescricaoItemNota(it.descricao)] > 1;
        });

        // --- Totais da nota ---
        const totalProdutosMatch = textoCompleto.match(/Valor Total dos\s*Produtos\s*([\d\.]+,[\d]{2})/i);
        const totalDescontosMatch = textoCompleto.match(/Valor Total dos\s*Descontos\s*([\d\.]+,[\d]{2})/i);
        const totalNotaMatch = textoCompleto.match(/Valor Total da\s*(?:Nota Fiscal|NFe)\s*([\d\.]+,[\d]{2})/i);

        const totalBruto = totalProdutosMatch ? parseNumeroBR(totalProdutosMatch[1]) : parseFloat(itens.reduce((acc, i) => acc + i.total, 0).toFixed(2));
        const totalDescontos = totalDescontosMatch ? parseNumeroBR(totalDescontosMatch[1]) : 0;
        const totalLiquido = totalNotaMatch ? parseNumeroBR(totalNotaMatch[1]) : parseFloat((totalBruto - totalDescontos).toFixed(2));

        if (itens.length === 0) throw new Error('Nenhum item foi reconhecido neste PDF.');

        return { numeroNf, cnpj, razaoSocial, chaveAcesso, itens, totalBruto, totalDescontos, totalLiquido };
    }

    // Lê o XML da NFC-e/NF-e (formato oficial da SEFAZ) e devolve os dados no MESMO formato usado pelo
    // import de PDF acima, para que aplicarDadosNotaImportada() funcione igual não importa a origem.
    // O XML é a fonte oficial da nota (não depende de "adivinhar" texto solto de um PDF), então os
    // valores e o EAN saem exatos direto das tags - sem precisar de regex sobre texto extraído.
    function processarXmlNotaFiscal(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(event.target.result, 'text/xml');
                    if (xml.querySelector('parsererror')) {
                        reject(new Error('Arquivo XML inválido.'));
                        return;
                    }

                    // Helper com fallback para Namespaces no XML (algumas notas trazem as tags com
                    // o prefixo "nfe:", outras sem prefixo nenhum).
                    const getTagText = (parent, tagName) => {
                        if (!parent) return '';
                        const el = parent.getElementsByTagName(tagName)[0] || parent.getElementsByTagName('nfe:' + tagName)[0];
                        return el ? el.textContent.trim() : '';
                    };

                    const ide = xml.getElementsByTagName('ide')[0] || xml.getElementsByTagName('nfe:ide')[0];
                    const emit = xml.getElementsByTagName('emit')[0] || xml.getElementsByTagName('nfe:emit')[0];

                    const numeroNf = ide ? getTagText(ide, 'nNF') : null;
                    const docBruto = emit ? (getTagText(emit, 'CNPJ') || getTagText(emit, 'CPF')) : '';
                    const cnpj = docBruto || null;
                    const razaoSocial = emit ? (getTagText(emit, 'xNome') || null) : null;

                    let chaveAcesso = null;
                    const infNFe = xml.getElementsByTagName('infNFe')[0] || xml.getElementsByTagName('nfe:infNFe')[0];
                    if (infNFe && infNFe.getAttribute('Id')) {
                        chaveAcesso = infNFe.getAttribute('Id').replace('NFe', '');
                    } else {
                        chaveAcesso = getTagText(xml, 'chNFe') || null;
                    }

                    // Itens: cada <det> traz um <prod> com os dados exatos do item (sem precisar de regex)
                    const itensXml = xml.getElementsByTagName('det');
                    const itens = [];
                    const contagemEan = {};
                    const contagemDesc = {};

                    for (let i = 0; i < itensXml.length; i++) {
                        const det = itensXml[i];
                        const itemNum = det.getAttribute('nItem') || String(i + 1);
                        const prod = det.getElementsByTagName('prod')[0] || det.getElementsByTagName('nfe:prod')[0];
                        if (!prod) continue;

                        const descricao = getTagText(prod, 'xProd');
                        const um = (getTagText(prod, 'uCom') || 'UN').toUpperCase();

                        let ean = getTagText(prod, 'cEAN');
                        if (!ean || ean === 'SEM GTIN') ean = getTagText(prod, 'cEANTrib');
                        if (ean && ean !== 'SEM GTIN' && ean !== '') {
                            ean = ean.replace(/^0+/, '') || '0';
                            contagemEan[ean] = (contagemEan[ean] || 0) + 1;
                        } else {
                            ean = 'N/A';
                            // Sem EAN: usa a descrição normalizada como chave para detectar duplicidade
                            // também (ex.: "MORANGO KG" comprado 2x na mesma nota, sem código de barras).
                            const chaveDesc = normalizarDescricaoItemNota(descricao);
                            contagemDesc[chaveDesc] = (contagemDesc[chaveDesc] || 0) + 1;
                        }

                        const qtdVal = parseFloat(getTagText(prod, 'qCom')) || 0;
                        const unitario = parseFloat(getTagText(prod, 'vUnCom')) || 0;
                        const total = parseFloat(getTagText(prod, 'vProd')) || 0;

                        itens.push({
                            itemNum,
                            descricao,
                            ean,
                            qtd: qtdVal || 1,
                            um,
                            unitario,
                            total
                        });
                    }
                    itens.forEach(it => {
                        it.duplicado = it.ean !== 'N/A'
                            ? contagemEan[it.ean] > 1
                            : contagemDesc[normalizarDescricaoItemNota(it.descricao)] > 1;
                    });

                    if (itens.length === 0) {
                        reject(new Error('Nenhum item foi reconhecido neste XML.'));
                        return;
                    }

                    // Totais oficiais da nota, restritos ao bloco <ICMSTot> (evita pegar valores de
                    // outros blocos, como impostos por item)
                    const icmsTot = xml.getElementsByTagName('ICMSTot')[0] || xml.getElementsByTagName('nfe:ICMSTot')[0];
                    const totalBruto = icmsTot ? (parseFloat(getTagText(icmsTot, 'vProd')) || 0) : parseFloat(itens.reduce((acc, i) => acc + i.total, 0).toFixed(2));
                    const totalDescontos = icmsTot ? (parseFloat(getTagText(icmsTot, 'vDesc')) || 0) : 0;
                    const totalLiquido = icmsTot ? (parseFloat(getTagText(icmsTot, 'vNF')) || 0) : parseFloat((totalBruto - totalDescontos).toFixed(2));

                    resolve({ numeroNf, cnpj, razaoSocial, chaveAcesso, itens, totalBruto, totalDescontos, totalLiquido });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Não foi possível ler o arquivo XML.'));
            reader.readAsText(file);
        });
    }

    // Normaliza a descrição de um item da nota para comparação (maiúsculas, sem acento e sem espaços
    // duplicados/nas pontas). Usada como "chave" para reconhecer que duas linhas são o mesmo produto
    // quando a nota não trouxe EAN - já que nesse caso não dá pra comparar por código de barras.
    function normalizarDescricaoItemNota(desc) {
        return String(desc || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Cadastra rapidamente, direto na Aba 3, um insumo que veio na nota mas ainda não existe no sistema -
    // já com nome, EAN e custo (o estoque só entra de fato quando a compra inteira for confirmada).
    function cadastrarInsumoRapidoDoPdf(itemPdf, umSigla) {
        const novoRef = push(ref(db, 'suprimentos'));
        return set(novoRef, {
            name: itemPdf.descricao,
            barcode: itemPdf.ean !== 'N/A' ? itemPdf.ean : null,
            price: itemPdf.unitario,
            quantity: 0,
            unit: umSigla || '',
            estoqueMinimo: 0
        }).then(() => novoRef.key);
    }

    // Reavalia se as linhas de um determinado grupo (mesmo EAN, ou mesma descrição normalizada quando
    // não há EAN) ainda devem ser tratadas como "duplicadas nesta nota" - chamado sempre que uma
    // descrição é editada, já que isso pode tirar uma linha de um grupo (sobrando só 1) ou juntá-la a
    // outro grupo já existente (passando a ter mais de 1).
    function recalcularGrupoDuplicidade(chave) {
        if (!chave) return;
        const linhasDoGrupo = Array.from(document.querySelectorAll('#compra-itens-lista .linha-item-compra-pdf'))
            .filter(l => l.dataset.grupoChave === chave);
        const ehDuplicado = linhasDoGrupo.length > 1;
        linhasDoGrupo.forEach(l => { if (l._atualizarDuplicidade) l._atualizarDuplicidade(ehDuplicado); });
    }

    // Monta a linha de um item vindo da nota importada, no formato Item / Descrição / EAN / Qtd /
    // Unitário / Total pedido pelo usuário. Por baixo, ela usa os MESMOS campos (.item-compra-insumo,
    // .item-compra-qtd, .item-compra-custo, .item-compra-subtotal) das linhas manuais, então tudo que
    // já existia (cálculo de total, remoção, validação ao salvar) funciona sem precisar duplicar lógica.
    function criarLinhaItemCompraImportado(itemPdf) {
        const div = document.createElement('div');
        div.className = 'linha-item-compra linha-item-compra-pdf';
        div.style.cssText = `display:flex; gap:8px; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; background:var(--bg-soft); padding:8px; border-radius: 3px; border-left:3px solid ${itemPdf.duplicado ? '#bb0000' : '#c05e0a'};`;

        // Chave que identifica o "grupo" ao qual este item pertence dentro da nota: pelo EAN quando ele
        // existe, ou pela descrição normalizada quando não existe. Usada para sincronizar a UM entre
        // linhas do mesmo produto e para saber quando uma edição de descrição tira (ou põe) um item de
        // um grupo de duplicidade.
        function chaveGrupoAtual() {
            return itemPdf.ean !== 'N/A' ? ('EAN:' + itemPdf.ean) : ('DESC:' + normalizarDescricaoItemNota(itemPdf.descricao));
        }
        div.dataset.grupoChave = chaveGrupoAtual();

        // Busca primeiro se o código de barras (EAN) lido na nota já existe cadastrado no nosso sistema
        // (Aba 3 - Estoque de Suprimentos). Compara sempre como texto e ignora zeros à esquerda, pois o
        // mesmo EAN pode estar salvo com formatações levemente diferentes entre a nota e o cadastro.
        const eanDaNota = itemPdf.ean !== 'N/A' ? String(itemPdf.ean).replace(/^0+/, '') : null;
        // Quando a nota não trouxe EAN para este item, cai para comparar pela descrição normalizada
        // contra os insumos já cadastrados - assim um produto sem código de barras que já existe no
        // sistema (ex.: "Morango Kg") é reconhecido automaticamente em vez de pedir novo cadastro.
        const descNormalizadaItem = !eanDaNota ? normalizarDescricaoItemNota(itemPdf.descricao) : null;
        const matched = eanDaNota
            ? Object.entries(allLoadedSuprimentos).find(([, s]) => s.barcode && String(s.barcode).replace(/^0+/, '') === eanDaNota)
            : Object.entries(allLoadedSuprimentos).find(([, s]) => s.name && normalizarDescricaoItemNota(s.name) === descNormalizadaItem);

        const inputInsumoKey = document.createElement('input');
        inputInsumoKey.type = 'hidden';
        inputInsumoKey.className = 'item-compra-insumo';
        inputInsumoKey.value = matched ? matched[0] : '';
        // Permite que OUTRA linha (um item duplicado com o mesmo EAN) atualize esta linha depois que
        // o insumo for cadastrado por lá, sem precisar cadastrar de novo aqui - veja o handler do botão
        // "Cadastrar Insumo" mais abaixo.
        inputInsumoKey.addEventListener('insumo-vinculado', () => renderDescArea());

        // Guarda a descrição e o EAN exatamente como vieram da nota para que, ao confirmar a compra,
        // o cadastro do insumo (nome e código de barras) seja atualizado automaticamente junto com o
        // preço de custo - tanto para itens já existentes (identificados pelo EAN) quanto para os que
        // acabaram de ser cadastrados agora pela nota.
        const inputDescricaoNota = document.createElement('input');
        inputDescricaoNota.type = 'hidden';
        inputDescricaoNota.className = 'item-compra-descricao-nota';
        inputDescricaoNota.value = itemPdf.descricao;

        const inputEanNota = document.createElement('input');
        inputEanNota.type = 'hidden';
        inputEanNota.className = 'item-compra-ean-nota';
        inputEanNota.value = itemPdf.ean !== 'N/A' ? itemPdf.ean : '';

        const inputItemNum = document.createElement('input');
        inputItemNum.type = 'text';
        inputItemNum.readOnly = true;
        inputItemNum.value = `#${itemPdf.itemNum}`;
        inputItemNum.style.cssText = 'flex:0 0 55px; margin:0; font-family:var(--font-mono); font-weight:700; color:var(--text-muted); font-size:9.5pt; text-align:center; background:var(--bg-surface);';

        const descWrapper = document.createElement('div');
        descWrapper.style.cssText = 'flex:2 1 190px; display:flex; flex-direction:column; gap:4px;';

        const inputDescricao = document.createElement('input');
        inputDescricao.type = 'text';
        inputDescricao.value = itemPdf.descricao;
        inputDescricao.title = 'Você pode editar a descrição deste item.';
        inputDescricao.style.cssText = 'width:100%; margin:0; font-size:9.5pt; font-weight:600;';

        const descStatus = document.createElement('div');

        // Checkbox pra itens que vêm na mesma nota mas não são matéria-prima (ex.: jarra, guardanapo,
        // organizador) - permite registrar o item na compra (valor, histórico) sem exigir cadastro de
        // insumo nem dar entrada em estoque.
        const labelSemEstoque = document.createElement('label');
        labelSemEstoque.style.cssText = 'display:flex; align-items:center; gap:5px; font-size:7.8pt; color:var(--text-muted); cursor:pointer; margin-top:2px;';
        const inputSemEstoque = document.createElement('input');
        inputSemEstoque.type = 'checkbox';
        inputSemEstoque.className = 'item-compra-sem-estoque';
        inputSemEstoque.style.cssText = 'margin:0; cursor:pointer;';
        labelSemEstoque.appendChild(inputSemEstoque);
        labelSemEstoque.appendChild(document.createTextNode('Não é matéria-prima (não dá entrada em estoque)'));
        inputSemEstoque.addEventListener('change', () => renderDescArea());

        const inputEan = document.createElement('input');
        inputEan.type = 'text';
        inputEan.readOnly = true;
        inputEan.value = itemPdf.ean !== 'N/A' ? itemPdf.ean : '--';
        inputEan.style.cssText = 'flex:1 1 100px; margin:0; font-family:var(--font-mono); font-size:9.5pt; color:var(--text-muted); background:var(--bg-surface);';

        // Lista suspensa de Unidade de Medida (UM). Vem pré-selecionada com a UM do insumo já
        // cadastrado (quando identificado pelo EAN) ou, senão, com a UM lida da própria nota - mas o
        // usuário pode trocar livremente, e a escolha feita aqui é usada tanto ao cadastrar um insumo
        // novo quanto ao confirmar a compra (atualiza a UM do insumo já existente).
        const selectUm = document.createElement('select');
        selectUm.className = 'item-compra-um-nota';
        selectUm.style.cssText = 'flex:1 1 70px; margin:0; font-size:9.5pt;';
        const umSiglas = Array.from(new Set(Object.values(allLoadedUMs).map(u => u.sigla).filter(Boolean)));
        umSiglas.forEach(sigla => {
            const opt = document.createElement('option');
            opt.value = sigla; opt.innerText = sigla;
            selectUm.appendChild(opt);
        });
        const umDoInsumoExistente = matched ? matched[1].unit : null;
        const umDaNota = umSiglas.find(s => s.toLowerCase() === (itemPdf.um || '').toLowerCase());
        selectUm.value = umDoInsumoExistente || umDaNota || umSiglas[0] || '';

        // Ao trocar a UM deste item, replica a escolha para as outras linhas do mesmo grupo (mesmo
        // produto - por EAN ou por descrição) desta nota, para que nunca fiquem com UM diferente entre
        // si por descuido.
        selectUm.addEventListener('change', () => {
            const chave = div.dataset.grupoChave;
            document.querySelectorAll('#compra-itens-lista .linha-item-compra-pdf').forEach(outraLinha => {
                if (outraLinha === div || outraLinha.dataset.grupoChave !== chave) return;
                const outroSelect = outraLinha.querySelector('.item-compra-um-nota');
                if (outroSelect && outroSelect.value !== selectUm.value) outroSelect.value = selectUm.value;
            });
        });

        const inputQtd = document.createElement('input');
        inputQtd.type = 'number'; inputQtd.min = '0.0001'; inputQtd.step = 'any';
        inputQtd.className = 'item-compra-qtd';
        inputQtd.value = itemPdf.qtd;
        inputQtd.readOnly = true;
        inputQtd.style.cssText = 'flex:1 1 65px; margin:0; font-size:9.5pt; background:var(--bg-surface); color:var(--text-muted);';

        const inputCusto = document.createElement('input');
        inputCusto.type = 'number'; inputCusto.min = '0'; inputCusto.step = '0.01';
        inputCusto.className = 'item-compra-custo';
        inputCusto.value = itemPdf.unitario.toFixed(2);
        inputCusto.title = 'Valor unitário BRUTO deste item, exatamente como está na nota fiscal. Você pode editar se precisar corrigir algo.';
        inputCusto.style.cssText = 'flex:1 1 75px; margin:0; font-size:9.5pt;';

        const { wrapper: descontoWrapper, inputDesconto, selectTipo: selectDescontoTipo } = criarCamposDescontoItem();
        descontoWrapper.style.flex = '1 1 110px';

        const spanBruto = document.createElement('span');
        spanBruto.className = 'item-compra-bruto';
        spanBruto.title = 'Valor Bruto (quantidade × unitário, sem desconto) - o mesmo valor que aparece na nota fiscal.';
        spanBruto.style.cssText = 'flex:1 1 75px; font-weight:600; color:var(--text-muted); font-size:9pt; text-align:right; padding-top:9px;';

        const spanSubtotal = document.createElement('span');
        spanSubtotal.className = 'item-compra-subtotal';
        spanSubtotal.title = 'Valor Líquido (após o desconto informado) - é este valor que atualiza o custo do insumo no estoque/produção.';
        spanSubtotal.style.cssText = 'flex:1 1 80px; font-weight:700; color:var(--text-strong); font-size:9.5pt; text-align:right; padding-top:9px;';

        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.innerText = '✕';
        btnRemover.title = 'Remover item';
        btnRemover.className = 'btn-action-prod btn-delete-prod';
        btnRemover.style.cssText = 'flex:0 0 auto; padding:6px 10px;';
        btnRemover.addEventListener('click', () => { div.remove(); recalcularTotalCompra(); });

        function recalcularSubtotalItem() {
            const calc = calcularCustoLiquidoItem(div);
            spanBruto.innerText = `R$ ${formatMoeda(calc.brutoTotal)}`;
            spanSubtotal.innerText = `R$ ${formatMoeda(calc.liquidoTotal)}`;
            // Destaca em verde quando há desconto aplicado, pra ficar visualmente claro que o custo
            // que vai pro estoque é menor que o valor bruto/oficial da nota.
            spanSubtotal.style.color = calc.descontoUnitario > 0 ? 'var(--color-positive)' : 'var(--text-strong)';
            recalcularTotalCompra();
        }
        inputQtd.addEventListener('input', recalcularSubtotalItem);
        inputCusto.addEventListener('input', recalcularSubtotalItem);
        inputDesconto.addEventListener('input', recalcularSubtotalItem);
        selectDescontoTipo.addEventListener('change', recalcularSubtotalItem);

        // Ao editar manualmente o valor unitário OU o desconto deste item, replica para as outras
        // linhas do mesmo grupo (mesmo produto - por EAN ou por descrição) desta nota - mesmo produto
        // costuma ter o mesmo preço/desconto por unidade de medida em todas as ocorrências na nota,
        // então mantém todas sempre iguais, do mesmo jeito que já acontece com a UM.
        function sincronizarComGrupo(origem, seletor) {
            const chave = div.dataset.grupoChave;
            document.querySelectorAll('#compra-itens-lista .linha-item-compra-pdf').forEach(outraLinha => {
                if (outraLinha === div || outraLinha.dataset.grupoChave !== chave) return;
                const outroCampo = outraLinha.querySelector(seletor);
                if (outroCampo && outroCampo.value !== origem.value) {
                    outroCampo.value = origem.value;
                    outroCampo.dispatchEvent(new Event('input'));
                }
            });
        }
        inputCusto.addEventListener('change', () => sincronizarComGrupo(inputCusto, '.item-compra-custo'));
        inputDesconto.addEventListener('change', () => sincronizarComGrupo(inputDesconto, '.item-compra-desconto-valor'));
        selectDescontoTipo.addEventListener('change', () => sincronizarComGrupo(selectDescontoTipo, '.item-compra-desconto-tipo'));


        function renderDescArea() {
            // IMPORTANTE: monta todo o HTML numa única variável e faz UMA só atribuição a
            // descStatus.innerHTML no final. Antes, o aviso de duplicidade era acrescentado com
            // `descStatus.innerHTML += ...`, e isso reserializa e recria TODOS os elementos que já
            // estavam dentro de descStatus - inclusive o botão "Cadastrar Insumo" que tinha acabado de
            // receber um addEventListener. O clique parava de funcionar exatamente nos itens duplicados,
            // porque o botão visível na tela já não era mais o mesmo elemento que tinha o listener.
            let html = '';
            if (inputSemEstoque.checked) {
                html = `<span style="font-size:8pt; color:#085caf;">Material de uso - será registrado nesta compra, sem dar entrada em estoque</span>`;
            } else if (inputInsumoKey.value) {
                html = `<span style="font-size:8pt; color:var(--color-positive);">${matched && matched[0] === inputInsumoKey.value ? 'Produto cadastrado' : 'Cadastrado agora'}</span>`;
            } else {
                html = `
                    <span style="font-size:8pt; color:var(--color-negative);">Este item não existe no sistema</span><br>
                    <button type="button" class="btn-cadastrar-insumo-pdf" style="margin-top:4px; padding:3px 9px; font-size:8pt; border:none; border-radius:4px; background:#c05e0a; color:#fff; cursor:pointer; font-weight:600;">➕ Cadastrar Insumo</button>
                `;
            }
            if (itemPdf.duplicado) {
                const avisoDuplicidade = itemPdf.ean !== 'N/A'
                    ? 'Este EAN aparece mais de uma vez nesta nota'
                    : 'Este produto aparece mais de uma vez nesta nota (sem EAN)';
                html += `<br><span style="font-size:7.5pt; color:var(--color-negative);">🔁 ${avisoDuplicidade} - confira se não é duplicidade.</span>`;
            }
            descStatus.innerHTML = html;

            if (!inputSemEstoque.checked && !inputInsumoKey.value) {
                descStatus.querySelector('.btn-cadastrar-insumo-pdf').addEventListener('click', () => {
                    cadastrarInsumoRapidoDoPdf(itemPdf, selectUm.value).then(novoKey => {
                        inputInsumoKey.value = novoKey;
                        renderDescArea();

                        // Este mesmo produto pode aparecer em outras linhas da nota (EAN duplicado -
                        // ver aviso 🔁). Em vez de deixar o usuário clicar em "Cadastrar Insumo" de novo
                        // em cada uma (o que criaria um insumo repetido pra cada clique), vincula direto
                        // todas as outras linhas ainda não vinculadas com o mesmo EAN a este mesmo insumo.
                        let linkedCount = 0;
                        if (itemPdf.ean !== 'N/A') {
                            document.querySelectorAll('#compra-itens-lista .linha-item-compra-pdf').forEach(outraLinha => {
                                if (outraLinha === div) return;
                                const outroEanInput = outraLinha.querySelector('.item-compra-ean-nota');
                                const outroInsumoInput = outraLinha.querySelector('.item-compra-insumo');
                                if (outroEanInput && outroInsumoInput && outroEanInput.value === itemPdf.ean && !outroInsumoInput.value) {
                                    outroInsumoInput.value = novoKey;
                                    outroInsumoInput.dispatchEvent(new Event('insumo-vinculado'));
                                    linkedCount++;
                                }
                            });
                        } else {
                            // Item sem EAN na nota: usa a descrição normalizada para vincular outras
                            // linhas do mesmo produto (mesmo caso do EAN duplicado acima, mas aqui não
                            // há código de barras pra comparar).
                            const descNormalizada = normalizarDescricaoItemNota(itemPdf.descricao);
                            document.querySelectorAll('#compra-itens-lista .linha-item-compra-pdf').forEach(outraLinha => {
                                if (outraLinha === div) return;
                                const outroDescInput = outraLinha.querySelector('.item-compra-descricao-nota');
                                const outroEanInput = outraLinha.querySelector('.item-compra-ean-nota');
                                const outroInsumoInput = outraLinha.querySelector('.item-compra-insumo');
                                if (outroDescInput && outroEanInput && outroInsumoInput
                                    && outroEanInput.value === ''
                                    && normalizarDescricaoItemNota(outroDescInput.value) === descNormalizada
                                    && !outroInsumoInput.value) {
                                    outroInsumoInput.value = novoKey;
                                    outroInsumoInput.dispatchEvent(new Event('insumo-vinculado'));
                                    linkedCount++;
                                }
                            });
                        }

                        const msgVinculo = linkedCount > 0
                            ? ` Este produto aparece ${linkedCount + 1}x nesta nota - todas as ocorrências foram vinculadas ao mesmo insumo, sem duplicar o cadastro.`
                            : '';
                        showAlert(`Insumo "${itemPdf.descricao}" cadastrado na Aba 3. Ele já está vinculado a este item da compra.${msgVinculo}`, 'success');
                    }).catch(err => showAlert('Erro ao cadastrar o insumo: ' + err.message, 'danger'));
                });
            }
        }
        renderDescArea();

        // Permite atualizar visualmente (borda + aviso) se este item deve ou não ser tratado como
        // duplicado, chamado por recalcularGrupoDuplicidade() quando uma edição de descrição muda a
        // composição do grupo (seja este item ou outro do mesmo grupo).
        div._atualizarDuplicidade = function (novoDuplicado) {
            if (itemPdf.duplicado === novoDuplicado) return;
            itemPdf.duplicado = novoDuplicado;
            div.style.borderLeftColor = novoDuplicado ? '#bb0000' : '#c05e0a';
            renderDescArea();
        };

        // Descrição editável: permite corrigir o texto vindo da nota tanto para itens já reconhecidos
        // no sistema quanto para os que ainda serão cadastrados. Dispara em 'change' (ao sair do campo),
        // não a cada tecla digitada.
        let descricaoAnterior = itemPdf.descricao;
        function aplicarNovaDescricao(novaDescricao) {
            const chaveAntiga = div.dataset.grupoChave;
            itemPdf.descricao = novaDescricao;
            inputDescricaoNota.value = novaDescricao;
            descricaoAnterior = novaDescricao;
            const chaveNova = chaveGrupoAtual();
            div.dataset.grupoChave = chaveNova;
            // Reavalia a duplicidade tanto do grupo que este item pode ter deixado (pode sobrar só 1)
            // quanto do grupo que ele pode ter passado a integrar (pode juntar com outro item já existente).
            recalcularGrupoDuplicidade(chaveAntiga);
            recalcularGrupoDuplicidade(chaveNova);
            // Se passou a fazer parte de um grupo com outro item já presente na nota, herda a UM desse
            // grupo, para manter os dois sempre com a mesma UM.
            const outroDoGrupo = Array.from(document.querySelectorAll('#compra-itens-lista .linha-item-compra-pdf'))
                .find(outra => outra !== div && outra.dataset.grupoChave === chaveNova);
            if (outroDoGrupo) {
                const outroSelect = outroDoGrupo.querySelector('.item-compra-um-nota');
                if (outroSelect) selectUm.value = outroSelect.value;
            }
        }
        inputDescricao.addEventListener('change', () => {
            const novaDescricaoBruta = inputDescricao.value.trim();
            if (!novaDescricaoBruta) { inputDescricao.value = descricaoAnterior; return; }
            if (novaDescricaoBruta === descricaoAnterior) return;

            // Só precisa confirmar quando esta edição vai FAZER este item deixar de ser reconhecido
            // como duplicado (item sem EAN, marcado como duplicado, e a nova descrição não bate com
            // nenhuma outra linha ainda no mesmo grupo).
            const vaiPerderDuplicidade = itemPdf.ean === 'N/A' && itemPdf.duplicado &&
                !Array.from(document.querySelectorAll('#compra-itens-lista .linha-item-compra-pdf'))
                    .some(outra => outra !== div && outra.dataset.grupoChave === ('DESC:' + normalizarDescricaoItemNota(novaDescricaoBruta)));

            if (vaiPerderDuplicidade) {
                showConfirm(
                    `Alterar a descrição deste item vai fazer com que ele deixe de ser reconhecido como o mesmo produto "${itemPdf.descricao}" que aparece em outra(s) linha(s) desta nota, removendo o aviso de duplicidade dele. Deseja continuar?`,
                    'warning', 'Remover aviso de duplicidade?'
                ).then(ok => {
                    if (ok) aplicarNovaDescricao(novaDescricaoBruta);
                    else inputDescricao.value = descricaoAnterior;
                });
            } else {
                aplicarNovaDescricao(novaDescricaoBruta);
            }
        });

        descWrapper.appendChild(inputDescricao);
        descWrapper.appendChild(descStatus);
        descWrapper.appendChild(labelSemEstoque);

        div.appendChild(inputItemNum);
        div.appendChild(descWrapper);
        div.appendChild(inputEan);
        div.appendChild(selectUm);
        div.appendChild(inputQtd);
        div.appendChild(inputCusto);
        div.appendChild(descontoWrapper);
        div.appendChild(spanBruto);
        div.appendChild(spanSubtotal);
        div.appendChild(btnRemover);
        div.appendChild(inputInsumoKey);
        div.appendChild(inputDescricaoNota);
        div.appendChild(inputEanNota);

        recalcularSubtotalItem();
        return div;
    }

    // Cabeçalho de colunas mostrado só acima dos itens importados (as linhas manuais continuam com o
    // layout simples de sempre - select + qtd + custo - sem nenhuma mudança).
    function criarCabecalhoItensImportados() {
        const div = document.createElement('div');
        div.id = 'compra-itens-pdf-header';
        div.style.cssText = 'display:flex; gap:8px; padding:0 8px 4px; font-size:10pt; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.3px;';
        div.innerHTML = `
            <span style="flex:0 0 55px; text-align:center;">Item</span>
            <span style="flex:2 1 170px;">Descrição</span>
            <span style="flex:1 1 90px;">EAN</span>
            <span style="flex:1 1 60px;">UM</span>
            <span style="flex:1 1 55px;">Qtd.</span>
            <span style="flex:1 1 75px;">Unit. Bruto</span>
            <span style="flex:1 1 110px;">Desconto</span>
            <span style="flex:1 1 75px; text-align:right;">Bruto</span>
            <span style="flex:1 1 80px; text-align:right;">Líquido</span>
        `;
        return div;
    }

    // Aplica no formulário tudo o que foi extraído do PDF: CNPJ (dispara a mesma busca/cadastro
    // rápido de fornecedor já usada manualmente), itens, e os totais oficiais da nota.
    function aplicarDadosNotaImportada(dados) {
        notaFiscalImportadaAtual = dados;

        if (dados.cnpj) {
            document.getElementById('compra-fornecedor-cnpj').value = dados.cnpj;
            document.getElementById('compra-fornecedor-cnpj').dispatchEvent(new Event('blur'));
        }

        const listaItens = document.getElementById('compra-itens-lista');
        listaItens.innerHTML = '';
        listaItens.appendChild(criarCabecalhoItensImportados());
        dados.itens.forEach(item => listaItens.appendChild(criarLinhaItemCompraImportado(item)));

        document.getElementById('compra-total-linha-simples').style.display = 'none';
        document.getElementById('compra-total-nota-importada').style.display = 'block';
        document.getElementById('compra-nota-bruto').innerText = `R$ ${formatMoeda(dados.totalBruto)}`;
        document.getElementById('compra-nota-descontos').innerText = `R$ ${formatMoeda(dados.totalDescontos)}`;
        document.getElementById('compra-nota-liquido').innerText = `R$ ${formatMoeda(dados.totalLiquido)}`;

        // Nota fiscal importada: some a opção de adicionar item manualmente, para o usuário não incluir
        // um item que não veio na NF. A lista de itens passa a refletir só o que está na nota.
        document.getElementById('btn-add-item-compra').style.display = 'none';

        if (dados.numeroNf || dados.razaoSocial || dados.chaveAcesso) {
            document.getElementById('compra-nota-info-bar').style.display = 'flex';
            document.getElementById('compra-nota-numero').value = dados.numeroNf || '--';
            document.getElementById('compra-nota-razao').value = dados.razaoSocial || '--';
            document.getElementById('compra-nota-chave').value = dados.chaveAcesso || '--';
        }

        recalcularTotalCompra();
    }

    document.getElementById('btn-importar-nfce').addEventListener('click', () => document.getElementById('input-pdf-nfce').click());

    document.getElementById('input-pdf-nfce').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('input-xml-nfce').value = ''; // limpa a outra entrada
        const statusEl = document.getElementById('pdf-import-status');
        statusEl.innerText = 'Lendo a nota fiscal...';
        try {
            const dados = await processarPdfNotaFiscal(file);
            aplicarDadosNotaImportada(dados);
            statusEl.innerText = `${dados.itens.length} item(ns) importado(s) da NF nº ${dados.numeroNf || '?'} (PDF).`;
        } catch (err) {
            console.error('Erro ao ler PDF da nota fiscal:', err);
            statusEl.innerText = '';
            showAlert('Não foi possível ler os dados desta nota em PDF. Verifique se o arquivo é uma NFC-e/NF-e válida, ou preencha a compra manualmente.', 'danger');
        }
        e.target.value = '';
    });

    document.getElementById('btn-importar-nfce-xml').addEventListener('click', () => document.getElementById('input-xml-nfce').click());

    document.getElementById('input-xml-nfce').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('input-pdf-nfce').value = ''; // limpa a outra entrada
        const statusEl = document.getElementById('pdf-import-status');
        statusEl.innerText = 'Lendo o XML da nota fiscal...';
        try {
            const dados = await processarXmlNotaFiscal(file);
            aplicarDadosNotaImportada(dados);
            statusEl.innerText = `${dados.itens.length} item(ns) importado(s) da NF nº ${dados.numeroNf || '?'} (XML).`;
        } catch (err) {
            console.error('Erro ao ler XML da nota fiscal:', err);
            statusEl.innerText = '';
            showAlert('Não foi possível ler os dados deste XML. Verifique se o arquivo é o XML oficial de uma NFC-e/NF-e, ou preencha a compra manualmente.', 'danger');
        }
        e.target.value = '';
    });

    // ----- MODAL NOVA COMPRA: LINHAS DE PAGAMENTO (ABATIMENTO NAS CONTAS) -----
    function criarLinhaPagamentoCompra() {
        const div = document.createElement('div');
        div.className = 'linha-pagamento-compra';
        div.style.cssText = 'display:flex; gap:8px; align-items:flex-end; margin-bottom:8px; flex-wrap:wrap; background:var(--bg-soft); padding:8px; border-radius: 3px;';

        const selectConta = document.createElement('select');
        selectConta.className = 'pagamento-compra-conta';
        selectConta.style.cssText = 'flex:2 1 160px; margin:0;';
        selectConta.innerHTML = '<option value="">-- Selecione a Conta --</option>' +
            Object.keys(allLoadedContas).map(key => `<option value="${key}">${allLoadedContas[key].name} (Saldo: R$ ${formatMoeda(parseFloat(allLoadedContas[key].saldo || 0))})</option>`).join('');

        const inputValor = document.createElement('input');
        inputValor.type = 'number'; inputValor.min = '0.01'; inputValor.step = '0.01'; inputValor.placeholder = 'Valor (R$)';
        inputValor.className = 'pagamento-compra-valor';
        inputValor.style.cssText = 'flex:1 1 110px; margin:0;';
        inputValor.addEventListener('input', recalcularRestantePagamento);
        selectConta.addEventListener('change', recalcularRestantePagamento);

        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.innerText = '✕';
        btnRemover.title = 'Remover forma de pagamento';
        btnRemover.className = 'btn-action-prod btn-delete-prod';
        btnRemover.style.cssText = 'flex:0 0 auto; padding:6px 10px;';
        btnRemover.addEventListener('click', () => { div.remove(); recalcularRestantePagamento(); });

        div.appendChild(selectConta);
        div.appendChild(inputValor);
        div.appendChild(btnRemover);
        return div;
    }

    document.getElementById('btn-add-pagamento-compra').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('compra-pagamentos-lista').appendChild(criarLinhaPagamentoCompra());
    });

    function getValorTotalPagamentosAtual() {
        let total = 0;
        document.querySelectorAll('#compra-pagamentos-lista .linha-pagamento-compra').forEach(row => {
            total += parseFloat(row.querySelector('.pagamento-compra-valor').value) || 0;
        });
        return parseFloat(total.toFixed(2));
    }

    function recalcularRestantePagamento() {
        const totalCompra = getValorTotalCompraAtual();
        const totalPago = getValorTotalPagamentosAtual();
        const restante = parseFloat((totalCompra - totalPago).toFixed(2));
        const hint = document.getElementById('compra-restante-hint');
        if (Math.abs(restante) < 0.005) {
            hint.style.color = 'var(--color-positive)';
            hint.innerText = totalCompra > 0 ? 'Valor da compra totalmente alocado nas contas escolhidas.' : '';
        } else if (restante > 0) {
            hint.style.color = 'var(--color-negative)';
            hint.innerText = `Ainda falta alocar R$ ${formatMoeda(restante)} entre as contas de pagamento.`;
        } else {
            hint.style.color = 'var(--color-negative)';
            hint.innerText = `O valor alocado nas contas excede o total da compra em R$ ${formatMoeda(Math.abs(restante))}.`;
        }
    }

    // ----- ABERTURA DO MODAL NOVA COMPRA -----
    setupModalEvents(null, 'modal-nova-compra', 'close-modal-nova-compra');

    function resetFormNovaCompra() {
        document.getElementById('form-nova-compra').reset();
        document.getElementById('compra-data').value = dataISOparaBR(formatDateInputValue(new Date()));
        document.getElementById('compra-fornecedor-cnpj').dataset.fornecedorKey = '';
        document.getElementById('compra-fornecedor-nome').value = '';
        document.getElementById('compra-fornecedor-nome').dataset.fornecedorKey = '';
        document.getElementById('compra-sem-cnpj').checked = false;
        atualizarModoCompraSemCnpj();
        document.getElementById('compra-itens-lista').innerHTML = '';
        document.getElementById('compra-pagamentos-lista').innerHTML = '';
        document.getElementById('compra-itens-lista').appendChild(criarLinhaItemCompra());
        document.getElementById('compra-pagamentos-lista').appendChild(criarLinhaPagamentoCompra());
        document.getElementById('btn-add-item-compra').style.display = 'inline-block';

        // Volta pro modo padrão "à vista" e limpa qualquer vínculo com Pedido de Compra
        document.querySelectorAll('.compra-condicao-btn').forEach(b => b.classList.remove('ativo'));
        document.querySelector('.compra-condicao-btn[data-condicao="avista"]').classList.add('ativo');
        document.getElementById('compra-condicao-pagamento').value = 'avista';
        document.getElementById('compra-bloco-avista').style.display = '';
        document.getElementById('compra-bloco-prazo').style.display = 'none';
        document.getElementById('compra-data-vencimento').value = '';
        document.getElementById('compra-pedido-vinculado-key').value = '';
        document.getElementById('compra-pedido-vinculado-aviso').style.display = 'none';
        intencaoComprasSubviewAoSalvar = null;

        // Limpa qualquer nota fiscal importada de uma abertura anterior deste modal
        notaFiscalImportadaAtual = null;
        document.getElementById('pdf-import-status').innerText = '';
        document.getElementById('input-pdf-nfce').value = '';
        document.getElementById('input-xml-nfce').value = '';
        document.getElementById('compra-nota-info-bar').style.display = 'none';
        document.getElementById('compra-total-nota-importada').style.display = 'none';
        document.getElementById('compra-total-linha-simples').style.display = 'flex';

        recalcularTotalCompra();
    }

    document.getElementById('btn-trigger-modal-nova-compra').addEventListener('click', () => {
        if (Object.keys(allLoadedContas).length === 0) {
            showAlert('Não há nenhuma conta cadastrada. Cadastre uma conta na Aba 6 - Caixa antes de registrar uma compra.', 'warning');
            return;
        }
        resetFormNovaCompra();
        document.getElementById('modal-nova-compra').style.display = 'flex';
    });

    // ----- SUBMISSÃO DA NOVA COMPRA: abate das contas escolhidas e dá entrada no estoque -----
    document.getElementById('form-nova-compra').addEventListener('submit', (e) => {
        e.preventDefault();

        const fornecedorCnpjInput = document.getElementById('compra-fornecedor-cnpj');
        const fornecedorCnpjDigitado = fornecedorCnpjInput.value.trim();
        const fornecedorNomeInput = document.getElementById('compra-fornecedor-nome');
        const fornecedorNome = fornecedorNomeInput.value.trim();
        const compraSemCnpj = document.getElementById('compra-sem-cnpj').checked;
        let fornecedorKey = compraSemCnpj
            ? (fornecedorNomeInput.dataset.fornecedorKey || fornecedorCnpjInput.dataset.fornecedorKey || '')
            : (fornecedorCnpjInput.dataset.fornecedorKey || '');

        if (!compraSemCnpj) {
            if (!normalizeCnpj(fornecedorCnpjDigitado)) {
                showAlert('Informe o CNPJ do fornecedor antes de registrar a compra.', 'warning');
                fornecedorCnpjInput.focus();
                return;
            }
            if (!fornecedorKey || !fornecedorNome) {
                showAlert('Fornecedor não identificado. Clique fora do campo de CNPJ para localizá-lo ou cadastrá-lo antes de continuar.', 'warning');
                fornecedorCnpjInput.focus();
                return;
            }
        } else {
            // Compra sem CNPJ (fornecedor informal): exige apenas o nome digitado. O CPF/CNPJ é opcional
            // e, se informado e já vinculado a um fornecedor cadastrado, o registro usa esse cadastro normalmente.
            if (!fornecedorNome) {
                showAlert('Informe o nome do fornecedor/vendedor antes de registrar a compra.', 'warning');
                fornecedorNomeInput.focus();
                return;
            }
        }

        const data = dataBRparaISO(document.getElementById('compra-data').value);
        if (!data) { showAlert('Informe a data da compra.', 'warning'); return; }

        // Monta a lista de itens comprados a partir das linhas dinâmicas
        const itens = [];
        let itemInvalido = false;
        document.querySelectorAll('#compra-itens-lista .linha-item-compra').forEach(row => {
            const semEstoqueEl = row.querySelector('.item-compra-sem-estoque');
            const semEstoque = !!(semEstoqueEl && semEstoqueEl.checked);
            const insumoKey = row.querySelector('.item-compra-insumo').value;
            const descricaoNotaEl = row.querySelector('.item-compra-descricao-nota');
            const eanNotaEl = row.querySelector('.item-compra-ean-nota');
            const umNotaEl = row.querySelector('.item-compra-um-nota');
            const descricaoNota = descricaoNotaEl ? descricaoNotaEl.value.trim() : '';
            const eanNota = eanNotaEl ? eanNotaEl.value.trim() : '';
            const umNota = umNotaEl ? umNotaEl.value.trim() : '';

            // custoUnitario aqui já é o valor LÍQUIDO (pós-desconto) por unidade - é ele que atualiza
            // o custo do insumo no estoque e entra nas Ordens de Produção/análises. O valor BRUTO (o
            // que está escrito na nota) e o desconto aplicado ficam guardados à parte, só pra histórico
            // e conferência - não afetam nenhum cálculo de custo daqui pra frente.
            const calc = calcularCustoLiquidoItem(row);
            const { qtd: quantidade, unitarioBruto, descontoValor, descontoTipo, descontoUnitario, custoLiquidoUnitario: custoUnitario, liquidoTotal: subtotal } = calc;

            if (isNaN(quantidade) || quantidade <= 0 || isNaN(unitarioBruto) || unitarioBruto < 0) {
                itemInvalido = true;
                return;
            }

            if (semEstoque) {
                // Item marcado como "não é matéria-prima": não precisa de insumo cadastrado nem de EAN -
                // só exige uma descrição pra identificar o que foi comprado no histórico da compra.
                if (!descricaoNota) { itemInvalido = true; return; }
                itens.push({
                    insumoKey: null, insumoNome: descricaoNota, unidade: umNota || '',
                    quantidade, custoUnitario, unitarioBruto, descontoValor, descontoTipo, descontoUnitario,
                    subtotal, descricaoNota, eanNota, umNota, semEstoque: true
                });
                return;
            }

            if (!insumoKey) { itemInvalido = true; return; }
            const insumo = allLoadedSuprimentos[insumoKey];
            if (!insumo) { itemInvalido = true; return; }
            itens.push({
                insumoKey, insumoNome: descricaoNota || insumo.name, unidade: umNota || insumo.unit || '',
                quantidade, custoUnitario, unitarioBruto, descontoValor, descontoTipo, descontoUnitario,
                subtotal, descricaoNota, eanNota, umNota, semEstoque: false
            });
        });

        if (itemInvalido || itens.length === 0) { showAlert('Preencha corretamente todos os itens da compra (insumo ou descrição, quantidade e custo unitário). Se você acabou de cadastrar um insumo pela nota importada, aguarde um instante e tente novamente.', 'warning'); return; }

        const condicaoPagamento = document.getElementById('compra-condicao-pagamento').value; // 'avista' | 'prazo'
        const pedidoCompraKeyVinculado = document.getElementById('compra-pedido-vinculado-key').value || null;
        let dataVencimentoCompra = null;

        if (condicaoPagamento === 'prazo') {
            dataVencimentoCompra = dataBRparaISO(document.getElementById('compra-data-vencimento').value);
            if (!dataVencimentoCompra) { showAlert('Informe a data de vencimento para uma compra a prazo.', 'warning'); return; }
            if (dataVencimentoCompra < data) { showAlert('A data de vencimento não pode ser anterior à data da compra.', 'warning'); return; }
        }

        // Monta a lista de contas que vão pagar essa compra - só se aplica no modo "à vista", já que
        // uma compra "a prazo" não abate conta nenhuma agora (isso só acontece quando alguém der baixa).
        const pagamentos = [];
        let pagamentoInvalido = false;
        if (condicaoPagamento === 'avista') {
            document.querySelectorAll('#compra-pagamentos-lista .linha-pagamento-compra').forEach(row => {
                const contaKey = row.querySelector('.pagamento-compra-conta').value;
                const valor = parseFloat(row.querySelector('.pagamento-compra-valor').value);
                if (!contaKey || isNaN(valor) || valor <= 0) { pagamentoInvalido = true; return; }
                pagamentos.push({ contaKey, contaNome: allLoadedContas[contaKey].name, valor: parseFloat(valor.toFixed(2)) });
            });
        }

        if (condicaoPagamento === 'avista' && (pagamentoInvalido || pagamentos.length === 0)) { showAlert('Selecione ao menos uma conta válida para abater o valor da compra, com um valor informado.', 'warning'); return; }

        // Contas repetidas na mesma compra são somadas para simplificar a validação e a execução
        const pagamentosPorConta = {};
        pagamentos.forEach(p => { pagamentosPorConta[p.contaKey] = (pagamentosPorConta[p.contaKey] || 0) + p.valor; });
        const pagamentosConsolidados = Object.keys(pagamentosPorConta).map(contaKey => ({ contaKey, contaNome: allLoadedContas[contaKey].name, valor: parseFloat(pagamentosPorConta[contaKey].toFixed(2)) }));

        const valorTotalCompraFinal = getValorTotalCompraAtual();
        const valorTotalPagamentos = parseFloat(pagamentosConsolidados.reduce((acc, p) => acc + p.valor, 0).toFixed(2));

        if (condicaoPagamento === 'avista' && Math.abs(valorTotalCompraFinal - valorTotalPagamentos) > 0.01) {
            showAlert(`O total da compra (R$ ${formatMoeda(valorTotalCompraFinal)}) precisa ser igual ao total distribuído entre as contas de pagamento (R$ ${formatMoeda(valorTotalPagamentos)}). Ajuste os valores antes de confirmar.`, 'warning');
            return;
        }

        const executarCompra = () => {
            const timestamp = Date.now();
            const compraRef = push(ref(db, 'comprasSuprimentos'));
            const promessas = [];
            const movimentacoesKeys = [];

            // Dá entrada no estoque de cada insumo comprado e atualiza o custo comercial de referência.
            // Quando o MESMO insumo aparece em mais de uma linha da compra (ex.: produto duplicado na
            // nota, ambas as linhas vinculadas ao mesmo insumo), as quantidades são somadas antes de
            // calcular o novo estoque - senão a segunda atualização sobrescreveria a primeira e uma das
            // ocorrências do produto nunca entraria de fato no estoque.
            const dadosPorInsumo = {};
            itens.forEach(it => {
                // Itens marcados como "não é matéria-prima" ficam só registrados no histórico da compra -
                // não têm insumo vinculado e não devem mexer em estoque nenhum.
                if (it.semEstoque || !it.insumoKey) return;
                if (!dadosPorInsumo[it.insumoKey]) dadosPorInsumo[it.insumoKey] = { somaQuantidade: 0 };
                dadosPorInsumo[it.insumoKey].somaQuantidade += it.quantidade;
                dadosPorInsumo[it.insumoKey].custoUnitario = it.custoUnitario;
                // Item veio de uma nota fiscal importada (achado pelo EAN ou cadastrado agora a partir
                // dela): atualiza também a descrição e o código de barras automaticamente, mantendo o
                // cadastro do insumo sempre alinhado com o que vem na nota.
                if (it.descricaoNota) dadosPorInsumo[it.insumoKey].descricaoNota = it.descricaoNota;
                if (it.eanNota) dadosPorInsumo[it.insumoKey].eanNota = it.eanNota;
                // UM escolhida pelo usuário no dropdown do item importado - também mantém o cadastro
                // do insumo sempre alinhado com o que foi definido na compra.
                if (it.umNota) dadosPorInsumo[it.insumoKey].umNota = it.umNota;
            });
            Object.keys(dadosPorInsumo).forEach(insumoKey => {
                const insumoAtual = allLoadedSuprimentos[insumoKey];
                const info = dadosPorInsumo[insumoKey];
                const novoEstoque = parseFloat((parseFloat(insumoAtual.quantity || 0) + info.somaQuantidade).toFixed(4));
                // O custo unitário digitado pode vir com mais de 2 casas decimais (ex: R$ 40,00 / 30 un.
                // = 1,3333), mas o cadastro do insumo (Aba 3) sempre guarda o custo já arredondado com
                // 2 casas decimais - o valor "cheio" continua preservado no histórico da compra (itens).
                const dadosAtualizados = { quantity: novoEstoque, price: parseFloat(info.custoUnitario.toFixed(2)) };
                if (info.descricaoNota) dadosAtualizados.name = info.descricaoNota;
                if (info.eanNota) dadosAtualizados.barcode = info.eanNota;
                if (info.umNota) dadosAtualizados.unit = info.umNota;
                promessas.push(update(ref(db, `suprimentos/${insumoKey}`), dadosAtualizados));
            });

            // Abate o valor da compra de cada conta escolhida e registra a saída no extrato (Aba 6) -
            // só acontece no modo "à vista". No modo "a prazo" nenhuma conta é mexida agora; o valor
            // fica pendente até alguém dar baixa manualmente no Histórico de Compras.
            if (condicaoPagamento === 'avista') {
                pagamentosConsolidados.forEach(p => {
                    const contaAtual = allLoadedContas[p.contaKey];
                    const saldoAtual = parseFloat(contaAtual.saldo || 0);
                    const novoSaldo = parseFloat((saldoAtual - p.valor).toFixed(2));
                    const movRef = push(ref(db, 'movimentacoesCaixa'));
                    movimentacoesKeys.push(movRef.key);
                    const descricaoCompra = `Compra de suprimentos - ${fornecedorNome}`;
                    promessas.push(update(ref(db, `contas/${p.contaKey}`), { saldo: novoSaldo }));
                    promessas.push(set(movRef, { contaKey: p.contaKey, contaNome: contaAtual.name, tipo: 'saida', valor: p.valor, descricao: descricaoCompra, data, timestamp, compraKey: compraRef.key }));
                });
            }

            // Quando a compra veio de uma nota fiscal importada em PDF, guarda também os dados oficiais
            // dela (número, chave de acesso, razão social e a quebra bruto/desconto/líquido) no registro
            const dadosNota = notaFiscalImportadaAtual ? {
                nfNumero: notaFiscalImportadaAtual.numeroNf || null,
                nfChaveAcesso: notaFiscalImportadaAtual.chaveAcesso || null,
                nfRazaoSocial: notaFiscalImportadaAtual.razaoSocial || null,
                nfTotalBruto: notaFiscalImportadaAtual.totalBruto,
                nfTotalDescontos: notaFiscalImportadaAtual.totalDescontos
            } : {};

            promessas.push(set(compraRef, {
                data, fornecedorKey, fornecedorCnpj: fornecedorCnpjDigitado, fornecedorNome, itens, pagamentos: pagamentosConsolidados,
                valorTotal: valorTotalCompraFinal, movimentacoesKeys, timestamp,
                condicaoPagamento, statusPagamento: condicaoPagamento === 'avista' ? 'PAGO' : 'PENDENTE',
                dataVencimento: dataVencimentoCompra, pedidoCompraKey: pedidoCompraKeyVinculado,
                ...dadosNota
            }));

            // Se essa nota fiscal está sendo lançada em cima de um Pedido de Compra, atualiza o pedido:
            // soma a quantidade recebida em cada item (casando pelo insumo) e recalcula o status geral
            // (recebido parcial ou total, conforme sobrou ou não item abaixo da quantidade pedida).
            if (pedidoCompraKeyVinculado && allLoadedPedidosCompra[pedidoCompraKeyVinculado]) {
                const pedido = allLoadedPedidosCompra[pedidoCompraKeyVinculado];
                const itensPedidoAtualizados = (pedido.itens || []).map(itPedido => {
                    const recebidoAgora = itens
                        .filter(it => it.insumoKey === itPedido.insumoKey)
                        .reduce((acc, it) => acc + parseFloat(it.quantidade || 0), 0);
                    return { ...itPedido, qtdRecebida: parseFloat((parseFloat(itPedido.qtdRecebida || 0) + recebidoAgora).toFixed(4)) };
                });
                const totalmenteRecebido = itensPedidoAtualizados.every(it => it.qtdRecebida >= it.qtdPedida - 0.0001);
                const algumRecebido = itensPedidoAtualizados.some(it => it.qtdRecebida > 0.0001);
                const novoStatusPedido = totalmenteRecebido ? 'RECEBIDO_TOTAL' : (algumRecebido ? 'RECEBIDO_PARCIAL' : pedido.status);
                const comprasVinculadas = [...(pedido.comprasVinculadas || []), compraRef.key];
                promessas.push(update(ref(db, `pedidosCompra/${pedidoCompraKeyVinculado}`), { itens: itensPedidoAtualizados, status: novoStatusPedido, comprasVinculadas }));
            }

            Promise.all(promessas).then(() => {
                notaFiscalImportadaAtual = null;
                document.getElementById('modal-nova-compra').style.display = 'none';
                document.getElementById('form-nova-compra').reset();
                const msgPagamento = condicaoPagamento === 'avista'
                    ? `R$ ${formatMoeda(valorTotalCompraFinal)} abatidos das contas escolhidas.`
                    : `Vencimento em ${dataISOparaBR(dataVencimentoCompra)} - lembre de dar baixa quando pagar.`;
                showAlert(`Compra registrada! Estoque dos insumos atualizado. ${msgPagamento}`, 'success');
                // Se o atalho usado foi "Registrar Recebimento" (em vez de "Receber Nota Fiscal"), pousa
                // na sub-aba de Recebimentos de Mercadoria em vez da de Notas Fiscais, já que foi ali
                // que o usuário pediu pra ver o resultado.
                ativarComprasSubview(intencaoComprasSubviewAoSalvar || 'notas');
                intencaoComprasSubviewAoSalvar = null;
            });
        };

        // Verifica se alguma das contas escolhidas ficará com saldo negativo, e avisa antes de confirmar.
        // Só se aplica no modo "à vista" - a prazo não mexe em conta nenhuma agora.
        function prosseguirComCompra() {
            if (condicaoPagamento === 'prazo') { executarCompra(); return; }
            const contasQueFicariamNegativas = pagamentosConsolidados.filter(p => parseFloat(allLoadedContas[p.contaKey].saldo || 0) - p.valor < 0);
            if (contasQueFicariamNegativas.length > 0) {
                const nomes = contasQueFicariamNegativas.map(p => p.contaNome).join(', ');
                showConfirm(`As contas a seguir ficarão com saldo negativo após esta compra: ${nomes}.\n\nDeseja continuar mesmo assim?`, 'warning', 'Saldo Insuficiente').then(ok => {
                    if (ok) executarCompra();
                });
            } else {
                executarCompra();
            }
        }

        if (!compraSemCnpj || fornecedorKey) {
            // Fornecedor já identificado: CNPJ normal já cadastrado, ou nome (no modo sem CNPJ) já
            // vinculado a um fornecedor existente - segue direto para o registro da compra.
            prosseguirComCompra();
        } else {
            // Compra sem CNPJ com um nome que ainda não bateu com nenhum fornecedor cadastrado: procura
            // de novo pelo nome (caso o vínculo automático não tenha capturado) e, se realmente for novo,
            // cadastra esse fornecedor informal na hora - com as mesmas funcionalidades de um fornecedor
            // com CNPJ (aparece na Aba 9, tem histórico, ranking, etc.), só sem o campo de CNPJ preenchido.
            const nomeNormalizado = normalizarBusca(fornecedorNome);
            const matchPorNome = Object.entries(allLoadedFornecedores).find(([k, f]) => normalizarBusca(f.name) === nomeNormalizado);
            if (matchPorNome) {
                fornecedorKey = matchPorNome[0];
                prosseguirComCompra();
            } else {
                const novoFornecedorRef = push(ref(db, 'fornecedores'));
                set(novoFornecedorRef, { name: fornecedorNome, cnpj: fornecedorCnpjDigitado || '' }).then(() => {
                    fornecedorKey = novoFornecedorRef.key;
                    prosseguirComCompra();
                }).catch(err => showAlert('Erro ao cadastrar o fornecedor: ' + err.message, 'danger'));
            }
        }
    });

    // ----- EXCLUSÃO DE COMPRA: estorna o valor nas contas e remove o estoque que havia entrado -----
    function excluirCompra(key) {
        const compra = allLoadedComprasSuprimentos[key];
        if (!compra) return;

        const resumoItens = (compra.itens || []).map(it => `${formatQuantidade(it.quantidade)} ${it.unidade || ''} de ${it.insumoNome}`).join(', ');
        const resumoContas = (compra.pagamentos || []).map(p => `${p.contaNome} (R$ ${formatMoeda(parseFloat(p.valor || 0))})`).join(', ');

        showConfirm(`Deseja excluir esta compra (${resumoItens})?\n\n• O valor total de R$ ${formatMoeda(parseFloat(compra.valorTotal || 0))} será devolvido para: ${resumoContas}.\n• A quantidade comprada será removida do estoque desses insumos.\n\nAtenção: se parte desse estoque já foi consumida em produção, o estoque do insumo pode ficar negativo.`, 'danger', 'Excluir Compra').then(ok => {
            if (!ok) return;

            const promessas = [remove(ref(db, `comprasSuprimentos/${key}`))];

            // Devolve o valor para cada conta que pagou por esta compra
            (compra.pagamentos || []).forEach(p => {
                const conta = allLoadedContas[p.contaKey];
                if (conta) {
                    const novoSaldo = parseFloat((parseFloat(conta.saldo || 0) + parseFloat(p.valor || 0)).toFixed(2));
                    promessas.push(update(ref(db, `contas/${p.contaKey}`), { saldo: novoSaldo }));
                }
            });

            // Remove as movimentações de caixa geradas por esta compra
            (compra.movimentacoesKeys || []).forEach(movKey => {
                promessas.push(remove(ref(db, `movimentacoesCaixa/${movKey}`)));
            });

            // Remove do estoque a quantidade que havia entrado com esta compra. Se o mesmo insumo
            // aparece em mais de um item da compra (produto duplicado na nota), soma as quantidades
            // antes de subtrair - senão a segunda atualização sobrescreveria a primeira.
            const quantidadePorInsumo = {};
            (compra.itens || []).forEach(it => {
                quantidadePorInsumo[it.insumoKey] = (quantidadePorInsumo[it.insumoKey] || 0) + parseFloat(it.quantidade || 0);
            });
            Object.keys(quantidadePorInsumo).forEach(insumoKey => {
                const insumo = allLoadedSuprimentos[insumoKey];
                if (insumo) {
                    const novoEstoque = parseFloat((parseFloat(insumo.quantity || 0) - quantidadePorInsumo[insumoKey]).toFixed(4));
                    promessas.push(update(ref(db, `suprimentos/${insumoKey}`), { quantity: novoEstoque }));
                }
            });

            Promise.all(promessas).then(() => showAlert('Compra excluída, contas estornadas e estoque ajustado.', 'success'));
        });
    }
    window.excluirCompra = excluirCompra;

    // ===================================================================================
    // ===== PEDIDOS DE COMPRA (etapa anterior à Nota Fiscal - não mexe em estoque/caixa) =====
    // ===================================================================================

    function getNextNumeroPedidoCompra() {
        const arr = Object.values(allLoadedPedidosCompra);
        return Math.max(0, ...arr.map(p => parseInt(p.pedidoNumero) || 0)) + 1;
    }

    // Monta o dropdown de sugestões (reaproveita o mesmo visual do autocomplete de clientes) para um
    // input de busca de insumo dentro de uma linha da tabela de itens do pedido. `campo` diz se a
    // busca é pelo NOME (descrição) ou pelo CÓDIGO DE BARRAS - o resto do comportamento é idêntico:
    // ao selecionar um resultado, preenche AMBOS os campos da linha (descrição + cód. barras + preço).
    function ligarBuscaInsumoPedido(input, dropdown, tr, campo) {
        function renderResultados() {
            const q = normalizarBusca(input.value);
            dropdown.innerHTML = '';
            if (!q) { dropdown.classList.remove('open'); return; }
            const candidatos = Object.entries(allLoadedSuprimentos)
                .filter(([k, v]) => campo === 'nome'
                    ? normalizarBusca(v.name).includes(q)
                    : normalizarBusca(v.barcode || '').includes(q))
                .sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR'))
                .slice(0, 30);

            candidatos.forEach(([key, insumo]) => {
                const item = document.createElement('div');
                item.className = 'client-autocomplete-item';
                item.innerHTML = `<strong>${insumo.name}</strong>${insumo.barcode ? ` <span style="color:var(--text-muted); font-size:8.5pt;">(${insumo.barcode})</span>` : ''}`;
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    aplicarInsumoNaLinhaPedido(tr, key);
                    dropdown.classList.remove('open');
                });
                dropdown.appendChild(item);
            });
            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }
        input.addEventListener('input', () => { tr.dataset.insumoKey = ''; renderResultados(); });
        input.addEventListener('focus', renderResultados);
        input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('open'), 150));
    }

    // Preenche a linha inteira (descrição, código de barras, valor unitário) a partir de um insumo
    // selecionado em qualquer um dos dois campos de busca, e marca a linha como "resolvida" via
    // data-insumo-key - só linhas com esse atributo preenchido entram no pedido ao salvar.
    function aplicarInsumoNaLinhaPedido(tr, insumoKey) {
        const insumo = allLoadedSuprimentos[insumoKey];
        if (!insumo) return;
        tr.dataset.insumoKey = insumoKey;
        tr.querySelector('.item-pedido-descricao').value = insumo.name;
        tr.querySelector('.item-pedido-codbarras').value = insumo.barcode || '';
        tr.querySelector('.item-pedido-preco').value = parseFloat(insumo.price || 0).toFixed(2);
        if (!tr.querySelector('.item-pedido-qtd').value) tr.querySelector('.item-pedido-qtd').value = 1;
        recalcularSubtotalItemPedido(tr);
    }

    function recalcularSubtotalItemPedido(tr) {
        const qtd = parseFloat(tr.querySelector('.item-pedido-qtd').value) || 0;
        const preco = parseFloat(tr.querySelector('.item-pedido-preco').value) || 0;
        tr.querySelector('.item-pedido-total').innerText = `R$ ${formatMoeda(qtd * preco)}`;
        recalcularTotaisPedidoCompra();
    }

    function criarLinhaItemPedidoCompra() {
        const tr = document.createElement('tr');
        tr.className = 'linha-item-pedido-compra';
        tr.dataset.insumoKey = '';

        const tdDescricao = document.createElement('td');
        tdDescricao.innerHTML = `<div class="client-autocomplete-wrapper">
            <input type="text" class="item-pedido-descricao" placeholder="Digite pra buscar o produto..." autocomplete="off" style="margin:0;">
            <div class="client-autocomplete-dropdown"></div>
        </div>`;

        const tdCodBarras = document.createElement('td');
        tdCodBarras.innerHTML = `<div class="client-autocomplete-wrapper">
            <input type="text" class="item-pedido-codbarras" placeholder="Buscar por código..." autocomplete="off" style="margin:0;">
            <div class="client-autocomplete-dropdown"></div>
        </div>`;

        const tdPreco = document.createElement('td');
        const inputPreco = document.createElement('input');
        inputPreco.type = 'number'; inputPreco.min = '0'; inputPreco.step = 'any'; inputPreco.placeholder = '0,00';
        inputPreco.className = 'item-pedido-preco';
        inputPreco.style.cssText = 'margin:0; width:100%;';
        tdPreco.appendChild(inputPreco);

        const tdQtd = document.createElement('td');
        const inputQtd = document.createElement('input');
        inputQtd.type = 'number'; inputQtd.min = '0.0001'; inputQtd.step = 'any'; inputQtd.placeholder = '0';
        inputQtd.className = 'item-pedido-qtd';
        inputQtd.style.cssText = 'margin:0; width:100%;';
        tdQtd.appendChild(inputQtd);

        const tdTotal = document.createElement('td');
        tdTotal.className = 'item-pedido-total';
        tdTotal.style.cssText = 'font-weight:700; color:var(--text-strong); text-align:right;';
        tdTotal.innerText = 'R$ 0,00';

        const tdAcoes = document.createElement('td');
        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.innerText = '✕';
        btnRemover.title = 'Remover item';
        btnRemover.className = 'btn-action-prod btn-delete-prod';
        btnRemover.style.cssText = 'padding:5px 9px;';
        btnRemover.addEventListener('click', () => { tr.remove(); recalcularTotaisPedidoCompra(); });
        tdAcoes.appendChild(btnRemover);

        tr.appendChild(tdDescricao);
        tr.appendChild(tdCodBarras);
        tr.appendChild(tdPreco);
        tr.appendChild(tdQtd);
        tr.appendChild(tdTotal);
        tr.appendChild(tdAcoes);

        inputPreco.addEventListener('input', () => recalcularSubtotalItemPedido(tr));
        inputQtd.addEventListener('input', () => recalcularSubtotalItemPedido(tr));
        ligarBuscaInsumoPedido(tr.querySelector('.item-pedido-descricao'), tdDescricao.querySelector('.client-autocomplete-dropdown'), tr, 'nome');
        ligarBuscaInsumoPedido(tr.querySelector('.item-pedido-codbarras'), tdCodBarras.querySelector('.client-autocomplete-dropdown'), tr, 'barcode');

        return tr;
    }

    // Controla qual dos dois campos (% ou R$) foi editado por último, pra saber qual recalcular a
    // partir do outro sem entrar num loop de arredondamento entre os dois.
    let ultimoDescontoPedidoEditado = 'percentual';

    // Quando não-nulo, o modal "Novo Pedido de Compra" está na verdade editando este pedido
    // existente (chave no Firebase) em vez de criar um novo - controla o submit do formulário.
    let pedidoCompraEditandoKey = null;

    function recalcularTotaisPedidoCompra() {
        let bruto = 0;
        document.querySelectorAll('#pedido-compra-itens-lista .linha-item-pedido-compra').forEach(tr => {
            const qtd = parseFloat(tr.querySelector('.item-pedido-qtd').value) || 0;
            const preco = parseFloat(tr.querySelector('.item-pedido-preco').value) || 0;
            bruto += qtd * preco;
        });
        bruto = parseFloat(bruto.toFixed(2));
        document.getElementById('pedido-compra-total-bruto').innerText = `R$ ${formatMoeda(bruto)}`;

        const percEl = document.getElementById('pedido-compra-desconto-percentual');
        const valEl = document.getElementById('pedido-compra-desconto-valor');
        let descontoValor, descontoPercentual;
        if (ultimoDescontoPedidoEditado === 'valor') {
            descontoValor = Math.min(bruto, Math.max(0, parseFloat(valEl.value) || 0));
            descontoPercentual = bruto > 0 ? parseFloat((descontoValor / bruto * 100).toFixed(2)) : 0;
            percEl.value = descontoPercentual;
        } else {
            descontoPercentual = Math.min(100, Math.max(0, parseFloat(percEl.value) || 0));
            descontoValor = parseFloat((bruto * descontoPercentual / 100).toFixed(2));
            valEl.value = descontoValor.toFixed(2);
        }
        const liquido = parseFloat((bruto - descontoValor).toFixed(2));
        document.getElementById('pedido-compra-total-liquido').innerText = `R$ ${formatMoeda(liquido)}`;
        return { bruto, descontoPercentual, descontoValor, liquido };
    }

    document.getElementById('pedido-compra-desconto-percentual').addEventListener('input', () => { ultimoDescontoPedidoEditado = 'percentual'; recalcularTotaisPedidoCompra(); });
    document.getElementById('pedido-compra-desconto-valor').addEventListener('input', () => { ultimoDescontoPedidoEditado = 'valor'; recalcularTotaisPedidoCompra(); });

    document.getElementById('btn-add-item-pedido-compra').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('pedido-compra-itens-lista').appendChild(criarLinhaItemPedidoCompra());
    });

    // Autofill do nome ao completar o CNPJ (não precisa mais esperar o campo perder o foco)
    function tentarAutofillFornecedorPorCnpj() {
        const digits = normalizeCnpj(document.getElementById('pedido-compra-fornecedor-cnpj').value);
        if (digits.length !== 14) return;
        const match = findFornecedorPorCnpj(digits);
        if (match) document.getElementById('pedido-compra-fornecedor-nome').value = match[1].name;
    }
    document.getElementById('pedido-compra-fornecedor-cnpj').addEventListener('input', tentarAutofillFornecedorPorCnpj);
    document.getElementById('pedido-compra-fornecedor-cnpj').addEventListener('blur', tentarAutofillFornecedorPorCnpj);

    // Busca por NOME: mostra um dropdown com todos os fornecedores cujo nome bate com o que foi
    // digitado, exibindo o CNPJ de cada um pra desambiguar - selecionar preenche os dois campos.
    (function initBuscaFornecedorPedido() {
        const inputNome = document.getElementById('pedido-compra-fornecedor-nome');
        const dropdown = document.getElementById('pedido-compra-fornecedor-dropdown');

        function render() {
            const q = normalizarBusca(inputNome.value);
            dropdown.innerHTML = '';
            const candidatos = Object.entries(allLoadedFornecedores)
                .filter(([k, f]) => !q || normalizarBusca(f.name || '').includes(q))
                .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'pt-BR'))
                .slice(0, 30);

            candidatos.forEach(([key, f]) => {
                const item = document.createElement('div');
                item.className = 'client-autocomplete-item';
                item.innerHTML = `<strong>${f.name}</strong>${f.cnpj ? ` <span style="color:var(--text-muted); font-size:8.5pt;">(${formatCnpjOuInformal(f.cnpj)})</span>` : ''}`;
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    inputNome.value = f.name;
                    if (f.cnpj) document.getElementById('pedido-compra-fornecedor-cnpj').value = formatCnpjOuInformal(f.cnpj);
                    dropdown.classList.remove('open');
                });
                dropdown.appendChild(item);
            });
            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }
        inputNome.addEventListener('input', render);
        inputNome.addEventListener('focus', render);
        inputNome.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('open'), 150));
    })();

    setupModalEvents('btn-trigger-modal-novo-pedido-compra', 'modal-novo-pedido-compra', 'close-modal-novo-pedido-compra');
    document.getElementById('btn-trigger-modal-novo-pedido-compra').addEventListener('click', () => {
        pedidoCompraEditandoKey = null;
        document.getElementById('pedido-compra-modal-titulo-prefixo').innerText = 'Novo Pedido de Compra';
        document.getElementById('form-novo-pedido-compra').reset();
        document.getElementById('pedido-compra-numero-display').value = String(getNextNumeroPedidoCompra()).padStart(3, '0');
        document.getElementById('pedido-compra-data-lancamento').value = dataISOparaBR(formatDateInputValue(new Date()));
        document.getElementById('pedido-compra-data-vencimento').value = '';
        document.getElementById('pedido-compra-data-faturamento').value = '';
        document.getElementById('pedido-compra-itens-lista').innerHTML = '';
        document.getElementById('pedido-compra-itens-lista').appendChild(criarLinhaItemPedidoCompra());
        ultimoDescontoPedidoEditado = 'percentual';
        document.getElementById('pedido-compra-desconto-percentual').value = 0;
        document.getElementById('pedido-compra-desconto-valor').value = 0;
        recalcularTotaisPedidoCompra();
    });

    document.getElementById('form-novo-pedido-compra').addEventListener('submit', (e) => {
        e.preventDefault();
        const fornecedorNome = document.getElementById('pedido-compra-fornecedor-nome').value.trim();
        if (!fornecedorNome) { showAlert('Informe o nome do fornecedor.', 'warning'); return; }
        const fornecedorCnpj = document.getElementById('pedido-compra-fornecedor-cnpj').value.trim();
        const cnpjDigits = normalizeCnpj(fornecedorCnpj);
        const matchFornecedor = cnpjDigits ? findFornecedorPorCnpj(cnpjDigits) : null;

        const itens = [];
        let itemInvalido = false;
        document.querySelectorAll('#pedido-compra-itens-lista .linha-item-pedido-compra').forEach(tr => {
            const insumoKey = tr.dataset.insumoKey;
            const qtdPedida = parseFloat(tr.querySelector('.item-pedido-qtd').value);
            const precoEstimado = parseFloat(tr.querySelector('.item-pedido-preco').value) || 0;
            if (!insumoKey || isNaN(qtdPedida) || qtdPedida <= 0) { itemInvalido = true; return; }
            const insumo = allLoadedSuprimentos[insumoKey];
            if (!insumo) { itemInvalido = true; return; }
            // Ao editar um pedido já existente, preserva a quantidade já recebida desse item em
            // notas fiscais anteriores (travada no máximo na nova quantidade pedida, caso o usuário
            // tenha reduzido a quantidade abaixo do que já foi recebido).
            const qtdRecebidaOriginal = parseFloat(tr.dataset.qtdRecebidaOriginal || 0) || 0;
            const qtdRecebida = Math.min(qtdRecebidaOriginal, qtdPedida);
            itens.push({ insumoKey, insumoNome: insumo.name, unidade: insumo.unit || '', qtdPedida, qtdRecebida, precoEstimado });
        });
        if (itemInvalido || itens.length === 0) { showAlert('Preencha corretamente todos os itens do pedido: busque e selecione o produto (por nome ou código de barras) e informe a quantidade desejada.', 'warning'); return; }

        const dataLancamento = dataBRparaISO(document.getElementById('pedido-compra-data-lancamento').value) || formatDateInputValue(new Date());
        const dataVencimento = dataBRparaISO(document.getElementById('pedido-compra-data-vencimento').value) || null;
        const dataFaturamento = dataBRparaISO(document.getElementById('pedido-compra-data-faturamento').value) || null;
        const observacoes = document.getElementById('pedido-compra-observacoes').value.trim();
        const { bruto, descontoPercentual, descontoValor, liquido } = recalcularTotaisPedidoCompra();

        if (pedidoCompraEditandoKey) {
            const key = pedidoCompraEditandoKey;
            const original = allLoadedPedidosCompra[key];
            if (!original) { showAlert('Este pedido não existe mais.', 'danger'); return; }
            const pedidoAtualizado = {
                fornecedorKey: matchFornecedor ? matchFornecedor[0] : null,
                fornecedorCnpj: cnpjDigits || null, fornecedorNome, itens,
                dataPedido: dataLancamento, dataVencimento, dataFaturamento, observacoes,
                valorBruto: bruto, descontoPercentual, descontoValor, valorLiquido: liquido
            };
            update(ref(db, `pedidosCompra/${key}`), pedidoAtualizado).then(() => {
                showAlert(`Pedido de Compra ${String(original.pedidoNumero).padStart(3,'0')} atualizado!`, 'success');
                document.getElementById('modal-novo-pedido-compra').style.display = 'none';
                pedidoCompraEditandoKey = null;
            }).catch(err => showAlert('Erro ao atualizar pedido: ' + err.message, 'danger'));
            return;
        }

        const pedidoNumero = getNextNumeroPedidoCompra();
        const timestamp = Date.now();
        const novoPedido = {
            pedidoNumero, fornecedorKey: matchFornecedor ? matchFornecedor[0] : null,
            fornecedorCnpj: cnpjDigits || null, fornecedorNome, itens,
            status: 'ENVIADO', dataPedido: dataLancamento, dataVencimento, dataFaturamento, observacoes,
            valorBruto: bruto, descontoPercentual, descontoValor, valorLiquido: liquido,
            comprasVinculadas: [], timestamp
        };

        push(ref(db, 'pedidosCompra'), novoPedido).then(() => {
            showAlert(`Pedido de Compra ${String(pedidoNumero).padStart(3,'0')} registrado! Assim que a mercadoria chegar, use "Receber Nota Fiscal" na lista de pedidos.`, 'success');
            document.getElementById('modal-novo-pedido-compra').style.display = 'none';
        }).catch(err => showAlert('Erro ao salvar pedido: ' + err.message, 'danger'));
    });

    const STATUS_PEDIDO_LABELS = {
        RASCUNHO: { texto: 'Rascunho', classe: 'status-rascunho' },
        ENVIADO: { texto: '📤 Enviado', classe: 'status-confirmado' },
        RECEBIDO_PARCIAL: { texto: '📦 Recebido Parcial', classe: 'status-confirmado' },
        RECEBIDO_TOTAL: { texto: '✅ Recebido Total', classe: 'status-produzido' },
        CANCELADO: { texto: '✕ Cancelado', classe: 'status-cancelado' }
    };

    function renderPedidosCompraTable() {
        const tbody = document.getElementById('pedidos-compra-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        const filtroStatus = document.getElementById('pedidos-compra-filtro-status').value;

        let lista = Object.keys(allLoadedPedidosCompra)
            .map(key => {
                const p = allLoadedPedidosCompra[key];
                // Pedidos criados antes dessa versão (sem valorLiquido salvo) caem no cálculo antigo,
                // como fallback - pedidos novos sempre já vêm com o valor líquido pronto.
                const valorEstimado = p.valorLiquido !== undefined
                    ? p.valorLiquido
                    : (p.itens || []).reduce((acc, it) => acc + (parseFloat(it.qtdPedida || 0) * parseFloat(it.precoEstimado || 0)), 0);
                return { key, ...p, valorEstimado };
            })
            .filter(p => !filtroStatus || p.status === filtroStatus);

        lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        lista = ordenarPorEstado(lista, 'pedidos-compra-table');

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-faint); padding:20px;">Nenhum pedido de compra registrado ainda.</td></tr>';
            return;
        }

        const hoje = formatDateInputValue(new Date());
        lista.forEach(p => {
            const statusInfo = STATUS_PEDIDO_LABELS[p.status] || STATUS_PEDIDO_LABELS.ENVIADO;
            const qtdItens = (p.itens || []).length;
            const vencida = p.dataVencimento && p.dataVencimento < hoje && p.status !== 'RECEBIDO_TOTAL' && p.status !== 'CANCELADO';
            const vencimentoDisplay = p.dataVencimento
                ? `<span style="${vencida ? 'color:var(--color-negative); font-weight:700;' : ''}">${vencida ? '⚠️ ' : ''}${dataISOparaBR(p.dataVencimento)}</span>`
                : '<span style="color:var(--text-faint);">-</span>';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><a href="javascript:void(0)" class="cliente-nome-link" style="color:#0854a0; font-weight:700;" onclick="abrirDetalhePedidoCompra('${p.key}')">${String(p.pedidoNumero).padStart(3,'0')}</a></td>
                <td>${p.fornecedorNome}</td>
                <td>${p.dataPedido ? dataISOparaBR(p.dataPedido) : '-'}</td>
                <td>${vencimentoDisplay}</td>
                <td>${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'}</td>
                <td style="font-weight:700; color:var(--color-primary);">R$ ${formatMoeda(p.valorEstimado)}</td>
                <td><span class="badge-status ${statusInfo.classe}">${statusInfo.texto}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
    bindSortableHeaders('pedidos-compra-table', 'pedidos-compra-table', renderPedidosCompraTable);
    document.getElementById('pedidos-compra-filtro-status').addEventListener('change', renderPedidosCompraTable);

    setupModalEvents(null, 'modal-detalhe-pedido-compra', 'close-modal-detalhe-pedido-compra');
    window.abrirDetalhePedidoCompra = function(key) {
        const p = allLoadedPedidosCompra[key];
        if (!p) return;
        const statusInfo = STATUS_PEDIDO_LABELS[p.status] || STATUS_PEDIDO_LABELS.ENVIADO;
        document.getElementById('detalhe-pedido-titulo').innerText = `Pedido de Compra ${String(p.pedidoNumero).padStart(3,'0')}`;
        document.getElementById('detalhe-pedido-fornecedor').innerText = p.fornecedorNome;
        document.getElementById('detalhe-pedido-data').innerText = p.dataPedido ? dataISOparaBR(p.dataPedido) : '-';
        const hoje = formatDateInputValue(new Date());
        const vencida = p.dataVencimento && p.dataVencimento < hoje && p.status !== 'RECEBIDO_TOTAL' && p.status !== 'CANCELADO';
        document.getElementById('detalhe-pedido-previsao').innerHTML = p.dataVencimento
            ? `<span style="${vencida ? 'color:var(--color-negative);' : ''}">${vencida ? '⚠️ ' : ''}${dataISOparaBR(p.dataVencimento)}</span>`
            : '-';
        document.getElementById('detalhe-pedido-faturamento').innerText = p.dataFaturamento ? dataISOparaBR(p.dataFaturamento) : '-';
        document.getElementById('detalhe-pedido-status').innerHTML = `<span class="badge-status ${statusInfo.classe}">${statusInfo.texto}</span>`;

        const podeReceberOuCancelar = p.status !== 'RECEBIDO_TOTAL' && p.status !== 'CANCELADO';
        const podeExcluir = (p.comprasVinculadas || []).length === 0;
        document.getElementById('detalhe-pedido-acoes').innerHTML = `
            <button type="button" class="btn-action-prod btn-edit-prod" onclick="editarPedidoCompra('${key}')">✏️ Editar</button>
            ${podeReceberOuCancelar ? `<button type="button" class="btn-action-prod btn-edit-prod" style="background-color:var(--color-accent-orange);" onclick="receberNotaFiscalDePedido('${key}')">🧾 Nota Fiscal</button>` : ''}
            ${podeReceberOuCancelar ? `<button type="button" class="btn-action-prod btn-edit-prod" style="background-color:var(--color-positive);" onclick="registrarRecebimentoDePedido('${key}')">📦 Recebimento</button>` : ''}
            ${podeReceberOuCancelar ? `<button type="button" class="btn-action-prod btn-delete-prod" onclick="cancelarPedidoCompra('${key}')">✕ Cancelar</button>` : ''}
            ${podeExcluir ? `<button type="button" class="btn-action-prod btn-delete-prod" onclick="excluirPedidoCompra('${key}')">🗑️ Excluir</button>` : ''}
        `;

        const obsWrap = document.getElementById('detalhe-pedido-observacoes-wrap');
        if (p.observacoes) { obsWrap.style.display = 'block'; document.getElementById('detalhe-pedido-observacoes').innerText = p.observacoes; }
        else { obsWrap.style.display = 'none'; }

        const totaisWrap = document.getElementById('detalhe-pedido-totais-wrap');
        if (p.valorLiquido !== undefined) {
            totaisWrap.style.display = 'flex';
            document.getElementById('detalhe-pedido-valor-bruto').innerText = `R$ ${formatMoeda(parseFloat(p.valorBruto || 0))}`;
            document.getElementById('detalhe-pedido-desconto').innerText = `${formatMoeda(parseFloat(p.descontoPercentual || 0))}% (R$ ${formatMoeda(parseFloat(p.descontoValor || 0))})`;
            document.getElementById('detalhe-pedido-valor-liquido').innerText = `R$ ${formatMoeda(parseFloat(p.valorLiquido || 0))}`;
        } else {
            totaisWrap.style.display = 'none';
        }

        const tbody = document.getElementById('detalhe-pedido-itens-table-body');
        tbody.innerHTML = (p.itens || []).map(it => {
            const completo = parseFloat(it.qtdRecebida || 0) >= parseFloat(it.qtdPedida || 0) - 0.0001;
            const corRecebida = completo ? 'var(--color-positive)' : (parseFloat(it.qtdRecebida || 0) > 0 ? '#a85209' : 'var(--text-muted)');
            return `<tr>
                <td>${nomeClicavelInsumo(it.insumoKey, it.insumoNome)}</td>
                <td>${formatQuantidade(it.qtdPedida)} ${it.unidade || ''}</td>
                <td style="color:${corRecebida}; font-weight:700;">${formatQuantidade(it.qtdRecebida || 0)} ${it.unidade || ''}</td>
                <td>R$ ${formatMoeda(parseFloat(it.precoEstimado || 0))}</td>
            </tr>`;
        }).join('');

        const notasWrap = document.getElementById('detalhe-pedido-notas-lista');
        const notas = (p.comprasVinculadas || []).map(ck => allLoadedComprasSuprimentos[ck]).filter(Boolean);
        notasWrap.innerHTML = notas.length === 0 ? 'Nenhuma nota fiscal recebida ainda.' : notas.map(c =>
            `<div style="padding:6px 0; border-bottom:1px solid var(--border-soft);">📄 ${dataISOparaBR(c.data)} - R$ ${formatMoeda(parseFloat(c.valorTotal || 0))}${c.nfChaveAcesso ? ` <span style="font-family:var(--font-mono); font-size:8pt;">(${c.nfChaveAcesso.slice(-8)})</span>` : ''}</div>`
        ).join('');

        document.getElementById('modal-detalhe-pedido-compra').style.display = 'flex';
    };

    // Abre o mesmo modal usado para criar um Pedido de Compra, mas pré-preenchido com os dados de
    // um pedido já existente - o handler de submit detecta `pedidoCompraEditandoKey` e faz um
    // update() no registro existente em vez de criar um pedido novo (push).
    window.editarPedidoCompra = function(key) {
        const p = allLoadedPedidosCompra[key];
        if (!p) return;

        pedidoCompraEditandoKey = key;
        document.getElementById('modal-detalhe-pedido-compra').style.display = 'none';

        document.getElementById('pedido-compra-modal-titulo-prefixo').innerText = 'Editar Pedido de Compra';
        document.getElementById('pedido-compra-numero-display').value = String(p.pedidoNumero).padStart(3, '0');
        document.getElementById('pedido-compra-fornecedor-cnpj').value = p.fornecedorCnpj ? formatCnpjOuInformal(p.fornecedorCnpj) : '';
        document.getElementById('pedido-compra-fornecedor-nome').value = p.fornecedorNome || '';
        document.getElementById('pedido-compra-data-lancamento').value = p.dataPedido ? dataISOparaBR(p.dataPedido) : '';
        document.getElementById('pedido-compra-data-vencimento').value = p.dataVencimento ? dataISOparaBR(p.dataVencimento) : '';
        document.getElementById('pedido-compra-data-faturamento').value = p.dataFaturamento ? dataISOparaBR(p.dataFaturamento) : '';
        document.getElementById('pedido-compra-observacoes').value = p.observacoes || '';

        const itensLista = document.getElementById('pedido-compra-itens-lista');
        itensLista.innerHTML = '';
        (p.itens || []).forEach(it => {
            const tr = criarLinhaItemPedidoCompra();
            itensLista.appendChild(tr);
            tr.dataset.insumoKey = it.insumoKey || '';
            tr.dataset.qtdRecebidaOriginal = it.qtdRecebida || 0;
            const insumoAtual = allLoadedSuprimentos[it.insumoKey];
            tr.querySelector('.item-pedido-descricao').value = it.insumoNome || '';
            tr.querySelector('.item-pedido-codbarras').value = (insumoAtual && insumoAtual.barcode) || '';
            tr.querySelector('.item-pedido-preco').value = parseFloat(it.precoEstimado || 0).toFixed(2);
            tr.querySelector('.item-pedido-qtd').value = it.qtdPedida;
            recalcularSubtotalItemPedido(tr);
        });
        if (itensLista.children.length === 0) {
            itensLista.appendChild(criarLinhaItemPedidoCompra());
        }

        ultimoDescontoPedidoEditado = 'percentual';
        document.getElementById('pedido-compra-desconto-percentual').value = p.descontoPercentual || 0;
        document.getElementById('pedido-compra-desconto-valor').value = p.descontoValor || 0;
        recalcularTotaisPedidoCompra();

        document.getElementById('modal-novo-pedido-compra').style.display = 'flex';
    };

    window.cancelarPedidoCompra = function(key) {
        const p = allLoadedPedidosCompra[key];
        if (!p) return;
        showConfirm(`Deseja cancelar o Pedido de Compra ${String(p.pedidoNumero).padStart(3,'0')}?`, 'danger', 'Cancelar Pedido').then(ok => {
            if (ok) update(ref(db, `pedidosCompra/${key}`), { status: 'CANCELADO' });
        });
    };

    window.excluirPedidoCompra = function(key) {
        const p = allLoadedPedidosCompra[key];
        if (!p) return;
        if ((p.comprasVinculadas || []).length > 0) {
            showAlert('Não é possível excluir este pedido pois já tem nota(s) fiscal(is) vinculada(s).', 'danger');
            return;
        }
        showConfirm(`Deseja excluir permanentemente o Pedido de Compra ${String(p.pedidoNumero).padStart(3,'0')}?`, 'danger', 'Excluir Pedido').then(ok => {
            if (ok) remove(ref(db, `pedidosCompra/${key}`));
        });
    };

    // Preenche o modal de Nova Compra com fornecedor + itens (na quantidade que ainda falta receber)
    // de um Pedido de Compra - usado pelos dois atalhos abaixo ("Receber Nota Fiscal" e "Registrar
    // Recebimento"), que só diferem em pra qual sub-aba voltar depois de salvar.
    function prefillNovaCompraComPedido(key) {
        const p = allLoadedPedidosCompra[key];
        if (!p) return false;
        if (Object.keys(allLoadedContas).length === 0) {
            showAlert('Não há nenhuma conta cadastrada. Cadastre uma conta na Aba 6 - Caixa antes de registrar uma compra.', 'warning');
            return false;
        }
        resetFormNovaCompra();

        document.getElementById('compra-pedido-vinculado-key').value = key;
        document.getElementById('compra-pedido-vinculado-aviso').style.display = 'block';
        document.getElementById('compra-pedido-vinculado-texto').innerText = `Pedido de Compra ${String(p.pedidoNumero).padStart(3,'0')}`;

        if (p.fornecedorCnpj) {
            document.getElementById('compra-fornecedor-cnpj').value = formatCnpjOuInformal(p.fornecedorCnpj);
            document.getElementById('compra-fornecedor-cnpj').dispatchEvent(new Event('blur'));
        } else {
            // Fornecedor do pedido não tem CNPJ cadastrado: usa o modo "sem CNPJ" com o nome já preenchido
            document.getElementById('compra-sem-cnpj').checked = true;
            atualizarModoCompraSemCnpj();
            document.getElementById('compra-fornecedor-nome').value = p.fornecedorNome;
            document.getElementById('compra-fornecedor-nome').dispatchEvent(new Event('input'));
        }

        document.getElementById('compra-itens-lista').innerHTML = '';
        (p.itens || []).forEach(it => {
            const restante = parseFloat((parseFloat(it.qtdPedida || 0) - parseFloat(it.qtdRecebida || 0)).toFixed(4));
            if (restante <= 0) return; // item já totalmente recebido em uma nota anterior
            const linha = criarLinhaItemCompra();
            linha.querySelector('.item-compra-insumo').value = it.insumoKey;
            linha.querySelector('.item-compra-qtd').value = restante;
            linha.querySelector('.item-compra-custo').value = parseFloat(it.precoEstimado || 0).toFixed(2);
            linha.querySelector('.item-compra-qtd').dispatchEvent(new Event('input'));
            document.getElementById('compra-itens-lista').appendChild(linha);
        });
        if (document.getElementById('compra-itens-lista').children.length === 0) {
            document.getElementById('compra-itens-lista').appendChild(criarLinhaItemCompra());
        }
        recalcularTotalCompra();
        document.getElementById('modal-detalhe-pedido-compra').style.display = 'none';
        document.getElementById('modal-nova-compra').style.display = 'flex';
        return true;
    }

    // "Receber Nota Fiscal": mesmo preenchimento automático, mas ao salvar volta pra sub-aba fiscal
    window.receberNotaFiscalDePedido = function(key) {
        if (prefillNovaCompraComPedido(key)) intencaoComprasSubviewAoSalvar = 'notas';
    };

    // "Registrar Recebimento": idêntico ao de cima, mas ao salvar volta pra sub-aba de Recebimentos de
    // Mercadoria em vez da fiscal - é o mesmo documento por baixo (estoque entra e a nota é lançada
    // junto), só muda pra onde o usuário é levado depois, de acordo com o que ele queria conferir.
    window.registrarRecebimentoDePedido = function(key) {
        if (prefillNovaCompraComPedido(key)) intencaoComprasSubviewAoSalvar = 'recebimentos';
    };

    // ===================================================================================
    // ===== DAR BAIXA EM COMPRA PENDENTE (marca uma compra "a prazo" como paga) =====
    // ===================================================================================

    setupModalEvents(null, 'modal-dar-baixa-compra', 'close-modal-dar-baixa-compra');

    window.abrirModalDarBaixaCompra = function(key) {
        const c = allLoadedComprasSuprimentos[key];
        if (!c) return;
        document.getElementById('dar-baixa-compra-key').value = key;
        document.getElementById('dar-baixa-compra-fornecedor').innerText = c.fornecedorNome || '-';
        document.getElementById('dar-baixa-compra-valor').innerText = `R$ ${formatMoeda(parseFloat(c.valorTotal || 0))}`;
        document.getElementById('dar-baixa-compra-data').value = dataISOparaBR(formatDateInputValue(new Date()));

        const lista = document.getElementById('dar-baixa-pagamentos-lista');
        lista.innerHTML = '';
        const linha = criarLinhaPagamentoCompra();
        linha.querySelector('.pagamento-compra-conta').classList.remove('pagamento-compra-conta');
        linha.querySelector('select').classList.add('dar-baixa-conta');
        linha.querySelector('input').classList.remove('pagamento-compra-valor');
        linha.querySelector('input').classList.add('dar-baixa-valor');
        linha.querySelector('.dar-baixa-valor').value = parseFloat(c.valorTotal || 0).toFixed(2);
        linha.querySelector('.dar-baixa-conta').addEventListener('change', recalcularRestanteDarBaixa);
        linha.querySelector('.dar-baixa-valor').addEventListener('input', recalcularRestanteDarBaixa);
        // O botão de remover, herdado de criarLinhaPagamentoCompra, chama o recálculo do modal errado
        // (o de Nova Compra) - religa pro recálculo certo deste modal.
        linha.querySelector('button').addEventListener('click', () => setTimeout(recalcularRestanteDarBaixa, 0));
        lista.appendChild(linha);
        recalcularRestanteDarBaixa();

        document.getElementById('modal-dar-baixa-compra').style.display = 'flex';
    };

    document.getElementById('btn-add-pagamento-dar-baixa').addEventListener('click', (e) => {
        e.preventDefault();
        const linha = criarLinhaPagamentoCompra();
        linha.querySelector('.pagamento-compra-conta').classList.remove('pagamento-compra-conta');
        linha.querySelector('select').classList.add('dar-baixa-conta');
        linha.querySelector('input').classList.remove('pagamento-compra-valor');
        linha.querySelector('input').classList.add('dar-baixa-valor');
        linha.querySelector('.dar-baixa-conta').addEventListener('change', recalcularRestanteDarBaixa);
        linha.querySelector('.dar-baixa-valor').addEventListener('input', recalcularRestanteDarBaixa);
        linha.querySelector('button').addEventListener('click', () => setTimeout(recalcularRestanteDarBaixa, 0));
        document.getElementById('dar-baixa-pagamentos-lista').appendChild(linha);
        recalcularRestanteDarBaixa();
    });

    function recalcularRestanteDarBaixa() {
        const compraKey = document.getElementById('dar-baixa-compra-key').value;
        const compra = allLoadedComprasSuprimentos[compraKey];
        if (!compra) return;
        let totalPago = 0;
        document.querySelectorAll('#dar-baixa-pagamentos-lista .linha-pagamento-compra').forEach(row => {
            totalPago += parseFloat(row.querySelector('.dar-baixa-valor').value) || 0;
        });
        const restante = parseFloat((parseFloat(compra.valorTotal || 0) - totalPago).toFixed(2));
        const hint = document.getElementById('dar-baixa-restante-hint');
        if (Math.abs(restante) < 0.005) {
            hint.style.color = 'var(--color-positive)';
            hint.innerText = 'Valor da compra totalmente alocado nas contas escolhidas.';
        } else if (restante > 0) {
            hint.style.color = 'var(--color-negative)';
            hint.innerText = `Ainda falta alocar R$ ${formatMoeda(restante)}.`;
        } else {
            hint.style.color = 'var(--color-negative)';
            hint.innerText = `O valor alocado excede o total da compra em R$ ${formatMoeda(Math.abs(restante))}.`;
        }
    }

    document.getElementById('form-dar-baixa-compra').addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('dar-baixa-compra-key').value;
        const compra = allLoadedComprasSuprimentos[key];
        if (!compra) return;

        const dataPagamento = dataBRparaISO(document.getElementById('dar-baixa-compra-data').value);
        if (!dataPagamento) { showAlert('Informe a data do pagamento.', 'warning'); return; }

        const pagamentos = [];
        let invalido = false;
        document.querySelectorAll('#dar-baixa-pagamentos-lista .linha-pagamento-compra').forEach(row => {
            const contaKey = row.querySelector('.dar-baixa-conta').value;
            const valor = parseFloat(row.querySelector('.dar-baixa-valor').value);
            if (!contaKey || isNaN(valor) || valor <= 0) { invalido = true; return; }
            pagamentos.push({ contaKey, contaNome: allLoadedContas[contaKey].name, valor: parseFloat(valor.toFixed(2)) });
        });
        if (invalido || pagamentos.length === 0) { showAlert('Selecione ao menos uma conta válida com um valor informado.', 'warning'); return; }

        const pagamentosPorConta = {};
        pagamentos.forEach(p => { pagamentosPorConta[p.contaKey] = (pagamentosPorConta[p.contaKey] || 0) + p.valor; });
        const pagamentosConsolidados = Object.keys(pagamentosPorConta).map(contaKey => ({ contaKey, contaNome: allLoadedContas[contaKey].name, valor: parseFloat(pagamentosPorConta[contaKey].toFixed(2)) }));
        const totalPago = parseFloat(pagamentosConsolidados.reduce((acc, p) => acc + p.valor, 0).toFixed(2));

        if (Math.abs(parseFloat(compra.valorTotal || 0) - totalPago) > 0.01) {
            showAlert(`O total da compra (R$ ${formatMoeda(parseFloat(compra.valorTotal || 0))}) precisa ser igual ao total distribuído entre as contas (R$ ${formatMoeda(totalPago)}).`, 'warning');
            return;
        }

        const executarBaixa = () => {
            const timestamp = Date.now();
            const promessas = [];
            const movimentacoesKeys = [];
            pagamentosConsolidados.forEach(p => {
                const contaAtual = allLoadedContas[p.contaKey];
                const novoSaldo = parseFloat((parseFloat(contaAtual.saldo || 0) - p.valor).toFixed(2));
                const movRef = push(ref(db, 'movimentacoesCaixa'));
                movimentacoesKeys.push(movRef.key);
                promessas.push(update(ref(db, `contas/${p.contaKey}`), { saldo: novoSaldo }));
                promessas.push(set(movRef, { contaKey: p.contaKey, contaNome: contaAtual.name, tipo: 'saida', valor: p.valor, descricao: `Pagamento de compra - ${compra.fornecedorNome}`, data: dataPagamento, timestamp, compraKey: key }));
            });
            promessas.push(update(ref(db, `comprasSuprimentos/${key}`), {
                statusPagamento: 'PAGO', pagamentos: pagamentosConsolidados, movimentacoesKeys, dataPagamento
            }));
            Promise.all(promessas).then(() => {
                document.getElementById('modal-dar-baixa-compra').style.display = 'none';
                showAlert('Pagamento confirmado! Valor abatido das contas escolhidas.', 'success');
            });
        };

        const contasQueFicariamNegativas = pagamentosConsolidados.filter(p => parseFloat(allLoadedContas[p.contaKey].saldo || 0) - p.valor < 0);
        if (contasQueFicariamNegativas.length > 0) {
            const nomes = contasQueFicariamNegativas.map(p => p.contaNome).join(', ');
            showConfirm(`As contas a seguir ficarão com saldo negativo: ${nomes}.\n\nDeseja continuar mesmo assim?`, 'warning', 'Saldo Insuficiente').then(ok => { if (ok) executarBaixa(); });
        } else {
            executarBaixa();
        }
    });

    // ===== ABA 13 - ORÇAMENTOS (projetos, compras planejadas, despesas e afins) =====
    const STATUS_ORCAMENTO_LABELS = {
        PLANEJADO: { texto: 'Planejado', classe: 'status-planejado' },
        APROVADO: { texto: 'Aprovado', classe: 'status-aprovado' },
        ANDAMENTO: { texto: 'Em Andamento', classe: 'status-andamento' },
        CONCLUIDO: { texto: 'Concluído', classe: 'status-concluido' },
        CANCELADO: { texto: 'Cancelado', classe: 'status-cancelado' }
    };
    const CATEGORIA_ORCAMENTO_LABELS = { PROJETO: 'Projeto', COMPRA: 'Compra', DESPESA: 'Despesa', OUTRO: 'Outro' };

    let orcamentoEditandoKey = null;
    let filtroStatusOrcamento = '';
    let filtroBuscaOrcamentos = '';

    function getNextNumeroOrcamento() {
        const arr = Object.values(allLoadedOrcamentos);
        return Math.max(0, ...arr.map(o => parseInt(o.numero) || 0)) + 1;
    }

    function calcularValorOrcadoItens(itens) {
        return (itens || []).reduce((acc, it) => acc + (parseFloat(it.quantidade || 0) * parseFloat(it.valorUnitario || 0)), 0);
    }

    function criarLinhaItemOrcamento(item) {
        const tr = document.createElement('tr');
        tr.className = 'linha-item-orcamento';

        const tdDescricao = document.createElement('td');
        const inputDescricao = document.createElement('input');
        inputDescricao.type = 'text';
        inputDescricao.placeholder = 'Ex: Tinta acrílica branca';
        inputDescricao.className = 'item-orcamento-descricao';
        inputDescricao.style.cssText = 'margin:0; width:100%;';
        inputDescricao.value = item ? (item.descricao || '') : '';
        tdDescricao.appendChild(inputDescricao);

        const tdPreco = document.createElement('td');
        const inputPreco = document.createElement('input');
        inputPreco.type = 'number'; inputPreco.min = '0'; inputPreco.step = 'any'; inputPreco.placeholder = '0,00';
        inputPreco.className = 'item-orcamento-preco';
        inputPreco.style.cssText = 'margin:0; width:100%;';
        if (item) inputPreco.value = item.valorUnitario;
        tdPreco.appendChild(inputPreco);

        const tdQtd = document.createElement('td');
        const inputQtd = document.createElement('input');
        inputQtd.type = 'number'; inputQtd.min = '0.0001'; inputQtd.step = 'any'; inputQtd.placeholder = '1';
        inputQtd.className = 'item-orcamento-qtd';
        inputQtd.style.cssText = 'margin:0; width:100%;';
        inputQtd.value = item ? item.quantidade : 1;
        tdQtd.appendChild(inputQtd);

        const tdTotal = document.createElement('td');
        tdTotal.className = 'item-orcamento-total';
        tdTotal.style.cssText = 'font-weight:700; color:var(--text-strong); text-align:right;';
        tdTotal.innerText = `R$ ${formatMoeda((item ? item.quantidade * item.valorUnitario : 0))}`;

        const tdAcoes = document.createElement('td');
        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.innerText = '✕';
        btnRemover.title = 'Remover item';
        btnRemover.className = 'btn-action-prod btn-delete-prod';
        btnRemover.style.cssText = 'padding:5px 9px;';
        btnRemover.addEventListener('click', () => { tr.remove(); recalcularTotalOrcamento(); });
        tdAcoes.appendChild(btnRemover);

        tr.appendChild(tdDescricao);
        tr.appendChild(tdPreco);
        tr.appendChild(tdQtd);
        tr.appendChild(tdTotal);
        tr.appendChild(tdAcoes);

        inputPreco.addEventListener('input', () => recalcularSubtotalItemOrcamento(tr));
        inputQtd.addEventListener('input', () => recalcularSubtotalItemOrcamento(tr));

        return tr;
    }

    function recalcularSubtotalItemOrcamento(tr) {
        const qtd = parseFloat(tr.querySelector('.item-orcamento-qtd').value) || 0;
        const preco = parseFloat(tr.querySelector('.item-orcamento-preco').value) || 0;
        tr.querySelector('.item-orcamento-total').innerText = `R$ ${formatMoeda(qtd * preco)}`;
        recalcularTotalOrcamento();
    }

    function recalcularTotalOrcamento() {
        let total = 0;
        document.querySelectorAll('#orcamento-itens-lista .linha-item-orcamento').forEach(tr => {
            const qtd = parseFloat(tr.querySelector('.item-orcamento-qtd').value) || 0;
            const preco = parseFloat(tr.querySelector('.item-orcamento-preco').value) || 0;
            total += qtd * preco;
        });
        total = parseFloat(total.toFixed(2));
        document.getElementById('orcamento-total-orcado').innerText = `R$ ${formatMoeda(total)}`;
        return total;
    }

    document.getElementById('btn-add-item-orcamento').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('orcamento-itens-lista').appendChild(criarLinhaItemOrcamento());
        recalcularTotalOrcamento();
    });

    setupModalEvents('btn-trigger-modal-novo-orcamento', 'modal-novo-orcamento', 'close-modal-novo-orcamento');
    document.getElementById('btn-trigger-modal-novo-orcamento').addEventListener('click', () => {
        orcamentoEditandoKey = null;
        document.getElementById('orcamento-modal-titulo-prefixo').innerText = 'Novo Orçamento';
        document.getElementById('form-novo-orcamento').reset();
        document.getElementById('orcamento-categoria').value = 'PROJETO';
        document.getElementById('orcamento-status').value = 'PLANEJADO';
        document.getElementById('orcamento-data-criacao').value = dataISOparaBR(formatDateInputValue(new Date()));
        document.getElementById('orcamento-prazo').value = '';
        document.getElementById('orcamento-valor-gasto').value = '';
        document.getElementById('orcamento-itens-lista').innerHTML = '';
        document.getElementById('orcamento-itens-lista').appendChild(criarLinhaItemOrcamento());
        recalcularTotalOrcamento();
    });

    window.editarOrcamento = function(key) {
        const o = allLoadedOrcamentos[key];
        if (!o) return;
        orcamentoEditandoKey = key;
        document.getElementById('orcamento-modal-titulo-prefixo').innerText = 'Editar Orçamento';
        document.getElementById('orcamento-titulo').value = o.titulo || '';
        document.getElementById('orcamento-categoria').value = o.categoria || 'PROJETO';
        document.getElementById('orcamento-status').value = o.status || 'PLANEJADO';
        document.getElementById('orcamento-data-criacao').value = o.dataCriacao ? dataISOparaBR(o.dataCriacao) : '';
        document.getElementById('orcamento-prazo').value = o.prazo ? dataISOparaBR(o.prazo) : '';
        document.getElementById('orcamento-valor-gasto').value = o.valorGastoReal || '';
        document.getElementById('orcamento-observacoes').value = o.observacoes || '';
        const lista = document.getElementById('orcamento-itens-lista');
        lista.innerHTML = '';
        (o.itens && o.itens.length > 0 ? o.itens : [null]).forEach(it => lista.appendChild(criarLinhaItemOrcamento(it)));
        recalcularTotalOrcamento();
        document.getElementById('modal-novo-orcamento').style.display = 'flex';
    };

    window.excluirOrcamento = function(key) {
        const o = allLoadedOrcamentos[key];
        if (!o) return;
        showConfirm(`Excluir o orçamento "${o.titulo}"? Essa ação não pode ser desfeita.`, 'danger', 'Excluir Orçamento').then(ok => {
            if (!ok) return;
            remove(ref(db, `orcamentos/${key}`)).then(() => {
                showAlert('Orçamento excluído.', 'success');
            }).catch(err => showAlert('Erro ao excluir: ' + err.message, 'danger'));
        });
    };

    document.getElementById('form-novo-orcamento').addEventListener('submit', (e) => {
        e.preventDefault();
        const titulo = document.getElementById('orcamento-titulo').value.trim();
        if (!titulo) { showAlert('Informe um título para o orçamento.', 'warning'); return; }

        const itens = [];
        document.querySelectorAll('#orcamento-itens-lista .linha-item-orcamento').forEach(tr => {
            const descricao = tr.querySelector('.item-orcamento-descricao').value.trim();
            const quantidade = parseFloat(tr.querySelector('.item-orcamento-qtd').value) || 0;
            const valorUnitario = parseFloat(tr.querySelector('.item-orcamento-preco').value) || 0;
            if (!descricao || quantidade <= 0) return;
            itens.push({ descricao, quantidade, valorUnitario });
        });
        if (itens.length === 0) { showAlert('Adicione ao menos um item com descrição e quantidade válida.', 'warning'); return; }

        const categoria = document.getElementById('orcamento-categoria').value;
        const status = document.getElementById('orcamento-status').value;
        const dataCriacao = dataBRparaISO(document.getElementById('orcamento-data-criacao').value) || formatDateInputValue(new Date());
        const prazo = dataBRparaISO(document.getElementById('orcamento-prazo').value) || null;
        const valorGastoReal = parseFloat(document.getElementById('orcamento-valor-gasto').value) || 0;
        const observacoes = document.getElementById('orcamento-observacoes').value.trim();
        const valorOrcado = parseFloat(calcularValorOrcadoItens(itens).toFixed(2));

        if (orcamentoEditandoKey) {
            const key = orcamentoEditandoKey;
            update(ref(db, `orcamentos/${key}`), {
                titulo, categoria, status, dataCriacao, prazo, valorGastoReal, observacoes, itens, valorOrcado
            }).then(() => {
                showAlert('Orçamento atualizado!', 'success');
                document.getElementById('modal-novo-orcamento').style.display = 'none';
                orcamentoEditandoKey = null;
            }).catch(err => showAlert('Erro ao atualizar: ' + err.message, 'danger'));
            return;
        }

        const numero = getNextNumeroOrcamento();
        push(ref(db, 'orcamentos'), {
            numero, titulo, categoria, status, dataCriacao, prazo, valorGastoReal, observacoes, itens, valorOrcado,
            timestamp: Date.now()
        }).then(() => {
            showAlert(`Orçamento "${titulo}" criado!`, 'success');
            document.getElementById('modal-novo-orcamento').style.display = 'none';
        }).catch(err => showAlert('Erro ao salvar: ' + err.message, 'danger'));
    });

    document.querySelectorAll('.orcamentos-filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filtroStatusOrcamento = btn.dataset.orcamentoStatus;
            document.querySelectorAll('.orcamentos-filtro-btn').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            renderOrcamentosTable();
        });
    });
    document.getElementById('orcamentos-filtro-categoria').addEventListener('change', renderOrcamentosTable);
    document.getElementById('orcamentos-busca').addEventListener('input', (e) => {
        filtroBuscaOrcamentos = normalizarBusca(e.target.value);
        document.getElementById('btn-limpar-busca-orcamentos').style.display = e.target.value ? 'inline-block' : 'none';
        renderOrcamentosTable();
    });
    document.getElementById('btn-limpar-busca-orcamentos').addEventListener('click', () => {
        document.getElementById('orcamentos-busca').value = '';
        filtroBuscaOrcamentos = '';
        document.getElementById('btn-limpar-busca-orcamentos').style.display = 'none';
        renderOrcamentosTable();
    });

    function renderOrcamentosTudo() {
        renderOrcamentosResumo();
        renderOrcamentosCategorias();
        renderOrcamentosTable();
        const estourados = Object.values(allLoadedOrcamentos).filter(o => {
            const orcado = parseFloat(o.valorOrcado || 0);
            const gasto = parseFloat(o.valorGastoReal || 0);
            return o.status !== 'CANCELADO' && orcado > 0 && gasto > orcado;
        }).length;
        const badge = document.getElementById('badge-alerta-orcamentos');
        if (badge) {
            badge.style.display = estourados > 0 ? 'inline-block' : 'none';
            badge.innerText = estourados;
        }
    }

    function renderOrcamentosResumo() {
        const lista = Object.values(allLoadedOrcamentos);
        let totalOrcado = 0, totalGasto = 0, estourados = 0;
        lista.forEach(o => {
            if (o.status === 'CANCELADO') return;
            const orcado = parseFloat(o.valorOrcado || 0);
            const gasto = parseFloat(o.valorGastoReal || 0);
            totalOrcado += orcado;
            totalGasto += gasto;
            if (gasto > orcado && orcado > 0) estourados++;
        });
        document.getElementById('orcamentos-kpi-total-orcado').innerText = `R$ ${formatMoeda(totalOrcado)}`;
        document.getElementById('orcamentos-kpi-total-gasto').innerText = `R$ ${formatMoeda(totalGasto)}`;
        document.getElementById('orcamentos-kpi-saldo').innerText = `R$ ${formatMoeda(totalOrcado - totalGasto)}`;
        document.getElementById('orcamentos-kpi-estourados').innerText = estourados;
    }

    function renderOrcamentosCategorias() {
        const container = document.getElementById('orcamentos-categorias-lista');
        const vazio = document.getElementById('orcamentos-categorias-vazio');
        const lista = Object.values(allLoadedOrcamentos).filter(o => o.status !== 'CANCELADO');
        const somaPorCategoria = {};
        Object.keys(CATEGORIA_ORCAMENTO_LABELS).forEach(c => somaPorCategoria[c] = 0);
        lista.forEach(o => { somaPorCategoria[o.categoria] = (somaPorCategoria[o.categoria] || 0) + parseFloat(o.valorOrcado || 0); });
        const maior = Math.max(1, ...Object.values(somaPorCategoria));
        const temAlgo = Object.values(somaPorCategoria).some(v => v > 0);
        container.style.display = temAlgo ? 'flex' : 'none';
        vazio.style.display = temAlgo ? 'none' : 'block';
        container.innerHTML = Object.entries(CATEGORIA_ORCAMENTO_LABELS).map(([chave, nome]) => {
            const valor = somaPorCategoria[chave] || 0;
            const largura = maior > 0 ? (valor / maior * 100) : 0;
            return `
                <div class="orcamentos-categoria-linha">
                    <span class="orcamentos-categoria-nome">${nome}</span>
                    <div class="orcamentos-categoria-track"><div class="orcamentos-categoria-fill" style="width:${largura}%;"></div></div>
                    <span class="orcamentos-categoria-valor">R$ ${formatMoeda(valor)}</span>
                </div>
            `;
        }).join('');
    }

    function renderOrcamentosTable() {
        const tbody = document.getElementById('orcamentos-table-body');
        if (!tbody) return;
        const filtroCategoria = document.getElementById('orcamentos-filtro-categoria').value;

        let lista = Object.keys(allLoadedOrcamentos)
            .map(key => ({ key, ...allLoadedOrcamentos[key] }))
            .filter(o => !filtroStatusOrcamento || o.status === filtroStatusOrcamento)
            .filter(o => !filtroCategoria || o.categoria === filtroCategoria)
            .filter(o => !filtroBuscaOrcamentos || normalizarBusca(o.titulo || '').includes(filtroBuscaOrcamentos));

        lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        lista = ordenarPorEstado(lista, 'orcamentos-table');

        document.getElementById('orcamentos-vazio').style.display = lista.length === 0 ? 'block' : 'none';
        tbody.innerHTML = '';
        if (lista.length === 0) return;

        lista.forEach(o => {
            const statusInfo = STATUS_ORCAMENTO_LABELS[o.status] || STATUS_ORCAMENTO_LABELS.PLANEJADO;
            const orcado = parseFloat(o.valorOrcado || 0);
            const gasto = parseFloat(o.valorGastoReal || 0);
            const percentual = orcado > 0 ? (gasto / orcado * 100) : (gasto > 0 ? 100 : 0);
            const percentualBarra = Math.min(100, percentual);
            const corBarra = percentual >= 100 ? 'estourado' : (percentual >= 75 ? 'atencao' : 'ok');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${String(o.numero || 0).padStart(3, '0')}</td>
                <td style="font-weight:600;">${o.titulo}</td>
                <td>${CATEGORIA_ORCAMENTO_LABELS[o.categoria] || '-'}</td>
                <td>${o.dataCriacao ? dataISOparaBR(o.dataCriacao) : '-'}</td>
                <td>${o.prazo ? dataISOparaBR(o.prazo) : '<span style="color:var(--text-faint);">-</span>'}</td>
                <td style="font-weight:700;">R$ ${formatMoeda(orcado)}</td>
                <td>R$ ${formatMoeda(gasto)}</td>
                <td>
                    <div class="orcamento-progress-track"><div class="orcamento-progress-fill ${corBarra}" style="width:${percentualBarra}%;"></div></div>
                    <span class="orcamento-progress-label">${percentual.toFixed(0)}%</span>
                </td>
                <td><span class="badge-status ${statusInfo.classe}">${statusInfo.texto}</span></td>
                <td style="white-space:nowrap;">
                    <button type="button" class="btn-action-prod btn-edit-prod" onclick="editarOrcamento('${o.key}')" title="Editar">✏️</button>
                    <button type="button" class="btn-action-prod btn-delete-prod" onclick="excluirOrcamento('${o.key}')" title="Excluir">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    bindSortableHeaders('orcamentos-table', 'orcamentos-table', renderOrcamentosTable);

    document.getElementById('btn-calculate-costs').addEventListener('click', calculateCosts);
    document.getElementById('btn-save-production-order').addEventListener('click', saveProductionOrder);

    resetToDefaultIngredients();
    initDatabaseSync();
