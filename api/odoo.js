// Dados Mock/Locais dos Produtos
let listaProdutos = [
    { id: 1, descricao: 'DIN DIN DE MARACUJÁ', categoria: 'DIN DIN', precoVenda: 7.00, custo: 2.50, estoque: 4 },
    { id: 2, descricao: 'DIN DIN DE MARACUJÁ COM CHOCOLATE', categoria: 'DIN DIN', precoVenda: 7.00, custo: 2.50, estoque: 3 },
    { id: 3, descricao: 'DIN DIN DE MORANGO COM CHOCOLATE', categoria: 'DIN DIN', precoVenda: 7.00, custo: 2.50, estoque: 10 },
    { id: 4, descricao: 'DIN DIN DE MORANGO COM PEDAÇOS', categoria: 'DIN DIN', precoVenda: 7.00, custo: 2.50, estoque: 13 },
    { id: 5, descricao: 'DIN DIN DE NINHO COM NUTELLA', categoria: 'DIN DIN', precoVenda: 8.00, custo: 3.50, estoque: 4 },
    { id: 6, descricao: 'DIN DIN DE OVOMALTINE COM CHOCOLATE', categoria: 'DIN DIN', precoVenda: 7.00, custo: 2.50, estoque: 5 },
    { id: 7, descricao: 'DIN DIN DE OVOMALTINE COM CHOCOLATE BRANCO', categoria: 'DIN DIN', precoVenda: 7.00, custo: 2.50, estoque: 11 }
];

// Função para renderizar a tabela de produtos trazendo o botão "Editar" de volta
function renderizarProdutos(produtos) {
    const tbody = document.getElementById('tabelaProdutosBody');
    const count = document.getElementById('countProdutos');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    count.innerText = `${produtos.length} produto(s) encontrado(s):`;

    produtos.forEach(produto => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold;">${produto.descricao}</td>
            <td><span class="badge-category">${produto.categoria}</span></td>
            <td>R$ ${produto.precoVenda.toFixed(2)}</td>
            <td style="color: #666;">R$ ${produto.custo.toFixed(2)}</td>
            <td><span class="badge-stock">${produto.estoque} un</span></td>
            <td style="text-align: center;">
                <button class="btn-edit" onclick="editarProduto(${produto.id})">✏️ Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Ação do Botão Editar Produtos
function editarProduto(id) {
    const produto = listaProdutos.find(p => p.id === id);
    if (produto) {
        console.log("Editando produto:", produto);
        alert(`Editar produto: ${produto.descricao}`);
    }
}

// Ação de Busca de Produtos
function buscarProduto() {
    const termo = document.getElementById('inputBuscaProduto').value.toLowerCase();
    const filtrados = listaProdutos.filter(p => p.descricao.toLowerCase().includes(termo));
    renderizarProdutos(filtrados);
}

// --- Funções do Modal da Fatura ---

function abrirModalFatura() {
    const modal = document.getElementById('modalFatura');
    if (modal) modal.style.display = 'block';
}

function fecharModalFatura() {
    const modal = document.getElementById('modalFatura');
    if (modal) modal.style.display = 'none';
}

// Salvar Fatura Provisória (Acionado pelo novo botão Salvar no rodapé)
function salvarFaturaProvisoria() {
    const cliente = document.getElementById('clienteInput').value;
    const condicao = document.getElementById('condicaoPagamento').value;
    
    console.log("Salvando fatura provisória:", { cliente, condicao });
    alert("Fatura salva com sucesso!");
}

function excluirFatura() {
    if (confirm("Tem certeza que deseja excluir esta fatura?")) {
        fecharModalFatura();
    }
}

function lancarFatura() {
    alert("Fatura lançada com sucesso!");
    fecharModalFatura();
}

function adicionarLinhaFatura() {
    const tbody = document.getElementById('linhasFatura');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #eee';
    tr.innerHTML = `
        <td style="padding: 8px;">
            <select style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                ${listaProdutos.map(p => `<option value="${p.id}">${p.descricao}</option>`).join('')}
            </select>
        </td>
        <td style="padding: 8px; text-align: center;">
            <input type="number" value="1" min="1" style="width: 50px; text-align: center; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
        </td>
        <td style="padding: 8px; text-align: center;">
            <input type="text" value="7.00" style="width: 60px; text-align: center; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
        </td>
        <td style="padding: 8px; text-align: right; font-weight: bold;">R$ 7.00</td>
        <td style="padding: 8px; text-align: center;">
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #d9534f; cursor: pointer; font-weight: bold;">✕</button>
        </td>
    `;
    tbody.appendChild(tr);
}

// Inicialização da Página
document.addEventListener('DOMContentLoaded', () => {
    renderizarProdutos(listaProdutos);
});
